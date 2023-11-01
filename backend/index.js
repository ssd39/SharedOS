const express = require("express");
const cors = require("cors");
const spaceModel = require("./mongo_helper").spaceModel;
const worker = require("./worker");
const Y = require('yjs')

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());


const workers = {};

app.get("/space/:id/:name?", async (req, res) => {
  try {
    const spaceId = req.params.id;
    const spaceName = req.params.name;
    if (spaceId) {
      let space = await spaceModel.findOne({ spaceId });
      if (!space) {
        if (spaceName) {
            const newSpace = new spaceModel({
                title: spaceName,
                spaceId
            })
            await newSpace.save()
            space = newSpace
        } else {
          return res.json({ success: false, error: "space title is required" });
        }
      } else {
        if (!workers.hasOwnProperty(spaceId)) {
          await new  Promise ((resolve, reject) => {
            worker.startSyncWorker(spaceId, () => {
                resolve()
            });
          })
          workers[spaceId] = true
        }
      }
      return res.json({ success: true, title: space.title });
    }
    res.json({ success: false, error: "space id missing" });
  } catch (e) {
    console.error(e);
    res.json({ success: false, error: "API failed" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
