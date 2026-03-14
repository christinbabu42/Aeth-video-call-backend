const express = require("express");
const router = express.Router(); 
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const auth = require("../middlewares/auth");
const User = require("../models/User");

// GET /api/wallet/:userId?context=settings
router.get("/:userId", auth, async (req, res) => {
  try {
    const viewer = await User.findById(req.user.id);
    if (!viewer) return res.status(404).json({ coins: 0 });

    const context = req.query.context; // "settings" or "profile"
    const isOwner = req.user.id === req.params.userId;

    // 🔐 ALLOW IF:
    // 1. Owner is checking their own balance (Male or Female)
    // 2. OR the viewer is female (Host/Agency viewing a profile)
    if ((context === "settings" && isOwner) || viewer.gender === "female") {
      const wallet = await Wallet.findOne({ userId: req.params.userId });
      return res.json(wallet || { coins: 0 });
    }

    // Default: Return 0 (e.g., Male viewing another profile)
    res.json({ coins: 0 });
  } catch (err) {
    console.error("Wallet Route Error:", err);
    res.status(500).json({ coins: 0 });
  }
});

// GET Wallet History
router.get("/history/:userId", auth, async (req, res) => {
  try {
    const history = await WalletTransaction.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json([]);
  }
});


module.exports = router;