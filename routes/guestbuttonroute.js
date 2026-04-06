const express = require("express");
const GlobalConfig = require("../models/GlobalConfig.js");
const User = require("../models/User.js"); 
const Wallet = require("../models/Wallet.js"); // ✅ Import Wallet model
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

    // 1. Create the Guest User
    const guestUser = await User.create({
      name: `Guest_${Math.floor(1000 + Math.random() * 9000)}`,
      email: `guest_${Date.now()}@aethmeet.com`,
      profilePic: "https://ui-avatars.com/api/?name=Guest&background=random",
      onboardingCompleted: false
    });

    // 2. ✅ Create Wallet with 50,000 free coins for the Reviewer
    await Wallet.create({
      userId: guestUser._id,
      coins: 50000 
    });

    const token = jwt.sign({ id: guestUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    
    res.json({ 
      success: true, 
      token, 
      user: guestUser 
    });
    
  } catch (err) {
    console.error("Guest login error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;