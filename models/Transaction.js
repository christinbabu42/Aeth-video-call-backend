const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["purchase", "gift_sent", "gift_received", "withdrawal", "bonus"],
    required: true,
  },
  coins: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 }, // Value in ₹
  currency: { type: String, default: "INR" },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  productId: String,
  purchaseToken: { type: String, unique: true, sparse: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", TransactionSchema);