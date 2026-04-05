const express = require("express");
const GlobalConfig = require("../models/GlobalConfig.js");
const User = require("../models/User.js"); 
const jwt = require("jsonwebtoken");

const router = express.Router();

// 🟢 GET Status
router.get("/status", async (req, res) => {
  try {
    const config = await GlobalConfig.findOne({ key: "showGuestLogin" });
    res.json({ showGuest: config ? config.value : false });
  } catch (err) {
    res.status(500).json({ success: false, showGuest: false });
  }
});

// 🔵 POST Login
router.post("/", async (req, res) => {
  try {
    const config = await GlobalConfig.findOne({ key: "showGuestLogin" });
    if (config && !config.value) {
      return res.status(403).json({ success: false, message: "Disabled" });
    }

    const guestUser = await User.create({
      name: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
      email: `guest_${Date.now()}@aethmeet.com`,
      role: "guest",
      isGuest: true
    });

    const token = jwt.sign({ id: guestUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ success: true, token, user: guestUser });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;