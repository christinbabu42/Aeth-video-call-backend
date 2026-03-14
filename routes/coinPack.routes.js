const express = require("express");
const router = express.Router();
const CoinPack = require("../models/CoinPack");

// Get active coin packs
router.get("/", async (req, res) => {
  try {
    const packs = await CoinPack.find({ isActive: true }).sort({ coins: 1 });
    res.json({ success: true, packs });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;