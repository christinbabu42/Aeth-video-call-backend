const Income = require("../models/Income");
const { getRateCoinConfig } = require("../config/RateCoinConfig");

const MIN_WITHDRAW_COINS = 50;

exports.requestWithdraw = async (req, res) => {
  const rateConfig = await getRateCoinConfig();
const coinToRupee = rateConfig.hostCoinValue;
const minWithdraw = rateConfig.minimumWithdrawalAmount;
  try {
    const userId = req.user.id;

    const income = await Income.findOne({ userId });
    if (!income || income.totalEarnings < minWithdraw) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance for withdrawal"
      });
    }

    const coins = income.totalEarnings;
    const rupees = Math.floor(coins * coinToRupee);

    // 🔒 Lock coins
    income.totalEarnings = 0;
    income.lockedEarnings += coins;

    income.history.push({
      amount: coins,
      type: "withdrawal",
      status: "pending",
      description: `Withdrawal request ≈ ₹${rupees}`
    });

    await income.save();

    res.json({
      success: true,
      message: "Withdrawal request submitted",
      rupees
    });

  } catch (err) {
    console.error("Withdraw Error:", err);
    res.status(500).json({ success: false });
  }
};
