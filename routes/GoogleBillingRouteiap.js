const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const authMiddleware = require("../middlewares/auth");
const { calculateLevel } = require("../utils/levelCalculator");

// ✅ IMPORT SOCKET IO (Adjust path to your socket.js file)
const { getIO } = require("../socket"); 

const COIN_PACKS = {
  "coins_60": { coins: 60, price: 40 },
  "coins_90": { coins: 90, price: 60 },
  "coins_200": { coins: 200, price: 125 },
  "coins_440": { coins: 440, price: 250 },
  "coins_1200": { coins: 1200, price: 650 },
  "coins_2500": { coins: 2500, price: 1300 },
  "coins_5000": { coins: 5000, price: 2500 },
  "coins_15000": { coins: 15000, price: 7000 },
  "coins_33000": { coins: 33000, price: 15000 },
  "coins_65000": { coins: 65000, price: 28000 },
  "coins_100000": { coins: 100000, price: 40000 },
};

// 🟢 GET: Health Check
router.get("/check", (req, res) => {
  res.send("✅ IAP Route is Active and Reachable on AWS!");
});

// 🟢 POST: Auth-Free Mock (Diagnostic Only)
router.post("/verify-purchase-mock", async (req, res) => {
  const { productId } = req.body;
  const pack = COIN_PACKS[productId] || { coins: 0 };
  res.json({ 
    success: true, 
    message: "Bypassed Auth: Mock route working!",
    potentialCoins: pack.coins 
  });
});

// 💰 POST: Main Verification (Updated to sync with Wallet Schema)
router.post("/verify-purchase", authMiddleware, async (req, res) => {
  const { purchaseToken, productId } = req.body;
  const userId = req.user.id;

  if (!purchaseToken || !productId) {
    return res.status(400).json({ success: false, message: "Missing Details" });
  }

  try {
    if (purchaseToken.startsWith("MOCK_TOKEN_")) {
      const pack = COIN_PACKS[productId];
      if (!pack) return res.status(400).json({ success: false, message: "Invalid SKU" });

      // 🔄 UPDATE THE WALLET MODEL
      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId: userId },
        { $inc: { coins: pack.coins } },
        { new: true, upsert: true }
      );

      // ✅ 2. Update XP + Level
      const xpEarned = pack.coins;
      const user = await User.findById(userId);
      user.xp = (user.xp || 0) + xpEarned;
      user.level = calculateLevel(user.xp);
      await user.save();

      // Record the transaction for history
      await Transaction.create({
        user: userId,
        userId: userId, 
        type: "purchase",
        coins: pack.coins,
        amountPaid: pack.price,
        productId,
        purchaseToken,
        status: "completed",
        verifiedAt: new Date(),
        note: "AWS Mock Purchase"
      });

      // 🔥 EMIT AFTER PURCHASE (CRITICAL)
      // Check gender and alert female users if a male user recharges
      try {
        const io = getIO();
        console.log("🪙 Purchase confirmed for:", user.nickname || user.name, "| Gender:", user.gender);

        if (user.gender === "male") {
          console.log("🔥 Emitting 'Big Spender' alert to female-users room");
          io.to("female-users").emit("coin-purchase-alert", {
            userId: user._id,
            name: user.nickname || user.name || "A user",
          });
        }
      } catch (socketErr) {
        console.error("Socket emission failed, but purchase was successful:", socketErr.message);
      }
      
      return res.json({ 
        success: true, 
        newBalance: updatedWallet.coins,
        xp: user.xp,
        level: user.level
      });
    }
  } catch (error) {
    console.error("IAP Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;