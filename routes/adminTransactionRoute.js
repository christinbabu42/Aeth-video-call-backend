const express = require("express");
const router = express.Router();
const WalletTransaction = require("../models/WalletTransaction");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");
const Transaction = require("../models/Transaction");

/**
 * @route   GET /api/wallet/admin/transactions
 * @desc    Get all wallet transactions merged from both models
 */
router.get("/transactions", auth, admin, async (req, res) => {
  try {
    // 1. Fetch from both collections simultaneously
    const [walletTx, paymentTx] = await Promise.all([
      WalletTransaction.find()
        .populate("userId", "nickname name profilePic email gender")
        .sort({ createdAt: -1 }),
      Transaction.find()
        .populate("user", "nickname name profilePic email gender")
        .sort({ timestamp: -1 })
    ]);

    // 2. Map WalletTransaction model data
    const formattedWalletData = walletTx.map(tx => ({
      _id: tx._id,
      userId: tx.userId, // Populated via 'userId' ref
      category: tx.category,
      type: tx.type, // CREDIT or DEBIT
      coins: tx.coins,
      amount: tx.amount || 0,
      createdAt: tx.createdAt,
      status: tx.status
    }));

    // 3. Map Transaction model data (mapping types to match frontend)
    const formattedPaymentData = paymentTx.map(tx => ({
      _id: tx._id,
      userId: tx.user, // Populated via 'user' ref
      category: tx.type === 'purchase' ? 'COIN_PURCHASE' : 
                tx.type === 'gift_sent' ? 'GIFT_PURCHASE' : 
                tx.type === 'gift_received' ? 'GIFT_RECEIVED' : tx.type.toUpperCase(),
      type: (tx.type === 'purchase' || tx.type === 'gift_received' || tx.type === 'bonus') ? 'CREDIT' : 'DEBIT',
      coins: tx.coins,
      amount: tx.amountPaid || 0,
      createdAt: tx.timestamp, // Mapping timestamp to createdAt for uniformity
      status: tx.status
    }));

    // 4. Combine and Sort by most recent date
    const combinedData = [...formattedWalletData, ...formattedPaymentData].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,
      count: combinedData.length,
      data: combinedData,
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
 * @desc    Delete a specific transaction record (tries both models)
 */
router.delete("/transactions/:id", auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Attempt to delete from WalletTransaction
    let deletedTx = await WalletTransaction.findByIdAndDelete(id);
    
    // If not found, attempt to delete from Transaction
    if (!deletedTx) {
      deletedTx = await Transaction.findByIdAndDelete(id);
    }

    if (!deletedTx) {
      return res.status(404).json({ success: false, message: "Transaction not found in any record" });
    }

    res.status(200).json({ success: true, message: "Transaction record deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;