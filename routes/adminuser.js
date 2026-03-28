const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Income = require("../models/Income");
const RateCoinConfig = require("../models/RateCoinConfig");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");
const Call = require("../models/Call");
const WalletTransaction = require("../models/WalletTransaction");

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard summary for Overview.jsx with precise Revenue Logic
 */
router.get("/stats", auth, admin, async (req, res) => {
  console.log("✅ ADMIN STATS ROUTE HIT with Range:", req.query.range);
  try {
    const { range, startDate, endDate } = req.query;

    const totalUsers = await User.countDocuments({ role: "user" });
    const totalHosts = await User.countDocuments({ gender: "female" });
    const onlineHosts = await User.countDocuments({ gender: "female", status: "online" });
    
    const config = await RateCoinConfig.findOne();
    const userCoinValue = config?.userCoinValue || 1;
    const hostCoinValue = config?.hostCoinValue || 0.45;

    // --- 🕒 1. DYNAMIC DATE FILTER LOGIC ---
    let matchQuery = { status: "completed" };

    const now = new Date();
    const startOfToday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    startOfToday.setHours(0, 0, 0, 0);

    if (range === '5min') {
      matchQuery["createdAt"] = { $gte: new Date(now.getTime() - 5 * 60000) };
    } else if (range === 'today') {
      matchQuery["createdAt"] = { $gte: startOfToday };
    } else if (range === '2days') {
      const twoDaysAgo = new Date(startOfToday);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
      matchQuery["createdAt"] = { $gte: twoDaysAgo };
    } else if (range === '1week') {
      const oneWeekAgo = new Date(startOfToday);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      matchQuery["createdAt"] = { $gte: oneWeekAgo };
    } else if (range === '1month') {
      const oneMonthAgo = new Date(startOfToday);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      matchQuery["createdAt"] = { $gte: oneMonthAgo };
    } else if (range === '6months') {
      const sixMonthsAgo = new Date(startOfToday);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      matchQuery["createdAt"] = { $gte: sixMonthsAgo };
    } else if (range === '1year') {
      const oneYearAgo = new Date(startOfToday);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      matchQuery["createdAt"] = { $gte: oneYearAgo };
    } else if (range === 'custom' && startDate && endDate) {
      matchQuery["createdAt"] = { 
        $gte: new Date(startDate), 
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) 
      };
    }

    // --- 📊 2. AGGREGATE FILTERED STATS (From Call Schema) ---
    const periodStats = await Call.aggregate([
      { $match: matchQuery }, 
      {
        $group: {
          _id: null,
          periodRevenue: { $sum: { $multiply: ["$totalCoinsSpent", userCoinValue] } },
          periodCommission: { $sum: "$platformFeeInRupees" }
        }
      }
    ]);

    // --- 🎁 2.5 GIFT COMMISSION (From WalletTransaction Schema) ---
    const giftMatch = {
      category: "GIFT_PURCHASE",
      type: "DEBIT",
      status: "SUCCESS"
    };

    if (matchQuery.createdAt) {
      giftMatch.createdAt = matchQuery.createdAt;
    }

    const giftAgg = await WalletTransaction.aggregate([
      { $match: giftMatch },
      {
        $group: {
          _id: null,
          totalGiftCoins: { $sum: "$coins" }
        }
      }
    ]);

    const totalGiftCoins = giftAgg[0]?.totalGiftCoins || 0;
    
    // Calculate ₹ earnings from gifts (Coins * hostValue * platformCommissionRate)
    const giftCommission = totalGiftCoins * hostCoinValue * (config?.giftCommissionRate || 0);

    // --- 📊 3. AGGREGATE ALL-TIME STATS ---
    const totalStats = await Call.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ["$totalCoinsSpent", userCoinValue] } }
        }
      }
    ]);

    const stats = periodStats[0] || { periodRevenue: 0, periodCommission: 0 };
    const allTime = totalStats[0] || { totalRevenue: 0 };

    // 🔥 Final Commission Merge (Call Commission + Gift Commission)
    const totalCommission = (stats.periodCommission || 0) + giftCommission;

    // --- 💰 4. PENDING PAYOUTS ---
    const pendingWithdrawals = await Income.aggregate([
      { $unwind: "$history" },
      { 
        $match: { 
          "history.type": "withdrawal", 
          "history.status": { $in: ["pending", "processing"] } 
        } 
      },
      {
        $group: {
          _id: null,
          totalPendingCoins: { $sum: "$history.amount" }
        }
      }
    ]);

    const pendingPayouts = (pendingWithdrawals[0]?.totalPendingCoins || 0) * hostCoinValue;

    res.json({
      totalUsers,
      totalHosts,
      onlineHosts,
      activeCalls: 0,
      todayRevenue: Number(stats.periodRevenue.toFixed(2)),
      totalRevenue: Number(allTime.totalRevenue.toFixed(2)),
      commission: Number(totalCommission.toFixed(2)), // Calls + Gifts
      giftCommission: Number(giftCommission.toFixed(2)), // Gift Only Breakdown
      pendingPayouts: Number(pendingPayouts.toFixed(2))
    });

  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Fetch all users with their current wallet balances
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
          publicId: 1,
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
 * @desc    Update user details (Suspend, Verify, Change Role)
 */
router.put("/users/:id/action", auth, admin, async (req, res) => {
  try {
    const actor = req.user; 
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (targetUser.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Superadmin role cannot be modified",
      });
    }

    if (req.body.role) {
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

/**
 * @route   DELETE /api/admin/user/:id
 * @desc    Delete user and their associated wallet
 */
router.delete("/user/:id", auth, admin, async (req, res) => {
  try {
    const actor = req.user; 
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (targetUser.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Superadmin cannot be deleted",
      });
    }

    if (actor.role === "admin" && targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Only superadmin can delete admins",
      });
    }

    await Wallet.deleteOne({ userId: targetUser._id });
    await User.deleteOne({ _id: targetUser._id });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

module.exports = router;