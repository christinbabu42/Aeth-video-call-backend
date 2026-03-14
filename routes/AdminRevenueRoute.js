const express = require("express");
const router = express.Router();
const Call = require("../models/Call");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

// GET ALL REVENUE DATA (ADMIN)
router.get("/", auth, admin, async (req, res) => {
  try {
    const calls = await Call.find({ status: "completed" })
      .populate("callerId", "name email")
      .populate("hostId", "name email")
      .sort({ createdAt: -1 });

    // 🔥 Calculate totals
    const totals = calls.reduce(
      (acc, call) => {
        acc.totalCoins += call.totalCoinsSpent || 0;
        acc.totalHostEarnings += call.hostEarnings || 0;
        acc.totalCommission += call.platformCommission || 0;
        acc.totalHostRupees += call.hostEarningsInRupees || 0;
        acc.totalPlatformRupees += call.platformFeeInRupees || 0;
        return acc;
      },
      {
        totalCoins: 0,
        totalHostEarnings: 0,
        totalCommission: 0,
        totalHostRupees: 0,
        totalPlatformRupees: 0,
      }
    );

    res.json({
      success: true,
      totals,
      calls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;