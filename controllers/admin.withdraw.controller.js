const Income = require("../models/Income");
const User = require("../models/User");
const { getRateCoinConfig } = require("../config/RateCoinConfig");

/**
 * GET all withdrawals (Pending & Processing)
 */
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const rateConfig = await getRateCoinConfig();
    const users = await Income.find({
      "history.type": "withdrawal",
      "history.status": { $in: ["pending", "processing"] } // Fetch both
    }).populate("userId", "name email upiId bankDetails paypalEmail country");

    const pending = [];
    users.forEach(income => {
      const activeWithdrawals = income.history.filter(
        h => h.type === "withdrawal" && (h.status === "pending" || h.status === "processing")
      );

      activeWithdrawals.forEach(withdrawal => {
        pending.push({
          withdrawalId: withdrawal._id,
          userId: income.userId._id,
          name: income.userId.name,
          email: income.userId.email,
          coins: withdrawal.amount,
          status: withdrawal.status, // ✅ Added status
          rupees: (withdrawal.amount * rateConfig.hostCoinValue).toFixed(2),
          createdAt: withdrawal.createdAt,
          upiId: income.userId.upiId,
          bankDetails: income.userId.bankDetails,
          paypalEmail: income.userId.paypalEmail
        });
      });
    });

    res.json({ success: true, pending });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * STEP 5: APPROVE -> Move to "processing"
 */
// 📁 backend/controllers/withdrawController.js

exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const income = await Income.findOne({
      "history._id": withdrawalId
    });

    const withdrawal = income.history.id(withdrawalId);

    if (!withdrawal || withdrawal.status !== "pending") {
      return res.status(400).json({ message: "No pending request" });
    }

    withdrawal.status = "processing";
    withdrawal.description = "Approved - pending manual payout";

    await income.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Approval failed" });
  }
};
/**
 * STEP 6: MARK AS PAID -> Move to "completed"
 */
// 📁 backend/controllers/withdrawController.js

exports.completeWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const income = await Income.findOne({
      "history._id": withdrawalId
    });

    const withdrawal = income.history.id(withdrawalId);

    if (!withdrawal || withdrawal.status !== "processing") {
      return res.status(400).json({
        message: "No processing withdrawal found"
      });
    }

    withdrawal.status = "completed";
    withdrawal.description = "Paid manually by admin";

    await income.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
};
/**
 * REJECT withdrawal
 */
// 📁 backend/controllers/withdrawController.js

exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const income = await Income.findOne({
      "history._id": withdrawalId
    });

    const withdrawal = income.history.id(withdrawalId);

    if (!withdrawal) {
      return res.status(400).json({ message: "No withdrawal found" });
    }

    // Refund coins
    income.totalEarnings += withdrawal.amount;
    income.lockedEarnings -= withdrawal.amount;

    withdrawal.status = "failed";
    withdrawal.description = "Rejected by admin";

    await income.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};