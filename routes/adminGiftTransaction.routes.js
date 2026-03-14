const express = require("express");
const router = express.Router();
const GiftTransaction = require("../models/GiftTransaction");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

router.get("/", auth, admin, async (req, res) => {
  try {
    const tx = await GiftTransaction.find()
      .populate("sender", "nickname")
      .populate("receiver", "nickname")
      .populate("gift")
      .sort({ createdAt: -1 });

    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch" });
  }
});

module.exports = router;
