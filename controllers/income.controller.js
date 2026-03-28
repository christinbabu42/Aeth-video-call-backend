const Income = require("../models/Income");
const User = require("../models/User"); 
const config = require("../config/RateCoinConfig");

// ✅ Define constant at the top
const MIN_WITHDRAW_COINS = 2000;

/**
 * GET Income details and breakdown
 */
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

    // ✅ GET USER DATA
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
      bankAdded: user?.bankAdded || false,
      minWithdrawal: MIN_WITHDRAW_COINS, // ✅ Inform frontend of the limit
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

/**
 * POST Create Withdrawal Request
 */
exports.withdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    const income = await Income.findOne({ userId });

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    // ✅ STEP 1: Check Minimum Threshold (2000 coins)
    if (amount < MIN_WITHDRAW_COINS) {
      return res.status(400).json({
        code: "MIN_WITHDRAW",
        message: `Minimum withdrawal is ${MIN_WITHDRAW_COINS} coins (₹${(MIN_WITHDRAW_COINS * config.hostCoinValue).toFixed(0)})`
      });
    }

    // ✅ STEP 2: Check if user has enough balance
    if (income.totalEarnings < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Logic to deduct and add to history
    income.totalEarnings -= amount;
    
    // Safety: ensure lockedEarnings field exists if you use it for "Processing" status
    if (income.lockedEarnings !== undefined) {
      income.lockedEarnings += amount;
    }

    income.history.push({
      type: "withdrawal",
      amount: amount,
      status: "pending",
      description: "Withdrawal request submitted",
      createdAt: new Date()
    });

    await income.save();

    res.status(200).json({ 
      success: true, 
      message: "Withdrawal request submitted successfully",
      newBalance: income.totalEarnings 
    });

  } catch (error) {
    console.error("Withdraw Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};