const Income = require("../models/Income");
const User = require("../models/User"); // ✅ ADD THIS
const config = require("../config/RateCoinConfig");

exports.getIncome = async (req, res) => {
  try {
    const userId = req.user.id;

    let income = await Income.findOne({ userId });

    // create if not exists
    if (!income) {
      income = await Income.create({
        userId,
        totalEarnings: 0,
        history: []
      });
    }

    // ✅ GET USER DATA (VERY IMPORTANT)
    const user = await User.findById(userId).select("bankAdded");

    // 🔥 calculate breakdown
    const breakdown = {
      call: 0,
      gift: 0,
      live: 0
    };

    income.history.forEach(item => {
      if (item.type === "call") breakdown.call += item.amount;
      if (item.type === "gift") breakdown.gift += item.amount;
      if (item.type === "live") breakdown.live += item.amount;
    });

    const sortedHistory = income.history.sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({
      success: true,
      totalEarnings: income.totalEarnings,
      breakdown,

      // ✅ ADD THIS LINE
      bankAdded: user?.bankAdded || false,

      history: sortedHistory.map(item => ({
        ...item._doc,
        rupees: item.amount * (config.hostCoinValue || 0.45)
      }))
    });

  } catch (error) {
    console.error("Income Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};