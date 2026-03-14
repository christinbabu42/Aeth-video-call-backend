// routes/adminPurchaseCoinRoute.js
const express = require("express");
const router = express.Router();
const CoinPack = require("../models/CoinPack");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

/**
 * @route   GET /api/admin/coin-packs
 * @desc    Get all coin packs (admin)
 */
router.get("/", auth, admin,async (req, res) => {
  try {
    const packs = await CoinPack.find().sort({ coins: 1 });
    res.json({ success: true, packs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/coin-packs
 * @desc    Add new coin pack
 */
router.post("/",auth, admin, async (req, res) => {
  try {
    const { coins, rate , isHot  } = req.body;

    if (!coins || !rate) {
      return res.status(400).json({ message: "Coins and rate required" });
    }

    const existing = await CoinPack.findOne({ coins });
    if (existing) {
      return res.status(400).json({ message: "Coin pack already exists" });
    }

    const pack = await CoinPack.create({ coins, rate, isHot: isHot || false });

    res.json({ success: true, pack });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/coin-packs/:id
 * @desc    Update coin pack
 */
router.put("/:id",auth, admin, async (req, res) => {
  try {
    const { coins, rate, isActive, isHot } = req.body;

    const pack = await CoinPack.findByIdAndUpdate(
      req.params.id,
      { coins, rate, isActive, isHot },
      { new: true }
    );

    if (!pack) {
      return res.status(404).json({ message: "Pack not found" });
    }

    res.json({ success: true, pack });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/admin/coin-packs/:id
 * @desc    Delete coin pack
 */
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const pack = await CoinPack.findByIdAndDelete(req.params.id);

    if (!pack) {
      return res.status(404).json({ message: "Pack not found" });
    }

    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/users/:id/suspend", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { actionstatus: "suspended" },
      { new: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.patch("/users/:id/ban", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { actionstatus: "banned" },
      { new: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.patch("/users/:id/reactivate", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { actionstatus: "active" },
      { new: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
module.exports = router;