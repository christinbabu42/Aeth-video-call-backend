const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  platformCommissionPercent: { type: Number, default: 30 },
  minWithdrawalAmount: { type: Number, default: 500 },
  minCallRate: { type: Number, default: 20 },
  maxCallRate: { type: Number, default: 500 },
  maintenanceMode: { type: Boolean, default: false },
  dailyEarningCap: { type: Number, default: 0 } // 0 means unlimited
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);