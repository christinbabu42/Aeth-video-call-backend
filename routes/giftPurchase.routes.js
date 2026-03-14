const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const Gift = require("../models/Gift");
const Wallet = require("../models/Wallet");
const Income = require("../models/Income");
const GiftTransaction = require("../models/GiftTransaction");
const WalletTransaction = require("../models/WalletTransaction");
const { getRateCoinConfig } = require("../config/RateCoinConfig");
const LiveStream = require("../models/LiveStream");
const LiveStreamViewer = require("../models/LiveStreamViewer");

/* =============================================================
   1. INVENTORY & SUMMARY ROUTES
   ============================================================= */

// GET current user's inventory
router.get("/my-gifts", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("ownedGifts.gift");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const validGifts = (user.ownedGifts || []).filter(item => item.gift !== null);
    res.json({ success: true, gifts: validGifts });
  } catch (err) {
    console.error("My Gifts Error:", err);
    res.status(500).json({ success: false, message: "Inventory failed" });
  }
});

// GET inventory for a specific user ID
router.get("/gifts/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const user = await User.findById(targetUserId).populate("ownedGifts.gift");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const validGifts = (user.ownedGifts || []).filter(item => item.gift !== null);
    res.json({ success: true, gifts: validGifts });
  } catch (err) {
    console.error("Gifts UserID Error:", err);
    res.status(500).json({ success: false });
  }
});

// GET gift reception summary (Aggregated)
router.get("/received-summary/:userId", auth, async (req, res) => {
  try {
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const summary = await GiftTransaction.aggregate([
      { $match: { receiver: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$gift", count: { $sum: "$quantity" } } },
      {
        $lookup: {
          from: "gifts",
          localField: "_id",
          foreignField: "_id",
          as: "giftData"
        }
      },
      { $unwind: "$giftData" },
      {
        $project: {
          _id: 0,
          count: 1,
          gift: "$giftData"
        }
      }
    ]);

    res.json({ success: true, summary });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ success: false, message: "Summary failed" });
  }
});

/* =============================================================
   2. SENDING LOGIC (BUY & SEND)
   ============================================================= */

// DIRECT PURCHASE (Buy for self or buy and send)
router.post("/buy-and-inventory", auth, async (req, res) => {
  const { giftId, receiverId } = req.body;
  try {
    const rateConfig = await getRateCoinConfig();
    const userCoinValue = Number(rateConfig.userCoinValue);

    const gift = await Gift.findById(giftId);
    if (!gift) return res.status(404).json({ success: false, message: "Gift not found" });

    const senderWallet = await Wallet.findOne({ userId: req.user.id });
    if (!senderWallet || senderWallet.coins < gift.price) {
      return res.status(400).json({ 
        success: false, 
        insufficient: true, 
        message: "Insufficient coins" 
      });
    }

    // 1. DEDUCT FROM SENDER
    senderWallet.coins -= gift.price;
    await senderWallet.save();

    // 2. RECORD DEBIT TRANSACTION
    await WalletTransaction.create({
      userId: req.user.id,
      type: "DEBIT",
      category: "GIFT_PURCHASE",
      coins: gift.price,
      amount: +(gift.price * userCoinValue).toFixed(2),
      status: "SUCCESS"
    });

    // 3. INVENTORY LOGIC (Buy for self)
    if (!receiverId) {
      const user = await User.findById(req.user.id);
      const giftIndex = user.ownedGifts.findIndex(
        item => item.gift && item.gift.toString() === giftId
      );

      if (giftIndex > -1) {
        user.ownedGifts[giftIndex].quantity += 1;
      } else {
        user.ownedGifts.push({ gift: giftId, quantity: 1 });
      }
      await user.save();
    } else {
      // Calculation for Host and Platform
      const platformCommissionCoins = Number((gift.price * rateConfig.giftCommissionRate).toFixed(2));
      const hostCoins = Number((gift.price - platformCommissionCoins).toFixed(2));

      await Wallet.findOneAndUpdate(
        { userId: receiverId },
        { $inc: { coins: hostCoins } },
        { upsert: true }
      );

      await Income.findOneAndUpdate(
        { userId: receiverId },
        { 
          $inc: { totalEarnings: hostCoins },
          $push: { history: { amount: hostCoins, type: 'gift', description: `Gift: ${gift.name}`, createdAt: new Date() } }
        },
        { upsert: true }
      );

      await GiftTransaction.create({
        sender: req.user.id,
        receiver: receiverId,
        gift: giftId,
        quantity: 1
      });
      // 🔴 LIVE STREAM GIFT TRACKING

          // Find active stream of receiver (host)
          const activeStream = await LiveStream.findOne({
            hostId: receiverId,
            status: "streaming"
          });

          if (activeStream) {

            // 1️⃣ Increase total coins earned in stream
            await LiveStream.findByIdAndUpdate(activeStream._id, {
              $inc: { totalCoinsEarned: hostCoins }
            });

            // 2️⃣ Update viewer session gift count
            await LiveStreamViewer.findOneAndUpdate(
              {
                liveStreamId: activeStream._id,
                userId: req.user.id,
                leftAt: null
              },
              {
                $inc: { totalGiftsSentInSession: 1 }
              }
            );
          }
    }

    // 4. SOCKET UPDATES
    const io = req.app.get("socketio");
    
    // Update Sender Wallet
    io.to(String(req.user.id)).emit("walletUpdated", {
      coins: senderWallet.coins
    });

    // Emit totalEarnings update to the receiver
    if (receiverId) {
      const receiverIncome = await Income.findOne({ userId: receiverId });
      if (receiverIncome) {
        io.to(String(receiverId)).emit("incomeUpdated", {
          totalEarnings: receiverIncome.totalEarnings
        });
      }
    }

    res.json({ success: true, newBalance: senderWallet.coins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Purchase failed" });
  }
});

// SEND FROM INVENTORY OR WALLET
router.post("/send", auth, async (req, res) => {
  try {
    const { giftId, receiverId } = req.body;
    const rateConfig = await getRateCoinConfig();
    const userCoinValue = Number(rateConfig.userCoinValue);

    if (isNaN(userCoinValue)) throw new Error("Invalid userCoinValue");

    const gift = await Gift.findById(giftId);
    if (!gift) return res.status(404).json({ message: "Gift not found" });

    const sender = await User.findById(req.user.id);
    const senderWallet = await Wallet.findOne({ userId: req.user.id });

    const inventoryIndex = sender.ownedGifts.findIndex(
      (item) => item.gift && item.gift.toString() === giftId
    );

    // 1. DEDUCT FROM INVENTORY OR WALLET
    if (inventoryIndex > -1) {
      sender.ownedGifts[inventoryIndex].quantity -= 1;
      if (sender.ownedGifts[inventoryIndex].quantity <= 0) {
        sender.ownedGifts.splice(inventoryIndex, 1);
      }
      await sender.save();
    } else {
      if (!senderWallet || senderWallet.coins < gift.price) {
        return res.status(400).json({ message: "Insufficient coins" });
      }
      senderWallet.coins -= gift.price;
      await senderWallet.save();

      await WalletTransaction.create({
        userId: req.user.id,
        type: "DEBIT",
        category: "GIFT_PURCHASE",
        coins: gift.price,
        amount: +(gift.price * userCoinValue).toFixed(2),
        status: "SUCCESS"
      });
    }

    // 2. RECEIVER INCOME LOGIC & COMMISSION
    if (receiverId) {
      const platformCommissionCoins = Number((gift.price * rateConfig.giftCommissionRate).toFixed(2));
      const hostCoins = Number((gift.price - platformCommissionCoins).toFixed(2));

      await Income.findOneAndUpdate(
        { userId: receiverId },
        { 
          $inc: { totalEarnings: hostCoins },
          $push: { 
            history: { 
              amount: hostCoins, 
              type: 'gift', 
              description: `Gift received: ${gift.name}`,
              createdAt: new Date()
            } 
          }
        },
        { upsert: true }
      );

      // Save Platform Commission (Using SENDER ID to satisfy "required" validator)
      await WalletTransaction.create({
        userId: req.user.id, 
        type: "CREDIT",
        category: "GIFT_PURCHASE", 
        coins: platformCommissionCoins,
        amount: +(platformCommissionCoins * rateConfig.hostCoinValue).toFixed(2),
        status: "SUCCESS",
        comment: "Platform Commission" 
      });

      await GiftTransaction.create({
        sender: req.user.id,
        receiver: receiverId,
        gift: giftId,
        quantity: 1
      });
      // 🔴 LIVE STREAM GIFT TRACKING

const activeStream = await LiveStream.findOne({
  hostId: receiverId,
  status: "streaming"
});

if (activeStream) {

  await LiveStream.findByIdAndUpdate(activeStream._id, {
    $inc: { totalCoinsEarned: hostCoins }
  });

  await LiveStreamViewer.findOneAndUpdate(
    {
      liveStreamId: activeStream._id,
      userId: req.user.id,
      leftAt: null
    },
    {
      $inc: { totalGiftsSentInSession: 1 }
    }
  );
}
    }

    // 3. SOCKET UPDATES
    const io = req.app.get("socketio");
    
    // Update Sender Wallet if deduction happened from wallet
    if (senderWallet) {
        io.to(String(req.user.id)).emit("walletUpdated", {
            coins: senderWallet.coins
        });
    }

    // Emit totalEarnings update to the receiver
    if (receiverId) {
      const receiverIncome = await Income.findOne({ userId: receiverId });
      if (receiverIncome) {
        io.to(String(receiverId)).emit("incomeUpdated", {
          totalEarnings: receiverIncome.totalEarnings
        });
      }
    }

    res.json({ success: true, newBalance: senderWallet?.coins || 0 });
  } catch (err) {
    console.error("Send Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =============================================================
   3. LEGACY COMPATIBILITY
   ============================================================= */
router.get("/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }
    const user = await User.findById(targetUserId).populate("ownedGifts.gift");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, gifts: user.ownedGifts || [] });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;