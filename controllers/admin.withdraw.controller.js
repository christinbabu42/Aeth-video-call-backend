const Income = require("../models/Income");
const User = require("../models/User");
const { getRateCoinConfig } = require("../config/RateCoinConfig");

/**
 * GET all withdrawals (Pending & Processing)
 */
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const rateConfig = await getRateCoinConfig();
    
    // ✅ Ensure country and countryName are selected/populated
    const users = await Income.find({
      "history.type": "withdrawal",
      "history.status": { $in: ["pending", "processing"] }
    }).populate("userId", "name email phone upiId bankDetails paypalEmail country countryName");

    const pending = [];
    users.forEach(income => {
      if (!income.userId) return; // Safety check

      const activeWithdrawals = income.history.filter(
        h => h.type === "withdrawal" && (h.status === "pending" || h.status === "processing")
      );

      activeWithdrawals.forEach(withdrawal => {
        pending.push({
          withdrawalId: withdrawal._id,
          userId: income.userId._id,
          name: income.userId.name,
          email: income.userId.email,
          phone: income.userId.phone, 
          coins: withdrawal.amount,
          status: withdrawal.status,
          rupees: (withdrawal.amount * rateConfig.hostCoinValue).toFixed(2),
          createdAt: withdrawal.createdAt,
          upiId: income.userId.upiId,
          bankDetails: income.userId.bankDetails,
          paypalEmail: income.userId.paypalEmail,
          country: income.userId.country,
          countryName: income.userId.countryName 
        });
      });
    });

    res.json({ success: true, pending });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * APPROVE -> Move to "processing"
 */
exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const income = await Income.findOne({
      "history._id": withdrawalId
    });

    if (!income) {
      return res.status(404).json({ message: "Income not found" });
    }

    // ✅ FIX: Use .find() and .toString() for string/ID compatibility
    const withdrawal = income.history.find(
      h => h._id.toString() === withdrawalId
    );

    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: "Not a pending request" });
    }

    withdrawal.status = "processing";
    withdrawal.description = "Approved - pending manual payout";

    await income.save();
    res.json({ success: true });

  } catch (err) {
    console.error("Approve error:", err); // 🔥 Detailed log
    res.status(500).json({ message: "Approval failed", error: err.message });
  }
};

/**
 * MARK AS PAID -> Move to "completed"
 */
exports.completeWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const income = await Income.findOne({
      "history._id": withdrawalId
    });

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    // ✅ FIX: Use .find() and .toString()
    const withdrawal = income.history.find(
      h => h._id.toString() === withdrawalId
    );

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
    console.error("Complete error:", err);
    res.status(500).json({ message: "Failed to mark as paid", error: err.message });
  }
};

/**
 * REJECT withdrawal
 */
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    const income = await Income.findOne({
      "history._id": withdrawalId
    });

    if (!income) {
      return res.status(404).json({ message: "Income record not found" });
    }

    // ✅ FIX: Use .find() and .toString()
    const withdrawal = income.history.find(
      h => h._id.toString() === withdrawalId
    );

    if (!withdrawal) {
      return res.status(400).json({ message: "No withdrawal found" });
    }

    // Refund coins to the user's balance
    income.totalEarnings += withdrawal.amount;
    income.lockedEarnings -= withdrawal.amount;

    withdrawal.status = "failed";
    withdrawal.description = "Rejected by admin";

    await income.save();
    res.json({ success: true });

  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};