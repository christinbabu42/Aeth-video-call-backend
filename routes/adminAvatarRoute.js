const express = require("express");
const router = express.Router();
const Avatar = require("../models/Avatar");

// ✅ GET ALL AVATARS
router.get("/", async (req, res) => {
  try {
    const avatars = await Avatar.find().sort({ createdAt: -1 });
    res.json({ success: true, avatars });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ ADD AVATAR
router.post("/", async (req, res) => {
  try {
    const { url, gender } = req.body;

    if (!url || !gender) {
      return res.status(400).json({ message: "URL & gender required" });
    }

    const avatar = new Avatar({ url, gender });
    await avatar.save();

    res.json({ success: true, avatar });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ UPDATE AVATAR
router.put("/:id", async (req, res) => {
  try {
    const { url, gender } = req.body;

    const updated = await Avatar.findByIdAndUpdate(
      req.params.id,
      { url, gender },
      { new: true }
    );

    res.json({ success: true, avatar: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ DELETE AVATAR
router.delete("/:id", async (req, res) => {
  try {
    await Avatar.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Avatar deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;