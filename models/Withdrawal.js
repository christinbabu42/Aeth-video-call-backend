const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['UPI', 'Bank Transfer'], required: true },
  paymentDetails: {
    upiId: String,
    accountNumber: String,
    ifsc: String,
    bankName: String
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  transactionRef: { type: String }, // Reference ID from the bank
  processedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Withdrawal", withdrawalSchema);