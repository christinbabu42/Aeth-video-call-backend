const mongoose = require("mongoose"); // <--- THIS WAS MISSING

const walletTransactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true 
  },
  type: { 
    type: String, 
    enum: ["CREDIT", "DEBIT"],
    required: true 
  },
  category: { 
    type: String, 
    enum: ["COIN_PURCHASE", "GIFT_PURCHASE", "GIFT_RECEIVED"], 
    required: true 
  },
  coins: {
    type: Number,
    required: true
  },
  amount: { 
    type: Number 
  }, // Real money (only for COIN_PURCHASE)
  stripePaymentIntentId: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ["PENDING", "SUCCESS", "FAILED"],
    default: "SUCCESS" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);