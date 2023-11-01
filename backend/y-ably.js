'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var error = require('lib0/error');
var random = require('lib0/random');
var encoding = require('lib0/encoding');
var decoding = require('lib0/decoding');
var observable = require('lib0/observable');
var logging = require('lib0/logging');
var promise = require('lib0/promise');
var bc = require('lib0/broadcastchannel');
var mutex = require('lib0/mutex');
require('yjs');
var syncProtocol = require('y-protocols/sync');
var awarenessProtocol = require('y-protocols/awareness');
var string = require('lib0/string');
var Ably = require('ably/promises.js');

/* eslint-env browser */

/**
 * @param {string} secret
 * @param {string} roomName
 * @return {PromiseLike<CryptoKey>}
 */
const deriveKey = (secret, roomName) => {
  const secretBuffer = string.encodeUtf8(secret).buffer;
  const salt = string.encodeUtf8(roomName).buffer;
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
    return /** @type {PromiseLike<Uint8Array>} */ (promise.resolve(data))
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
    const encryptedDataEncoder = encoding.createEncoder();
    encoding.writeVarString(encryptedDataEncoder, 'AES-GCM');
    encoding.writeVarUint8Array(encryptedDataEncoder, iv);
    encoding.writeVarUint8Array(encryptedDataEncoder, new Uint8Array(cipher));
    return encoding.toUint8Array(encryptedDataEncoder)
  })
};

/**
 * @param {Uint8Array} data
 * @param {CryptoKey?} key
 * @return {PromiseLike<Uint8Array>} decrypted buffer
 */
const decrypt = (data, key) => {
  if (!key) {
    return /** @type {PromiseLike<Uint8Array>} */ (promise.resolve(data))
  }
  const dataDecoder = decoding.createDecoder(data);
  const algorithm = decoding.readVarString(dataDecoder);
  if (algorithm !== 'AES-GCM') {
    promise.reject(error.create('Unknown encryption algorithm'));
  }
  const iv = decoding.readVarUint8Array(dataDecoder);
  const cipher = decoding.readVarUint8Array(dataDecoder);
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    cipher
  ).then(data => new Uint8Array(data))
};

const log = logging.createModuleLogger('y-ably');

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
    log('synced ', logging.BOLD, room.name, logging.UNBOLD, ' with all peers');
  }
};

/**
 * @param {Room} room
 * @param {Uint8Array} buf
 * @param {function} syncedCallback
 * @return {encoding.Encoder?}
 */
const readMessage = (room, buf, syncedCallback) => {
  const decoder = decoding.createDecoder(buf);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);
  if (room === undefined) {
    return null
  }
  const awareness = room.awareness;
  const doc = room.doc;
  let sendReply = false;
  switch (messageType) {
    case messageSync: {
      encoding.writeVarUint(encoder, messageSync);
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        doc,
        room
      );
      if (
        syncMessageType === syncProtocol.messageYjsSyncStep2 &&
        !room.synced
      ) {
        syncedCallback();
      }
      if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
        sendReply = true;
      }
      break
    }
    case messageQueryAwareness:
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awareness.getStates().keys())
        )
      );
      sendReply = true;
      break
    case messageAwareness:
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        room
      );
      break
    case messageBcPeerId: {
      const add = decoding.readUint8(decoder) === 1;
      const peerName = decoding.readVarString(decoder);
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
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  room.channel.publish('docUpdated', encoding.toUint8Array(encoder));
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awarenessStates.keys())
      )
    );
    room.channel.publish('docUpdated', encoding.toUint8Array(encoder));
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
    logging.BOLD,
    clientId,
    logging.GREY,
    ' (',
    room.name,
    ')',
    logging.UNBOLD,
    logging.UNCOLOR
  );
  return readMessage(room, buf, () => {
    console.log('synced');
    room.roomPeers.set(clientId, true);
    log(
      'synced ',
      logging.BOLD,
      room.name,
      logging.UNBOLD,
      ' with ',
      logging.BOLD,
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
  log('broadcast message in ', logging.BOLD, room.name, logging.UNBOLD);
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
    .then((data) => room.mux(() => bc.publish(room.name, data)));

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
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageBcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 1);
    encoding.writeVarString(encoderPeerIdBc, room.peerId);
    broadcastBcMessage(room, encoding.toUint8Array(encoderPeerIdBc));
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

    this.peerId = random.uuidv4();
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
    this.mux = mutex.createMutex();
    this.bcconnected = false;
    /**
     * @param {ArrayBuffer} data
     */
    this._bcSubscriber = (data) =>
      decrypt(new Uint8Array(data), key).then((m) =>
        this.mux(() => {
          const reply = readMessage(this, m, () => {});
          if (reply) {
            broadcastBcMessage(this, encoding.toUint8Array(reply));
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
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      broadcastRoomMessage(this, encoding.toUint8Array(encoder));
    };
    /**
     * Listens to Awareness updates and sends them to remote peers
     *
     * @param {any} changed
     * @param {any} origin
     */
    this._awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoderAwareness = encoding.createEncoder();
      encoding.writeVarUint(encoderAwareness, messageAwareness);
      encoding.writeVarUint8Array(
        encoderAwareness,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      broadcastRoomMessage(this, encoding.toUint8Array(encoderAwareness));
    };

    this._beforeUnloadHandler = () => {
      awarenessProtocol.removeAwarenessStates(
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
    bc.subscribe(roomName, this._bcSubscriber);
    this.bcconnected = true;
    // broadcast peerId via broadcastchannel
    broadcastBcPeerId(this);
    // write sync step 1
    const encoderSync = encoding.createEncoder();
    encoding.writeVarUint(encoderSync, messageSync);
    syncProtocol.writeSyncStep1(encoderSync, this.doc);
    broadcastBcMessage(this, encoding.toUint8Array(encoderSync));
    // broadcast local state
    const encoderState = encoding.createEncoder();
    encoding.writeVarUint(encoderState, messageSync);
    syncProtocol.writeSyncStep2(encoderState, this.doc);
    broadcastBcMessage(this, encoding.toUint8Array(encoderState));
    // write queryAwareness
    const encoderAwarenessQuery = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessQuery, messageQueryAwareness);
    broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessQuery));
    // broadcast local awareness state
    const encoderAwarenessState = encoding.createEncoder();
    encoding.writeVarUint(encoderAwarenessState, messageAwareness);
    encoding.writeVarUint8Array(
      encoderAwarenessState,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
        this.doc.clientID
      ])
    );
    broadcastBcMessage(this, encoding.toUint8Array(encoderAwarenessState));

    // ably channel connection

    this.ably = new Ably.Realtime.Promise({
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
          this.channel.publish(message.clientId, encoding.toUint8Array(answer));
        }
      };
      this.channel.subscribe('docUpdated', onUpdate);
      this.channel.subscribe(this.peerId, onUpdate);
    });
  }

  disconnect () {
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      'disconnect'
    );
    // broadcast peerId removal via broadcastchannel
    const encoderPeerIdBc = encoding.createEncoder();
    encoding.writeVarUint(encoderPeerIdBc, messageBcPeerId);
    encoding.writeUint8(encoderPeerIdBc, 0); // remove peerId from other bc peers
    encoding.writeVarString(encoderPeerIdBc, this.peerId);
    broadcastBcMessage(this, encoding.toUint8Array(encoderPeerIdBc));

    bc.unsubscribe(this.name, this._bcSubscriber);
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
class AblyProvider extends observable.Observable {
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
      awareness = new awarenessProtocol.Awareness(doc),
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
      : /** @type {PromiseLike<null>} */ (promise.resolve(null));
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

exports.AblyProvider = AblyProvider;
exports.Room = Room;
//# sourceMappingURL=y-ably.cjs.map
