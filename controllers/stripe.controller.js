// controllers/stripe.controller.js
import stripe from "../config/stripe.js";  
import { creditWallet } from "../services/wallet.service.js";  
import { getRateCoinConfig } from "../config/RateCoinConfig.js";  
import CoinPack from "../models/CoinPack.js"; // if needed

// ✅ ES Module exports
export const createPaymentIntent = async (req, res) => {
  try {
    const { coins } = req.body; 
    const userId = req.user.id;

    if (!coins || coins <= 0) {
      return res.status(400).json({ error: "Invalid coin amount" });
    }

    const rateConfig = await getRateCoinConfig(); 
    const amountInRupees = Math.round(coins * rateConfig.userCoinValue);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInRupees * 100,
      currency: "inr",
      metadata: {
        userId: userId.toString(),
        coins: coins.toString(),
      },
    });

    console.log(`✨ [Controller] Intent Created: ${paymentIntent.id} for User: ${userId}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    console.error("❌ [Controller] Create Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const io = req.app.get("socketio");

    if (intent.status !== "succeeded") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    console.log(`🔍 [Verify Route] Handing off to WalletService for TX: ${paymentIntentId}`);
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