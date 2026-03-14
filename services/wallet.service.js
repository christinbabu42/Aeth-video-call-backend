const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User"); // ✅ Import User model
const { calculateLevel } = require("../utils/levelCalculator"); // ⭐ ADD THIS

/**
 * Credits a user's wallet and records the transaction.
 * Returns the updated wallet or null if already processed.
 */
const creditWallet = async (intent, io) => {
    const { userId, coins } = intent.metadata;

    // 1️⃣ Idempotency check
    const existingTx = await WalletTransaction.findOne({
        stripePaymentIntentId: intent.id
    });

    if (existingTx) {
        console.log(`ℹ️ [WalletService] TX ${intent.id} already handled. Skipping.`);
        return null;
    }

    // 2️⃣ Wallet update
    const updatedWallet = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { coins: Number(coins) } },
        { upsert: true, new: true }
    );

    // 3️⃣ Get user
    const user = await User.findById(userId);

    if (user) {
        const xpEarned = Number(coins);

        user.xp = (user.xp || 0) + xpEarned;
        user.level = calculateLevel(user.xp);

        await user.save();

        console.log(`🏆 Level Updated → User: ${userId}, Level: ${user.level}, XP: ${user.xp}`);
    }

    // 4️⃣ Transaction history
    await WalletTransaction.create({
        userId,
        type: "CREDIT",
        category: "COIN_PURCHASE",
        coins: Number(coins),
        amount: intent.amount / 100,
        stripePaymentIntentId: intent.id,
        status: "SUCCESS"
    });

    // 5️⃣ Realtime wallet update
    if (io && user) {
        io.to(userId).emit("walletUpdated", {
            coins: updatedWallet.coins,
            level: user.level,
            xp: user.xp
        });
    }

    console.log(`✅ [WalletService] Credited ${coins} coins to User ${userId}.`);

    // 6️⃣ Broadcast recharge alert
    try {
        if (user && user.gender === "male") {
            io.emit("coin-purchase-alert", {
                name: user.nickname || user.name || "A user",
                userId: user._id
            });
        }
    } catch (err) {
        console.error("Broadcast error:", err);
    }

    return updatedWallet;
};

module.exports = { creditWallet };