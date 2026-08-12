const Income = require("../models/Income");
const LiveStream = require("../models/LiveStream");
const { getRateCoinConfig } = require("../config/RateCoinConfig");

const timers = new Map();

/**
 * Starts a 1-minute reward timer for an active livestream.
 *
 * 1 minute = 1 live coin
 * @param {string|ObjectId} streamId 
 * @param {string|ObjectId} hostId 
 */
async function startRewardTimer(streamId, hostId) {
  const key = streamId.toString();

  // Prevent duplicate timers
  if (timers.has(key)) {
    console.log(`⚠️ Reward timer already running: ${key}`);
    return;
  }

  console.log(`🪙 Starting reward timer: ${key}`);

  const interval = setInterval(async () => {
    try {
      // ==========================================
      // 1. CHECK STREAM
      // ==========================================

      const stream = await LiveStream.findOne({
        _id: streamId,
        hostId,
        status: "streaming",
      });

      if (!stream) {
        console.log(`⏹️ Stream ended. Stopping timer: ${key}`);
        stopRewardTimer(streamId);
        return;
      }

      // ==========================================
      // 2. GET HOST COIN VALUE
      // ==========================================

      const rateConfig = await getRateCoinConfig();

      const hostCoinValue = Number(
        rateConfig?.hostCoinValue || 0.45
      );

      // ==========================================
      // 3. ADD 1 LIVE COIN TO INCOME
      // ==========================================

      const liveCoins = 1;

      const updatedIncome = await Income.findOneAndUpdate(
        { userId: hostId },
        {
          $inc: {
            liveCoins: liveCoins,
            totalCoins: liveCoins,
            availableCoins: liveCoins,
            totalRupees: +(liveCoins * hostCoinValue).toFixed(2),
            liveMinutes: 1,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      // ==========================================
      // 4. UPDATE LIVE STREAM STATISTICS
      // ==========================================

      await LiveStream.findByIdAndUpdate(streamId, {
        $inc: {
          totalCoinsEarned: liveCoins,
          rewardMinutes: 1,
        },
      });

      // ==========================================
      // 5. SOCKET UPDATE
      // ==========================================

      try {
        const { getIO } = require("../socket");
        const io = getIO();

        io.to(String(hostId)).emit("incomeUpdated", {
          liveCoins: updatedIncome.liveCoins,
          totalCoins: updatedIncome.totalCoins,
          availableCoins: updatedIncome.availableCoins,
          totalRupees: updatedIncome.totalRupees,
          liveMinutes: updatedIncome.liveMinutes,
        });
      } catch (socketError) {
        console.error(
          "Socket income update error:",
          socketError.message
        );
      }

      console.log(
        `🪙 LIVE REWARD +1 | Host: ${hostId} | ` +
        `Live: ${updatedIncome.liveCoins} | ` +
        `Total: ${updatedIncome.totalCoins} | ` +
        `Available: ${updatedIncome.availableCoins}`
      );

    } catch (err) {
      console.error(
        `❌ Error in reward timer (${key}):`,
        err
      );
    }
  }, 60 * 1000);

  timers.set(key, interval);
}

/**
 * Stops and cleans up reward timer.
 * @param {string|ObjectId} streamId 
 */
function stopRewardTimer(streamId) {
  const key = streamId.toString();

  const timer = timers.get(key);

  if (timer) {
    clearInterval(timer);
    timers.delete(key);

    console.log(`⏹️ Reward timer stopped: ${key}`);
  }
}

module.exports = {
  startRewardTimer,
  stopRewardTimer,
};