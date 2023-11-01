const mongoose = require("mongoose");

mongoose.connect(
  "YOUR_MONGO_KEY"
);

const spaceSchema = new mongoose.Schema({
  ydoc: Object,
  spaceId: String,
  title: String,
});

const spaceModel = mongoose.model("space", spaceSchema);

module.exports = { spaceModel };
