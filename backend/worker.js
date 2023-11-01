const Y = require("yjs");
const LeveldbPersistence = require("y-leveldb").LeveldbPersistence;
const AblyProvider = require("./y-ably").AblyProvider;
const ldb = new LeveldbPersistence("./ldb");

const startSyncWorker = async (spaceId, onSync) => {
  try {
    let isResolved = false;
    const ydoc = new Y.Doc();
    const persistedYdoc = await ldb.getYDoc(spaceId);
    const newUpdates = Y.encodeStateAsUpdate(ydoc);
    ldb.storeUpdate(spaceId, newUpdates);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    const ablyProvider = new AblyProvider(spaceId, ydoc);

    ydoc.on("update", (update) => {
      ldb.storeUpdate(spaceId, update);
    });

    ablyProvider.on("synced", () => {
      if (!isResolved) {
        onSync();
      }
    });
  } catch (e) {
    console.error(e);
  }
};

module.exports = { startSyncWorker, ldb };
