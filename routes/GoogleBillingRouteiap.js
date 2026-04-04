const express = require("express");
const router = express.Router();
const { google } = require("googleapis");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const authMiddleware = require("../middlewares/auth");
const { calculateLevel } = require("../utils/levelCalculator");
const { getIO } = require("../socket"); 

const auth = new google.auth.GoogleAuth({
  keyFile: "service-account.json", 
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});

const androidpublisher = google.androidpublisher({
  version: "v3",
  auth,
});

const PACKAGE_NAME = "com.aeth.videocallapp";

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
};

router.get("/check", (req, res) => {
  res.send("✅ IAP Route is Active and Reachable on AWS!");
});

router.post("/verify-purchase", authMiddleware, async (req, res) => {
  const { purchaseToken, productId } = req.body;
  const userId = req.user.id;

  if (!purchaseToken || !productId) {
    return res.status(400).json({ success: false, message: "Missing Details" });
  }

  try {
    // 🧪 Handle Local Mocking (only if token starts with MOCK_)
    if (purchaseToken.startsWith("MOCK_TOKEN_")) {
        const pack = COIN_PACKS[productId];
        if (!pack) return res.status(400).json({ success: false, message: "Invalid SKU" });

        const wallet = await Wallet.findOneAndUpdate(
            { userId },
            { $inc: { coins: pack.coins } },
            { new: true, upsert: true }
        );

        const user = await User.findById(userId);
        user.xp = (user.xp || 0) + pack.coins;
        user.level = calculateLevel(user.xp);
        await user.save();

        return res.json({ success: true, newBalance: wallet.coins, xp: user.xp, level: user.level });
    }

    // 🌐 REAL GOOGLE VERIFICATION
    const result = await androidpublisher.purchases.products.get({
      packageName: PACKAGE_NAME, 
      productId: productId,
      token: purchaseToken,
    });

    if (result.data.purchaseState !== 0) {
      return res.status(400).json({ success: false, message: "Invalid purchase state" });
    }

    // 🤝 ACKNOWLEDGE (Consumes the product so it can be bought again)
    await androidpublisher.purchases.products.acknowledge({
      packageName: PACKAGE_NAME,
      productId: productId,
      token: purchaseToken,
    });

    // 💰 UPDATE DATA
    const pack = COIN_PACKS[productId];
    if (!pack) return res.status(400).json({ success: false, message: "Invalid SKU" });

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { coins: pack.coins } },
      { new: true, upsert: true }
    );

    const user = await User.findById(userId);
    user.xp = (user.xp || 0) + pack.coins;
    user.level = calculateLevel(user.xp);
    await user.save();

    // 📝 LOG TRANSACTION
    await Transaction.create({
      user: userId,
      type: "purchase",
      coins: pack.coins,
      productId,
      purchaseToken,
      status: "completed",
      verifiedAt: new Date(),
    });

    // 📢 SOCKET ALERT
    try {
      const io = getIO();
      if (user.gender === "male") {
        io.to("female-users").emit("coin-purchase-alert", {
          userId: user._id,
          name: user.nickname || "A user",
        });
      }
    } catch (sErr) { console.error("Socket err ignored"); }
    
    return res.json({ 
      success: true, 
      newBalance: updatedWallet.coins,
      xp: user.xp,
      level: user.level
    });

  } catch (error) {
    console.error("IAP Verification Error:", error.message);
    res.status(500).json({ success: false, message: "Verification Failed" });
  }
});

module.exports = router;