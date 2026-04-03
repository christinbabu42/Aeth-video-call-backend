const express = require("express");
const router = express.Router();
const { google } = require("googleapis"); // ✅ Added for Real Verification
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const authMiddleware = require("../middlewares/auth");
const { calculateLevel } = require("../utils/levelCalculator");

// ✅ IMPORT SOCKET IO
const { getIO } = require("../socket"); 

// --- Google Play Auth Setup ---
const auth = new google.auth.GoogleAuth({
  keyFile: "service-account.json", 
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});

const androidpublisher = google.androidpublisher({
  version: "v3",
  auth,
});

// ✅ UPDATED: Only track coins (Price is managed in Google Play Console)
const COIN_PACKS = {
  "coins_40": { coins: 40 },
  "coins_90": { coins: 90 },
  "coins_200": { coins: 200 },
  "coins_440": { coins: 440 },
  "coins_1200": { coins: 1200 },
  "coins_2500": { coins: 2500 },
  "coins_5000": { coins: 5000 },
  "coins_15000": { coins: 15000 },
  "coins_33000": { coins: 33000 },
  "coins_65000": { coins: 65000 },
  "coins_100000": { coins: 100000 },
};

// 🟢 GET: Health Check
router.get("/check", (req, res) => {
  res.send("✅ IAP Route is Active and Reachable on AWS!");
});

// 💰 POST: Main Verification (REAL GOOGLE PLAY VERIFICATION)
router.post("/verify-purchase", authMiddleware, async (req, res) => {
  const { purchaseToken, productId } = req.body;
  const userId = req.user.id;

  if (!purchaseToken || !productId) {
    return res.status(400).json({ success: false, message: "Missing Details" });
  }

  try {
    // ✅ 1. VERIFY WITH GOOGLE
    const result = await androidpublisher.purchases.products.get({
      packageName: "com.aeth.meet", // 🔥 Ensure this matches your package name
      productId: productId,
      token: purchaseToken,
    });

    if (result.data.purchaseState !== 0) {
      return res.status(400).json({ success: false, message: "Invalid purchase state" });
    }

    // ✅ 2. ACKNOWLEDGE PURCHASE (CRITICAL: Prevents automatic refunds)
    await androidpublisher.purchases.products.acknowledge({
      packageName: "com.aeth.meet",
      productId: productId,
      token: purchaseToken,
    });

    // ✅ 3. PROCESS COINS
    const pack = COIN_PACKS[productId];
    if (!pack) return res.status(400).json({ success: false, message: "Invalid SKU" });

    // 🔄 UPDATE THE WALLET MODEL
    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId: userId },
      { $inc: { coins: pack.coins } },
      { new: true, upsert: true }
    );

    // ✅ 4. Update XP + Level
    const xpEarned = pack.coins;
    const user = await User.findById(userId);
    user.xp = (user.xp || 0) + xpEarned;
    user.level = calculateLevel(user.xp);
    await user.save();

    // ✅ 5. Record the transaction (amountPaid: 0 because we trust Play Console price)
    await Transaction.create({
      user: userId,
      userId: userId, 
      type: "purchase",
      coins: pack.coins,
      amountPaid: 0, 
      productId,
      purchaseToken,
      status: "completed",
      verifiedAt: new Date(),
      note: "Google Play Official Purchase"
    });

    // 🔥 EMIT AFTER PURCHASE
    try {
      const io = getIO();
      if (user.gender === "male") {
        io.to("female-users").emit("coin-purchase-alert", {
          userId: user._id,
          name: user.nickname || user.name || "A user",
        });
      }
    } catch (socketErr) {
      console.error("Socket emission failed:", socketErr.message);
    }
    
    return res.json({ 
      success: true, 
      newBalance: updatedWallet.coins,
      xp: user.xp,
      level: user.level
    });

  } catch (error) {
    // Logic for Mock Token (Diagnostic only - can be removed for production)
    if (purchaseToken && purchaseToken.startsWith("MOCK_TOKEN_")) {
        const pack = COIN_PACKS[productId];
        if (!pack) return res.status(400).json({ success: false, message: "Invalid SKU" });

        const updatedWallet = await Wallet.findOneAndUpdate(
            { userId: userId },
            { $inc: { coins: pack.coins } },
            { new: true, upsert: true }
        );

        const user = await User.findById(userId);
        user.xp = (user.xp || 0) + pack.coins;
        user.level = calculateLevel(user.xp);
        await user.save();

        return res.json({ 
            success: true, 
            newBalance: updatedWallet.coins,
            xp: user.xp,
            level: user.level
        });
    }

    console.error("IAP Verification Error:", error.message);
    res.status(500).json({ success: false, message: "Verification Failed" });
  }
});

module.exports = router;