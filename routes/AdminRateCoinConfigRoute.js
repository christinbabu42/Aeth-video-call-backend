const express = require("express");
const router = express.Router();

const RateCoinConfig = require("../models/RateCoinConfig");
const { clearConfigCache } = require("../config/RateCoinConfig");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

// GET current config
router.get("/", auth, admin, async (req, res) => {
  let config = await RateCoinConfig.findOne();
  if (!config) config = await RateCoinConfig.create({});
  res.json(config);
});

// UPDATE config (Admin)
router.put("/", auth, admin, async (req, res) => {
  const {
    hostCoinValue,
    platformCommissionRate,
    userCoinValue,
    giftCommissionRate,
    minimumWithdrawalAmount // ✅ ADDED
  } = req.body;

  // Existing Commission Validations
  if (
    platformCommissionRate < 0 || platformCommissionRate > 1 ||
    giftCommissionRate < 0 || giftCommissionRate > 1
  ) {
    return res.status(400).json({
      success: false,
      message: "Commission rates must be between 0 and 1"
    });
  }

  // ✅ New Minimum Withdrawal Validation
  if (minimumWithdrawalAmount < 0) {
    return res.status(400).json({
      success: false,
      message: "Minimum withdrawal must be >= 0"
    });
  }

  try {
    const config = await RateCoinConfig.findOneAndUpdate(
      {},
      {
        hostCoinValue,
        platformCommissionRate,
        giftCommissionRate,
        userCoinValue,
        minimumWithdrawalAmount, // ✅ ADDED TO DB UPDATE
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    clearConfigCache();
    res.json({ success: true, message: "Updated", config });
  } catch (err) {
    console.error("RateConfig Update Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;