const Income = require("../models/Income");

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

    // 🔥 calculate breakdown from history
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

    res.status(200).json({
      success: true,
      totalEarnings: income.totalEarnings,
      breakdown,
      history: income.history.sort((a, b) => b.createdAt - a.createdAt)
    });

  } catch (error) {
    console.error("Income Controller Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
