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

    // Create record with defaults if it does not exist yet
    if (!income) {
      income = await Income.create({
        userId,
        availableCoins: 0,
        totalCoins: 0,
        totalRupees: 0,
        liveCoins: 0,
        giftCoins: 0,
        callCoins: 0,
        withdrawnCoins: 0,
        pendingWithdrawalCoins: 0,
        liveMinutes: 0,
        totalCalls: 0,
        totalGifts: 0,
        withdrawalHistory: []
      });
    }

    // ✅ GET USER DATA
    const user = await User.findById(userId).select("bankAdded");

    // ✅ GET CONFIG FROM DB
    const rateConfig = await RateCoinConfig.findOne();
    const minWithdrawal = rateConfig?.minimumWithdrawalAmount || 500;
    const hostRate = rateConfig?.hostCoinValue || 0.45;

    // 🔥 Direct breakdown lookup from stored fields (O(1) constant time)
    const breakdown = {
      call: income.callCoins || 0,
      gift: income.giftCoins || 0,
      live: income.liveCoins || 0
    };

    // Sort withdrawal history from newest to oldest
    const historyList = income.withdrawalHistory || income.history || [];
    const sortedHistory = [...historyList].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,

      // Balances
      totalEarnings: income.availableCoins ?? income.totalEarnings ?? 0,
      totalCoins: income.totalCoins || 0,
      totalRupees: income.totalRupees || 0,
      availableCoins: income.availableCoins || 0,
      withdrawnCoins: income.withdrawnCoins || 0,
      pendingWithdrawalCoins: income.pendingWithdrawalCoins || 0,

      // Breakdown
      breakdown,
      liveCoins: income.liveCoins || 0,
      giftCoins: income.giftCoins || 0,
      callCoins: income.callCoins || 0,

      // Statistics
      liveMinutes: income.liveMinutes || 0,
      totalCalls: income.totalCalls || 0,
      totalGifts: income.totalGifts || 0,

      // Config & User Metadata
      bankAdded: user?.bankAdded || false,
      minWithdrawal,
      hostRate,

      // Withdrawal History (Mapped with production fallback)
      history: sortedHistory.map(item => ({
        ...(item._doc || item),
        rupees: item.rupees || (item.amount * hostRate)
      })),
      withdrawalHistory: sortedHistory.map(item => ({
        ...(item._doc || item),
        rupees: item.rupees || (item.amount * hostRate)
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

    // ✅ STEP 2: Check if user has enough available balance
    const currentAvailable = income.availableCoins ?? income.totalEarnings ?? 0;
    if (currentAvailable < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Deduct from available balance & move to pending withdrawal coins
    income.availableCoins = currentAvailable - amount;
    income.pendingWithdrawalCoins = (income.pendingWithdrawalCoins || 0) + amount;

    // Legacy sync
    if (income.totalEarnings !== undefined) {
      income.totalEarnings = income.availableCoins;
    }
    if (income.lockedEarnings !== undefined) {
      income.lockedEarnings = (income.lockedEarnings || 0) + amount;
    }

    // ✅ Calculation for record (Total ₹ to be paid to host)
    const withdrawalRupees = amount * hostRate;

    // Ensure array initialization
    if (!income.withdrawalHistory) {
      income.withdrawalHistory = [];
    }

    income.withdrawalHistory.push({
      type: "withdrawal",
      amount: amount,
      rupees: withdrawalRupees, // ✅ Store rupees for withdrawal auditing
      status: "pending",
      description: "Withdrawal request submitted",
      createdAt: new Date()
    });

    await income.save();

    res.status(200).json({ 
      success: true, 
      message: "Withdrawal request submitted successfully",
      newBalance: income.availableCoins 
    });

  } catch (error) {
    console.error("Withdraw Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};