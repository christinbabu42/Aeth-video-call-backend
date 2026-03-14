const mongoose = require("mongoose");

const giftTransactionSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  gift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gift",
    required: true
  },

  quantity: {
    type: Number,
    default: 1
  }

}, { timestamps: true });

module.exports = mongoose.model("GiftTransaction", giftTransactionSchema);  