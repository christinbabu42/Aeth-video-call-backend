const mongoose = require("mongoose");

const deleteRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: ""
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["pending", "processed"],
    default: "pending"
  }
});

module.exports = mongoose.model("DeleteRequest", deleteRequestSchema);