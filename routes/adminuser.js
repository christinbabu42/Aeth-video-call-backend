const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");


/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard summary for Overview.jsx
 */
router.get("/stats", auth, admin, async (req, res) => {
    console.log("✅ ADMIN ROUTE HIT");
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalHosts = await User.countDocuments({ gender: "female" });
    const onlineHosts = await User.countDocuments({ gender: "female", status: "online", });
    
    // Aggregating wallet data for revenue cards
    const walletStats = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalCoins: { $sum: "$coins" }
        }
      }
    ]);

    const revenue = walletStats[0]?.totalCoins || 0;

    res.json({
      totalUsers,
      totalHosts,
      onlineHosts,
      activeCalls: 0, // Placeholder
      todayRevenue: revenue * 0.02, // Example logic
      totalRevenue: revenue,
      commission: revenue * 0.1,
      pendingPayouts: 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Existing users fetch logic
 */
router.get("/users", auth, admin, async (req, res) => {
  try {
    const usersWithWallet = await User.aggregate([
      {
        $lookup: {
          from: "wallets",
          localField: "_id",
          foreignField: "userId",
          as: "walletData"
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          gender: 1,
          isVerified: 1,
          status: 1,
          profilePic: 1,
          actionstatus: 1,
          createdAt: 1,
          publicId: 1, // ✅ ADD THIS LINE
          coins: { $ifNull: [{ $arrayElemAt: ["$walletData.coins", 0] }, 0] }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);
    res.json({ success: true, data: usersWithWallet });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * @route   PUT /api/admin/users/:id/action
 */
router.put("/users/:id/action", auth, admin, async (req, res) => {
  try {
    const actor = req.user; // admin or superadmin
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🚫 Nobody can modify a superadmin
    if (targetUser.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Superadmin role cannot be modified",
      });
    }

    // 🚫 Role change protection
    if (req.body.role) {
      // Only superadmin can assign admin or superadmin
      if (
        actor.role !== "superadmin" &&
        ["admin", "superadmin"].includes(req.body.role)
      ) {
        return res.status(403).json({
          success: false,
          message: "Only superadmin can assign admin roles",
        });
      }
    }

    Object.assign(targetUser, req.body);
    await targetUser.save();

    res.json({ success: true, user: targetUser });
  } catch (error) {
    console.error("Admin action error:", error);
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

router.delete("/user/:id", auth, admin, async (req, res) => {
  try {
    const actor = req.user; // logged-in admin
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🚫 NEVER allow deleting superadmin
    if (targetUser.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Superadmin cannot be deleted",
      });
    }

    // 🚫 Admin cannot delete another admin
    if (actor.role === "admin" && targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Only superadmin can delete admins",
      });
    }

    // ✅ Delete wallet + user
    await Wallet.deleteOne({ userId: targetUser._id });
    await User.deleteOne({ _id: targetUser._id });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

module.exports = router;