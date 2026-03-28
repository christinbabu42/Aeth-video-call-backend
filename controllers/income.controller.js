const Income = require("../models/Income");
const User = require("../models/User"); 
const config = require("../config/RateCoinConfig");
const RateCoinConfig = require("../models/RateCoinConfig");

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

    // ✅ GET CONFIG FROM DB (Replaces hardcoded MIN_WITHDRAW_COINS)
    const rateConfig = await RateCoinConfig.findOne();
    const minWithdrawal = rateConfig?.minimumWithdrawalAmount || 500;
    const hostRate = rateConfig?.hostCoinValue || 0.45;

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
      minWithdrawal, // ✅ dynamic limit sent to frontend
      history: sortedHistory.map(item => ({
        ...item._doc,
        rupees: item.amount * hostRate // ✅ uses dynamic hostRate
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
    
    // ✅ GET LATEST CONFIG FOR VALIDATION
    const rateConfig = await RateCoinConfig.findOne();
    const minWithdrawal = rateConfig?.minimumWithdrawalAmount || 500;
    const hostRate = rateConfig?.hostCoinValue || 0.45;

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    // ✅ STEP 1: Check Dynamic Minimum Threshold
    if (amount < minWithdrawal) {
      return res.status(400).json({
        code: "MIN_WITHDRAW",
        message: `Minimum withdrawal is ${minWithdrawal} coins (₹${(minWithdrawal * hostRate).toFixed(0)})`
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