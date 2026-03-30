const mongoose = require("mongoose");

const avatarSchema = new mongoose.Schema({
  url: { type: String, required: true },
  gender: { type: String, enum: ["boy", "girl"], required: true },
  name: { type: String },
});

module.exports = mongoose.model("Avatar", avatarSchema);