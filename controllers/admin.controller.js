const User = require("../models/User");
const Call = require("../models/Call");
const WalletTransaction = require("../models/WalletTransaction");

exports.getAdminStats = async (req, res) => {
  try {
    // ===== USERS =====
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalHosts = await User.countDocuments({ role: "host" });
    const onlineHosts = await User.countDocuments({
      role: "host",
      status: "online",
    });

    // ===== CALLS =====
    const activeCalls = await Call.countDocuments({ status: "active" });

    // ===== REVENUE =====
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRevenueAgg = await WalletTransaction.aggregate([
      {
        $match: {
          type: "call",
          createdAt: { $gte: todayStart },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalRevenueAgg = await WalletTransaction.aggregate([
      {
        $match: { type: "call" },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const commissionAgg = await WalletTransaction.aggregate([
      {
        $match: { type: "commission" },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      totalUsers,
      totalHosts,
      onlineHosts,
      activeCalls,
      todayRevenue: todayRevenueAgg[0]?.total || 0,
      totalRevenue: totalRevenueAgg[0]?.total || 0,
      commission: commissionAgg[0]?.total || 0,
      pendingPayouts: 0, // customize later
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};
