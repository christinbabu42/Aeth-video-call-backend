const express = require("express");
const router = express.Router();
const Avatar = require("../models/Avatar");

// GET avatars by gender
router.get("/", async (req, res) => {
  console.log("🔥 Avatar route hit");

  try {
    const { gender } = req.query;

    const filter = gender ? { gender } : {};

    const avatars = await Avatar.find(filter);

    res.json({ success: true, avatars });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;