const express = require("express");
const router = express.Router();
const WalletTransaction = require("../models/WalletTransaction");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");
const Transaction = require("../models/Transaction");

/**
 * @route   GET /api/wallet/admin/transactions
 * @desc    Get all wallet transactions with user details
 */
router.get("/transactions", auth, admin, async (req, res) => {
  try {
    // 1. Fetch from the Transaction collection
    // 2. Populate 'user' (matching the field name in your schema)
    const transactions = await Transaction.find()
      .populate("user", "nickname name profilePic email gender") 
      .sort({ timestamp: -1 });

    // 3. Map the data so the Frontend understands it perfectly
    const formattedData = transactions.map(tx => ({
      _id: tx._id,
      userId: tx.user, // Send the populated user object as userId
      category: tx.type === 'purchase' ? 'COIN_PURCHASE' : 
                tx.type === 'gift_sent' ? 'GIFT_PURCHASE' : 
                tx.type === 'gift_received' ? 'GIFT_RECEIVED' : tx.type.toUpperCase(),
      // Logic for UI coloring (Credit vs Debit)
      type: (tx.type === 'purchase' || tx.type === 'gift_received' || tx.type === 'bonus') ? 'CREDIT' : 'DEBIT',
      coins: tx.coins,
      amount: tx.amountPaid || 0,
      createdAt: tx.timestamp, // Map timestamp to createdAt
      status: tx.status
    }));

    res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
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