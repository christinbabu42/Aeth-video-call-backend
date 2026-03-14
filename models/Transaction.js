const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['recharge', 'gift', 'call_payment', 'refund'], required: true },
  amount: { type: Number, required: true }, // Coins or Currency
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'success' },
  paymentGatewayData: Object, // Razorpay/Stripe details
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If it's a gift
  giftDetails: {
    giftId: String,
    name: String
  }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);