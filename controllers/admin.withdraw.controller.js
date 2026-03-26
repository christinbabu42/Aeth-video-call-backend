const Income = require("../models/Income");
const User = require("../models/User");
const { payoutToUser } = require("../services/stripePayout.service");

/**
 * GET all pending withdrawals
 */
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const users = await Income.find({
      "history.type": "withdrawal",
      "history.status": "pending"
    }).populate("userId", "name email");

    const pending = users.map(income => {
      const withdrawal = income.history.find(
        h => h.type === "withdrawal" && h.status === "pending"
      );

      return {
        userId: income.userId._id,
        name: income.userId.name,
        email: income.userId.email,
        coins: withdrawal.amount,
        rupees: withdrawal.amount * rateConfig.hostCoinValue, // ✅ add this
        createdAt: withdrawal.createdAt
      };
    });

    res.json({ success: true, pending });
  } catch (err) {
    console.error("Admin Withdraw Fetch Error:", err);
    res.status(500).json({ success: false });
  }
};

/**
 * APPROVE withdrawal
 */
exports.approveWithdrawal = async (req, res) => {

  try {
    const { userId } = req.params;

    const income = await Income.findOne({ userId });
    const user = await User.findById(userId);

    if (!income || !user) {
      return res.status(404).json({ message: "User/Income not found" });
    }

    const withdrawal = income.history.find(
      h => h.type === "withdrawal" && h.status === "pending"
    );

    if (!withdrawal) {
      return res.status(400).json({ message: "No pending withdrawal" });
    }

    // 🔁 STRIPE MODE
if (process.env.PAYOUT_MODE === "stripe") {
  if (!user.stripeAccountId) {
    return res.status(400).json({
      message: "Stripe onboarding not completed"
    });
  }

  try {
    await payoutToUser({
      coins: withdrawal.amount,
      stripeAccountId: user.stripeAccountId
    });

    withdrawal.description = "Paid via Stripe";

  } catch (err) {
    console.error("❌ Stripe payout failed:", err.message);

    return res.status(500).json({
      message: "Stripe payout failed",
      error: err.message
    });
  }
}

    // ✋ MANUAL MODE
    if (process.env.PAYOUT_MODE === "manual") {
      withdrawal.description = "Manual payout by admin";
      console.log("⚠️ Manual payout required for user:", userId);
    }

    withdrawal.status = "completed";
    income.lockedEarnings -= withdrawal.amount;

    await income.save();

    res.json({
      success: true,
      message:
        process.env.PAYOUT_MODE === "stripe"
          ? "Paid via Stripe"
          : "Marked as paid (Manual payout)"
    });

  } catch (err) {
    console.error("Withdraw Error:", err);
    res.status(500).json({ message: "Withdrawal failed" });
  }
};

/**
 * REJECT withdrawal (refund coins)
 */
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { userId } = req.params;
    const income = await Income.findOne({ userId });

    if (!income) {
      return res.status(404).json({ success: false, message: "Income not found" });
    }

    const withdrawal = income.history.find(
      h => h.type === "withdrawal" && h.status === "pending"
    );

    if (!withdrawal) {
      return res.status(400).json({
        success: false,
        message: "No pending withdrawal"
      });
    }

    // Refund coins
    income.totalEarnings += withdrawal.amount;
    income.lockedEarnings -= withdrawal.amount;

    withdrawal.status = "failed";
    withdrawal.description += " (Rejected by admin)";

    await income.save();

    res.json({
      success: true,
      message: "Withdrawal rejected and coins refunded"
    });

  } catch (err) {
    console.error("Reject Withdraw Error:", err);
    res.status(500).json({ success: false });
  }
};
