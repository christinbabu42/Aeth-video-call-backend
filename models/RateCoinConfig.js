const mongoose = require("mongoose");

const RateCoinConfigSchema = new mongoose.Schema({
  userCoinValue: {
    type: Number,
    default: 1.0  // Cost for the user to buy 1 coin
  },
  hostCoinValue: {
    type: Number,
    default: 0.42 // Value host gets for 1 coin
  },
  platformCommissionRate: {
    type: Number,
    default: 0.15
  },
  giftCommissionRate: {
    type: Number,
    default: 0.2 // Gift commission (20%)
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("RateCoinConfig", RateCoinConfigSchema);