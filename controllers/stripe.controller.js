const stripe = require("../config/stripe");
const { creditWallet } = require("../services/wallet.service");
const { getRateCoinConfig } = require("../config/RateCoinConfig");
const CoinPack = require("../models/CoinPack");

// Create payment intent
exports.createPaymentIntent = async (req, res) => {
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

    console.log(`✨ Intent Created: ${paymentIntent.id}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    console.error("Create Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};


// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const io = req.app.get("socketio");

    if (intent.status !== "succeeded") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    console.log(`Verifying payment: ${paymentIntentId}`);

    const result = await creditWallet(intent, io);

    if (!result) {
      console.log("Already processed by webhook");
    } else {
      console.log(`Wallet credited. Balance: ${result.coins}`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error("Verify Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};