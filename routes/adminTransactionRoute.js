const express = require("express");
const router = express.Router();
const WalletTransaction = require("../models/WalletTransaction");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

/**
 * @route   GET /api/wallet/admin/transactions
 * @desc    Get all wallet transactions with user details
 */
router.get("/transactions", auth, admin, async (req, res) => {
  try {
    const transactions = await WalletTransaction.find()
      .populate("userId", "nickname name profilePic email gender") 
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error("❌ Admin Transaction Fetch Error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: "Server Error: Could not fetch transactions." 
    });
  }
});


/**
 * @route   DELETE /api/wallet/admin/transactions/:id
 * @desc    Delete a specific transaction record
 */
router.delete("/transactions/:id", auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTx = await WalletTransaction.findByIdAndDelete(id);

    if (!deletedTx) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    res.status(200).json({ success: true, message: "Transaction record deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;