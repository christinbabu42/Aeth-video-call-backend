// controllers/stripe.controller.js
import stripe from "../config/stripe.js";  // ✅ use this ONLY
import { creditWallet } from "../services/wallet.service";
import { getRateCoinConfig } from "../config/RateCoinConfig";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { creditWallet } = require("../services/wallet.service");
const CoinPack = require("../models/CoinPack");
const { getRateCoinConfig } = require("../config/RateCoinConfig");



exports.createPaymentIntent = async (req, res) => {
  try {
    const { coins } = req.body; 
    const userId = req.user.id;

    // ✅ Validate coin input
    if (!coins || coins <= 0) {
      return res.status(400).json({ error: "Invalid coin amount" });
    }

    // ✅ 🔹 NEW LOGIC: Use server-side rate config instead of CoinPack
    const rateConfig = await getRateCoinConfig(); 
    
    // ✅ Calculate amount securely based on the central rate (using userCoinValue)
    // Formula: (Number of Coins) * (Price per Coin for Users)
    const amountInRupees = Math.round(coins * rateConfig.userCoinValue);

    // ✅ Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInRupees * 100, // Stripe expects paise (INR * 100)
      currency: "inr",
      metadata: {
        userId: userId.toString(),
        coins: coins.toString(),
      },
    });

    // ✅ Log keeping your old format
    console.log(
      `✨ [Controller] Intent Created: ${paymentIntent.id} for User: ${userId}`
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    console.error("❌ [Controller] Create Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const io = req.app.get("socketio"); // ✅ Get io instance

    if (intent.status !== "succeeded") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    console.log(`🔍 [Verify Route] Handing off to WalletService for TX: ${paymentIntentId}`);

    // ✅ Clean Refactor: One call handles everything
    const result = await creditWallet(intent, io);

    if (!result) {
        console.log("ℹ️ [Verify Route] Already handled by Webhook.");
    } else {
        console.log(`✅ [Verify Route] DB Updated. New Balance: ${result.coins}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ [Verify Route] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};