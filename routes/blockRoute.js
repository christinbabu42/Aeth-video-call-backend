const express = require("express");
const router = express.Router();
const BlockedUser = require("../models/Block");
const auth = require("../middlewares/auth"); // ✅ correct
const User = require("../models/User");

// POST /api/block/:userId
// Block a user
router.post("/:userId", auth, async (req, res) => {
  try {
    const blocker = req.user;
    const { userId } = req.params;

    if (blocker._id.toString() === userId) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const alreadyBlocked = await BlockedUser.findOne({
      blocker: blocker._id,
      blocked: userId,
    });

    if (alreadyBlocked) {
      return res.status(400).json({ success: false, message: "User already blocked" });
    }

    const newBlock = await BlockedUser.create({
      blocker: blocker._id,
      blocked: userId,
    });

    res.json({ success: true, message: "User blocked successfully", block: newBlock });
  } catch (err) {
    console.error("Block user error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET blocked users for current user
router.get("/", auth, async (req, res) => {
  try {
    const blockedUsers = await BlockedUser.find({ blocker: req.user._id }).populate("blocked", "name nickname profilePic");
    res.json({ success: true, blockedUsers });
  } catch (err) {
    console.error("Fetch blocked users error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch blocked users." });
  }
});

// DELETE /api/block/:userId
router.delete("/:userId", auth, async (req, res) => {
  try {
    await BlockedUser.findOneAndDelete({
      blocker: req.user._id,
      blocked: req.params.userId
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Unblock error:", err);
    res.status(500).json({ success: false });
  }
});

// CHECK BLOCK STATUS
// CHECK BLOCK STATUS
router.get("/check/:userId", auth, async (req, res) => {
  try {
    const currentUser = req.user._id;
    const otherUser = req.params.userId;

    const blockRecord = await BlockedUser.findOne({
      $or: [
        { blocker: currentUser, blocked: otherUser },
        { blocker: otherUser, blocked: currentUser }
      ]
    });

    if (!blockRecord) {
      return res.json({ blocked: false, isBlocker: false });
    }

    const isBlocker = blockRecord.blocker.toString() === currentUser.toString();

    res.json({ blocked: true, isBlocker });
  } catch (err) {
    console.error("Block check error:", err);
    res.status(500).json({ blocked: false, isBlocker: false });
  }
});

module.exports = router;