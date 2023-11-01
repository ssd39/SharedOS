import { create } from 'lib0/error';
import { uuidv4 } from 'lib0/random';
import { createEncoder, writeVarString, writeVarUint8Array, toUint8Array, writeVarUint, writeUint8 } from 'lib0/encoding';
import { createDecoder, readVarString, readVarUint8Array, readVarUint, readUint8 } from 'lib0/decoding';
import { Observable } from 'lib0/observable';
import { createModuleLogger, BOLD, UNBOLD, GREY, UNCOLOR } from 'lib0/logging';
import { resolve, reject } from 'lib0/promise';
import { publish, subscribe, unsubscribe } from 'lib0/broadcastchannel';
import { createMutex } from 'lib0/mutex';
import 'yjs';
import { writeUpdate, writeSyncStep1, writeSyncStep2, readSyncMessage, messageYjsSyncStep2, messageYjsSyncStep1 } from 'y-protocols/sync';
import { encodeAwarenessUpdate, removeAwarenessStates, Awareness, applyAwarenessUpdate } from 'y-protocols/awareness';
import { encodeUtf8 } from 'lib0/string';
import { Realtime } from 'ably/promises.js';

/* eslint-env browser */

/**
 * @param {string} secret
 * @param {string} roomName
 * @return {PromiseLike<CryptoKey>}
 */
const deriveKey = (secret, roomName) => {
  const secretBuffer = encodeUtf8(secret).buffer;
  const salt = encodeUtf8(roomName).buffer;
  return crypto.subtle.importKey(
    'raw',
    secretBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  ).then(keyMaterial =>
    crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    )
  )
};

/**
 * @param {Uint8Array} data data to be encrypted
 * @param {CryptoKey?} key
 * @return {PromiseLike<Uint8Array>} encrypted, base64 encoded message
 */
const encrypt = (data, key) => {
  if (!key) {
    return /** @type {PromiseLike<Uint8Array>} */ (resolve(data))
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    data
  ).then(cipher => {
    const encryptedDataEncoder = createEncoder();
    writeVarString(encryptedDataEncoder, 'AES-GCM');
    writeVarUint8Array(encryptedDataEncoder, iv);
    writeVarUint8Array(encryptedDataEncoder, new Uint8Array(cipher));
    return toUint8Array(encryptedDataEncoder)
  })
};

/**
 * @param {Uint8Array} data
 * @param {CryptoKey?} key
 * @return {PromiseLike<Uint8Array>} decrypted buffer
 */
const decrypt = (data, key) => {
  if (!key) {
    return /** @type {PromiseLike<Uint8Array>} */ (resolve(data))
  }
  const dataDecoder = createDecoder(data);
  const algorithm = readVarString(dataDecoder);
  if (algorithm !== 'AES-GCM') {
    reject(create('Unknown encryption algorithm'));
  }
  const iv = readVarUint8Array(dataDecoder);
  const cipher = readVarUint8Array(dataDecoder);
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    cipher
  ).then(data => new Uint8Array(data))
};

const log = createModuleLogger('y-ably');

const messageSync = 0;
const messageQueryAwareness = 3;
const messageAwareness = 1;
const messageBcPeerId = 4;

/**
 * @type {Map<string,Room>}
 */
const rooms = new Map();

/**
 * @param {Room} room
 */
const checkIsSynced = (room) => {
  let synced = true;
  room.roomPeers.forEach((isSynced) => {
    if (!isSynced) {
      synced = false;
    }
  });
  if ((!synced && room.synced) || (synced && !room.synced)) {
    room.synced = synced;
    room.provider.emit('synced', [{ synced }]);
    log('synced ', BOLD, room.name, UNBOLD, ' with all peers');
  }
};

/**
 * @param {Room} room
 * @param {Uint8Array} buf
 * @param {function} syncedCallback
 * @return {encoding.Encoder?}
 */
const readMessage = (room, buf, syncedCallback) => {
  const decoder = createDecoder(buf);
  const encoder = createEncoder();
  const messageType = readVarUint(decoder);
  if (room === undefined) {
    return null
  }
  const awareness = room.awareness;
  const doc = room.doc;
  let sendReply = false;
  switch (messageType) {
    case messageSync: {
      writeVarUint(encoder, messageSync);
      const syncMessageType = readSyncMessage(
        decoder,
        encoder,
        doc,
        room
      );
      if (
        syncMessageType === messageYjsSyncStep2 &&
        !room.synced
      ) {
        syncedCallback();
      }
      if (syncMessageType === messageYjsSyncStep1) {
        sendReply = true;
      }
      break
    }
    case messageQueryAwareness:
      writeVarUint(encoder, messageAwareness);
      writeVarUint8Array(
        encoder,
        encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys())
        )
      );
      sendReply = true;
      break
    case messageAwareness:
      applyAwarenessUpdate(
        awareness,
        readVarUint8Array(decoder),
        room
      );
      break
    case messageBcPeerId: {
      const add = readUint8(decoder) === 1;
      const peerName = readVarString(decoder);
      if (
        peerName !== room.peerId &&
        ((room.bcConns.has(peerName) && !add) ||
          (!room.bcConns.has(peerName) && add))
      ) {
        if (add) {
          room.bcConns.add(peerName);
        } else {
          room.bcConns.delete(peerName);
        }
        broadcastBcPeerId(room);
      }
      break
    }
    default:
      console.error('Unable to compute message');
      return encoder
  }
  if (!sendReply) {
    // nothing has been written, no answer created
    return null
  }
  return encoder
};

/**
 * @param {Room} room
 */
const initialSync = (room) => {
  const provider = room.provider;
  const doc = provider.doc;
  const awareness = room.awareness;
  const encoder = createEncoder();
  writeVarUint(encoder, messageSync);
  writeSyncStep1(encoder, doc);
  room.channel.publish('docUpdated', toUint8Array(encoder));
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = createEncoder();
    writeVarUint(encoder, messageAwareness);
    writeVarUint8Array(
      encoder,
      encodeAwarenessUpdate(
        awareness,
        Array.from(awarenessStates.keys())
      )
    );
    room.channel.publish('docUpdated', toUint8Array(encoder));
  }
};

/**
 * @param {Room} room
 * @param {String} clientId
 * @param {Uint8Array} buf
 * @return {encoding.Encoder?}
 */
const readPeerMessage = (room, clientId, buf) => {
  console.log('reading peer meesage');
  log(
    'received message from ',
    BOLD,
    clientId,
    GREY,
    ' (',
    room.name,
    ')',
    UNBOLD,
    UNCOLOR
  );
  return readMessage(room, buf, () => {
    console.log('synced');
    room.roomPeers.set(clientId, true);
    log(
      'synced ',
      BOLD,
      room.name,
      UNBOLD,
      ' with ',
      BOLD,
      clientId
    );
    checkIsSynced(room);
  })
};

/**
 * @param {Room} room
 * @param {Uint8Array} m
 */
const broadcastAblyChannel = (room, m) => {
  log('broadcast message in ', BOLD, room.name, UNBOLD);
  if(room.channel){
    room.channel.publish('docUpdated', m);
  }
  /*room.roomPeers.forEach((_, clientID) => {
    try {
      room.channel.publish(clientID, m)
    } catch (e) {
      console.error(e)
    }
  })*/
};

/**
 * @param {Room} room
 * @param {Uint8Array} m
 */
const broadcastBcMessage = (room, m) =>
  encrypt(m, room.key)
    .then((data) => room.mux(() => publish(room.name, data)));

/**
 * @param {Room} room
 * @param {Uint8Array} m
 */
const broadcastRoomMessage = (room, m) => {
  if (room.bcconnected) {
    broadcastBcMessage(room, m);
  }
  broadcastAblyChannel(room, m);
};

/**
 * @param {Room} room
 */
const broadcastBcPeerId = (room) => {
  if (room.provider.filterBcConns) {
    // broadcast peerId via broadcastchannel
    const encoderPeerIdBc = createEncoder();
    writeVarUint(encoderPeerIdBc, messageBcPeerId);
    writeUint8(encoderPeerIdBc, 1);
    writeVarString(encoderPeerIdBc, room.peerId);
    broadcastBcMessage(room, toUint8Array(encoderPeerIdBc));
  }
};

class Room {
  /**
   * @param {Y.Doc} doc
   * @param {AblyProvider} provider
   * @param {string} name
   * @param {CryptoKey|null} key
   */
  constructor (doc, provider, name, key) {
    /**
     * @type {Ably.Types.RealtimeChannelPromise}
     */
    this.channel = null;

    this.ably = null;
    /**
     * Do not assume that peerId is unique. This is only meant for sending signaling messages.
     *
     * @type {string}
     */

    this.peerId = uuidv4();
    this.doc = doc;
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = provider.awareness;
    this.provider = provider;
    this.synced = false;
    this.name = name;
    // @todo make key secret by scoping
    this.key = key;
    /**
     * @type {Map<string, Boolean>}
     */
    this.roomPeers = new Map();
    /**
     * @type {Set<string>}
     */
    this.bcConns = new Set();
    this.mux = createMutex();
    this.bcconnected = false;
    /**
     * @param {ArrayBuffer} data
     */
    this._bcSubscriber = (data) =>
      decrypt(new Uint8Array(data), key).then((m) =>
        this.mux(() => {
          const reply = readMessage(this, m, () => {});
          if (reply) {
            broadcastBcMessage(this, toUint8Array(reply));
          }
        })
      );
    /**
     * Listens to Yjs updates and sends them to remote peers
     *
     * @param {Uint8Array} update
     * @param {any} origin
     */
    this._docUpdateHandler = (update, origin) => {
      const encoder = createEncoder();
      writeVarUint(encoder, messageSync);
      writeUpdate(encoder, update);
      broadcastRoomMessage(this, toUint8Array(encoder));
    };
    /**
     * Listens to Awareness updates and sends them to remote peers
     *
     * @param {any} changed
     * @param {any} origin
     */
    this._awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoderAwareness = createEncoder();
      writeVarUint(encoderAwareness, messageAwareness);
      writeVarUint8Array(
        encoderAwareness,
        encodeAwarenessUpdate(this.awareness, changedClients)
      );
      broadcastRoomMessage(this, toUint8Array(encoderAwareness));
    };

    this._beforeUnloadHandler = () => {
      removeAwarenessStates(
        this.awareness,
        [doc.clientID],
        'window unload'
      );
      rooms.forEach((room) => {
        room.disconnect();
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._beforeUnloadHandler);
    } else if (typeof process !== 'undefined') {
      process.on('exit', this._beforeUnloadHandler);
    }
  }

  connect () {
    this.doc.on('update', this._docUpdateHandler);
    this.awareness.on('update', this._awarenessUpdateHandler);
    // signal through all available signaling connections
    const roomName = this.name;
    subscribe(roomName, this._bcSubscriber);
    this.bcconnected = true;
    // broadcast peerId via broadcastchannel
    broadcastBcPeerId(this);
    // write sync step 1
    const encoderSync = createEncoder();
    writeVarUint(encoderSync, messageSync);
    writeSyncStep1(encoderSync, this.doc);
    broadcastBcMessage(this, toUint8Array(encoderSync));
    // broadcast local state
    const encoderState = createEncoder();
    writeVarUint(encoderState, messageSync);
    writeSyncStep2(encoderState, this.doc);
    broadcastBcMessage(this, toUint8Array(encoderState));
    // write queryAwareness
    const encoderAwarenessQuery = createEncoder();
    writeVarUint(encoderAwarenessQuery, messageQueryAwareness);
    broadcastBcMessage(this, toUint8Array(encoderAwarenessQuery));
    // broadcast local awareness state
    const encoderAwarenessState = createEncoder();
    writeVarUint(encoderAwarenessState, messageAwareness);
    writeVarUint8Array(
      encoderAwarenessState,
      encodeAwarenessUpdate(this.awareness, [
        this.doc.clientID
      ])
    );
    broadcastBcMessage(this, toUint8Array(encoderAwarenessState));

    // ably channel connection

    this.ably = new Realtime.Promise({
      key: 'YOUR_ABLY_KEY',
      clientId: this.peerId
    });
    this.ably.connection.once('connected').then(() => {
      this.channel = this.ably.channels.get(this.name);
      this.channel.presence.enter();
      initialSync(this);
      this.channel.presence.get().then((members) => {
        members.forEach((member) => {
          if (this.peerId !== member.clientId) {
            this.roomPeers.set(member.clientId, false);
          }
        });
      });
      
      this.channel.presence.subscribe('enter', (member) => {
        if (this.peerId !== member.clientId) {
          this.roomPeers.set(member.clientId, false);
        }
      });

      this.channel.presence.subscribe('leave', (member) => {
        this.roomPeers.delete(member.clientId);
        checkIsSynced(this);
      });
      const onUpdate = (message) => {
        const answer = readPeerMessage(this, message.clientId, new Uint8Array(message.data));
        if (answer !== null) {
          this.channel.publish(message.clientId, toUint8Array(answer));
        }
      };
      this.channel.subscribe('docUpdated', onUpdate);
      this.channel.subscribe(this.peerId, onUpdate);
    });
  }

  disconnect () {
    removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      'disconnect'
    );
    // broadcast peerId removal via broadcastchannel
    const encoderPeerIdBc = createEncoder();
    writeVarUint(encoderPeerIdBc, messageBcPeerId);
    writeUint8(encoderPeerIdBc, 0); // remove peerId from other bc peers
    writeVarString(encoderPeerIdBc, this.peerId);
    broadcastBcMessage(this, toUint8Array(encoderPeerIdBc));

    unsubscribe(this.name, this._bcSubscriber);
    this.bcconnected = false;
    this.doc.off('update', this._docUpdateHandler);
    this.awareness.off('update', this._awarenessUpdateHandler);

    this.ably.close();
  }

  destroy () {
    this.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    } else if (typeof process !== 'undefined') {
      process.off('exit', this._beforeUnloadHandler);
    }
  }
}

/**
 * @param {Y.Doc} doc
 * @param {AblyProvider} provider
 * @param {string} name
 * @param {CryptoKey|null} key
 * @return {Room}
 */
const openRoom = (doc, provider, name, key) => {
  // there must only be one room
  if (rooms.has(name)) {
    //throw error.create(`A Yjs Doc connected to room "${name}" already exists!`)
    return rooms.get(name)
  }
  const room = new Room(doc, provider, name, key);
  rooms.set(name, /** @type {Room} */ (room));
  return room
};

/**
 * @typedef {Object} ProviderOptions
 * @property {Array<string>} [signaling]
 * @property {string} [password]
 * @property {awarenessProtocol.Awareness} [awareness]
 * @property {number} [maxConns]
 * @property {boolean} [filterBcConns]
 * @property {any} [peerOpts]
 */

/**
 * @extends Observable<string>
 */
class AblyProvider extends Observable {
  /**
   * @param {string} roomName
   * @param {Y.Doc} doc
   * @param {ProviderOptions?} opts
   */
  constructor (
    roomName,
    doc,
    {
      password = null,
      awareness = new Awareness(doc),
      filterBcConns = true
    } = {}
  ) {
    super();
    this.roomName = roomName;
    this.doc = doc;
    this.filterBcConns = filterBcConns;
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = awareness;
    this.shouldConnect = false;
    /**
     * @type {PromiseLike<CryptoKey | null>}
     */
    this.key = password
      ? deriveKey(password, roomName)
      : /** @type {PromiseLike<null>} */ (resolve(null));
    /**
     * @type {Room|null}
     */
    this.room = null;
    this.key.then((key) => {
      this.room = openRoom(doc, this, roomName, key);
      this.room.connect();
      this.emit('roomconnected', []);
    });
    this.destroy = this.destroy.bind(this);
    doc.on('destroy', this.destroy);
  }

  /**
   * @type {boolean}
   */
  get connected () {
    return this.room !== null && this.shouldConnect
  }

  connect () {
    if (!this.connected) {
      this.room.connect();
    }
    this.shouldConnect = true;
  }

  disconnect () {
    if (this.connected) {
      this.room.disconnect();
    }
    this.shouldConnect = false;
  }

  destroy () {
    this.doc.off('destroy', this.destroy);
    // need to wait for key before deleting room
    this.key.then(() => {
      /** @type {Room} */ (this.room).destroy();
      rooms.delete(this.roomName);
    });
    super.destroy();
  }
}

export { AblyProvider, Room };
//# sourceMappingURL=y-ably.js.map
