const mongoose = require("mongoose");

const coinPackSchema = new mongoose.Schema(
  {
    coins: {
      type: Number,
      required: true,
      unique: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
        isHot: {                     // ✅ ADD THIS
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoinPack", coinPackSchema);