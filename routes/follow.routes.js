const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const Follow = require("../models/Follow");
const User = require("../models/User");

/**
 * CHECK FOLLOW STATUS
 * GET /api/follow/status/:userId
 */
router.get("/status/:userId", auth, async (req, res) => {
  try {
    const exists = await Follow.exists({
      follower: req.user.id,
      following: req.params.userId,
    });

    res.json({ success: true, isFollowing: !!exists });
  } catch (err) {
    console.error("Follow status error:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * FOLLOW / UNFOLLOW (Toggle)
 * POST /api/follow/:userId
 */
router.post("/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const existing = await Follow.findOne({
      follower: currentUserId,
      following: targetUserId,
    });

    if (existing) {
      // UNFOLLOW
      await Follow.deleteOne({ _id: existing._id });

      await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: -1 },
      });

      await User.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: -1 },
      });

      return res.json({ success: true, followed: false });
    }

    // FOLLOW
    await Follow.create({
      follower: currentUserId,
      following: targetUserId,
    });

    await User.findByIdAndUpdate(currentUserId, {
      $inc: { followingCount: 1 },
    });

    await User.findByIdAndUpdate(targetUserId, {
      $inc: { followersCount: 1 },
    });

    res.json({ success: true, followed: true });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ success: false });
  }
});

// Get list of people I am following
router.get("/following/:userId", auth, async (req, res) => {
  const list = await Follow.find({ follower: req.params.userId }).populate("following", "name nickname profilePic");
  res.json({ success: true, data: list.map(item => item.following) });
});

// Get list of people following me
router.get("/followers/:userId", auth, async (req, res) => {
  const list = await Follow.find({ following: req.params.userId }).populate("follower", "name nickname profilePic");
  res.json({ success: true, data: list.map(item => item.follower) });
});

module.exports = router;
