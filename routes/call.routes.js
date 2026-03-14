const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Call = require("../models/Call");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Income = require("../models/Income"); // 🔥 Added Income Model
const { getRateCoinConfig } = require("../config/RateCoinConfig");

// ============================================================
// SHARED UTILITY: End Call and Credit Income
// ============================================================
/**
 * Reusable function to finalize call status, set users to online, 
 * and credit earnings to the female user (Income model).
 */
const endCallAndCreditIncome = async (callId, io) => {
  try {
    // ✅ ISSUE 2 FIX: Fetch config here for final calculation once at the end
    const config = await getRateCoinConfig();
    const HOST_COIN_VALUE = config.hostCoinValue;
    const PLATFORM_COMMISSION_RATE = config.platformCommissionRate;

    // ✅ STEP 3: Atomic Protection - Only update if call is active
    const call = await Call.findOneAndUpdate(
      {
        _id: callId,
        status: { $in: ["ringing", "ongoing"] }
      },
      {
        status: "completed",
        endedAt: new Date()
      },
      { new: true }
    );

    // If call is null, it means it was already ended by another process
    if (!call) {
      const existingCall = await Call.findById(callId);
      if (existingCall) {
        await User.findByIdAndUpdate(existingCall.callerId, { status: "online" });
        await User.findByIdAndUpdate(existingCall.hostId, { status: "online" });
        io.emit("status-updated", { userId: existingCall.callerId, status: "online" });
        io.emit("status-updated", { userId: existingCall.hostId, status: "online" });
      }
      return;
    }

    const endTime = new Date();

    // 1. Logic for Unfinished or No-Billing Calls
    if (!call.totalCoinsSpent || call.totalCoinsSpent <= 0) {
      call.status = "missed";
      call.endedAt = endTime;
    } else {
      // ✅ ISSUE 2 FIX: Calculate earnings and commission ONLY ONCE at the end
      const totalCoins = call.totalCoinsSpent;
      const platformCommission = Number((totalCoins * PLATFORM_COMMISSION_RATE).toFixed(2));
      const hostEarnings = Number((totalCoins - platformCommission).toFixed(2));

      const durationInMs = call.startedAt ? endTime - call.startedAt : 0;
      const durationInSeconds = Math.floor(durationInMs / 1000);

      call.duration = durationInSeconds;
      call.platformCommission = platformCommission;
      call.hostEarnings = hostEarnings;
      call.hostEarningsInRupees = Number((hostEarnings * HOST_COIN_VALUE).toFixed(2));
      call.platformFeeInRupees = Number((platformCommission * HOST_COIN_VALUE).toFixed(2));
    }

    await call.save();

    // 2. Update Presence Status to Online
    await User.findByIdAndUpdate(call.callerId, { status: "online" });
    await User.findByIdAndUpdate(call.hostId, { status: "online" });

    // Emit Presence Updates
    io.emit("status-updated", {
      userId: call.callerId,
      status: "online"
    });

    io.emit("status-updated", {
      userId: call.hostId,
      status: "online"
    });

    // 3. Identity Determination (Male Payer vs Female Earner)
    const caller = await User.findById(call.callerId);
    const host = await User.findById(call.hostId);

    if (!caller || !host) return;

    let payingUserId = caller.gender === "male" ? caller._id : host._id;
    let earningUserId = caller.gender === "female" ? caller._id : host._id;

    // 4. Process Earnings for Female User
    if (earningUserId && call.hostEarnings > 0) {
      let income = await Income.findOne({ userId: earningUserId });
      if (!income) {
        income = new Income({ userId: earningUserId, totalEarnings: 0, history: [] });
      }

      // Prevent duplicate income entry for the same call
      const alreadyExists = income.history.some(
        h => h.description === `Call Earnings - ${call._id}`
      );

      if (!alreadyExists) {
        // Use precision to update totalEarnings
        income.totalEarnings = Number((income.totalEarnings + call.hostEarnings).toFixed(2));
        income.history.push({
          amount: call.hostEarnings,
          description: `Call Earnings - ${call._id}`,
          type: "call",
          status: "completed",
          createdAt: new Date()
        });
        await income.save();
      }

      // Update Payer (Male) Wallet UI
      if (payingUserId) {
        const payerWallet = await Wallet.findOne({ userId: payingUserId });
        if (payerWallet) {
          io.to(String(payingUserId)).emit("walletUpdated", { coins: payerWallet.coins });
        }
      }

      // Update Earner (Female) Income UI
      io.to(String(earningUserId)).emit("incomeUpdated", { totalEarnings: income.totalEarnings });
    }

    // 5. Force Call Termination on Client Side
    io.to(String(call.callerId)).emit("call-end", { callId: call._id });
    io.to(String(call.hostId)).emit("call-end", { callId: call._id });

    console.log(`✅ Call ${callId} successfully finalized and credited via endCallAndCreditIncome.`);
  } catch (err) {
    console.error("Error in endCallAndCreditIncome utility:", err);
  }
};

// ========================
// START CALL (Wallet Check 1st)
// ========================
router.post("/start", async (req, res) => {
  try {
    const { callerId, hostId, callType } = req.body;

    const caller = await User.findById(callerId);
    const host = await User.findById(hostId);

    if (!caller || !host)
      return res.status(400).json({ success: false, message: "User not found" });

    const ratePerMinute = host.callRate || 60;
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    const existingCall = await Call.findOne({
      $or: [
        { callerId: host._id },
        { hostId: host._id }
      ],
      status: { $in: ["ringing", "ongoing"] },
      createdAt: { $gte: thirtySecondsAgo }
    });

    if (existingCall) {
      return res.status(400).json({
        success: false,
        message: "User is already in another call"
      });
    }

    let payerId = null;
    if (caller.gender === "male") {
      payerId = caller._id;
    } else if (host.gender === "male") {
      payerId = host._id;
    }

    if (payerId) {
      const payerWallet = await Wallet.findOne({ userId: payerId });
      if (!payerWallet || payerWallet.coins < ratePerMinute) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Minimum ${ratePerMinute} coins required to continue.`
        });
      }
    }

    const call = await Call.create({
      callerId: caller._id,
      hostId: host._id,
      callType,
      ratePerMinute,
      status: "ringing",
      channelName: `call_${callerId}_${hostId}_${Date.now()}`
    });

    res.json({ success: true, call });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ========================
// ACCEPT CALL
// ========================
router.post("/accept/:id", async (req, res) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ message: "Call not found" });

    if (["completed", "missed", "ended", "cancelled"].includes(call.status)) {
      return res.json({ success: false, message: "Call already ended" });
    }

    if (call.status === "ringing") {
      call.status = "ongoing";
      call.startedAt = new Date();
      await call.save();
    }

    const freshCall = await Call.findById(call._id);
    if (!freshCall || freshCall.status !== "ongoing") {
      return res.json({ success: false, message: "Call no longer active" });
    }

    await User.findByIdAndUpdate(call.callerId, { status: "busy" });
    await User.findByIdAndUpdate(call.hostId, { status: "busy" });

    const io = req.app.get("socketio");
    io.emit("status-updated", {
      userId: call.callerId,
      status: "busy"
    });

    io.emit("status-updated", {
      userId: call.hostId,
      status: "busy"
    });

    res.json({ success: true, call: freshCall });
  } catch (err) {
    console.error("Accept error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================
// DEDUCT COINS LIVE
// ========================
router.post("/deduct/:id", async (req, res) => {
  try {
    const call = await Call.findById(req.params.id);
    if (!call || call.status !== "ongoing")
      return res.status(400).json({ message: "Call not active" });

    const caller = await User.findById(call.callerId);
    const host = await User.findById(call.hostId);

    let payingUserId;
    if (caller.gender === "male") {
      payingUserId = caller._id;
    } else if (host.gender === "male") {
      payingUserId = host._id;
    } else {
      return res.status(400).json({ message: "No male user found for billing" });
    }

    const payerWallet = await Wallet.findOne({ userId: payingUserId });
    if (!payerWallet)
      return res.status(400).json({ message: "Payer wallet not found" });

    // ✅ ISSUE 1 FIX: Use decimal precision (rate / 12) instead of Math.ceil
    const coinsToDeduct = Number((call.ratePerMinute / 12).toFixed(2));
    const io = req.app.get("socketio");

    // ✅ ISSUE 3 FIX: Stop deduction if balance is strictly less than deduction amount
    if (payerWallet.coins < coinsToDeduct) {
      io.to(String(payingUserId)).emit("insufficientCoins", {
        message: "Insufficient balance"
      });

      await endCallAndCreditIncome(call._id, io);

      return res.json({
        callEnded: true,
        message: "Insufficient balance"
      });
    }

    // Deduct coins using 2-decimal precision
    payerWallet.coins = Number((payerWallet.coins - coinsToDeduct).toFixed(2));
    await payerWallet.save();

    io.to(String(payingUserId)).emit("walletUpdated", { coins: payerWallet.coins });

    // Update total spent in call record using precision
    call.totalCoinsSpent = Number(((call.totalCoinsSpent || 0) + coinsToDeduct).toFixed(2));

    // ✅ ISSUE 2 FIX: Removed commission calculation logic from here. 
    // It is now handled once in endCallAndCreditIncome to save CPU and DB calls.
    await call.save();

    res.json({
      coins: payerWallet.coins,
      callEnded: false,
      totalCoinsSpent: call.totalCoinsSpent
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Deduct coins failed" });
  }
});

// ========================
// END CALL
// ========================
router.post("/end/:id", async (req, res) => {
  try {
    const io = req.app.get("socketio");
    await endCallAndCreditIncome(req.params.id, io);

    const call = await Call.findById(req.params.id);
    res.json({
      message: "Call ended successfully",
      call
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========================
// CHECK BALANCE
// ========================
router.get("/balance/:userId", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) return res.json({ coins: 0 });
    res.json({ coins: wallet.coins });
  } catch (err) {
    res.status(500).json({ coins: 0 });
  }
});

module.exports = router;