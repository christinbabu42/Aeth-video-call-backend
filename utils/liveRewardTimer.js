const User = require("../models/User");
const LiveStream = require("../models/LiveStream");

const timers = new Map();

/**
 * Starts a 1-minute interval timer for an active livestream
 * @param {string|ObjectId} streamId 
 * @param {string|ObjectId} hostId 
 */
function startRewardTimer(streamId, hostId) {
  const key = streamId.toString();

  if (timers.has(key)) return;

  const interval = setInterval(async () => {
    try {
      const stream = await LiveStream.findById(streamId);

      // Stop timer if stream is missing or no longer streaming
      if (!stream || stream.status !== "streaming") {
        stopRewardTimer(streamId);
        return;
      }

      // Add 1 coin to host's wallet
      await User.findByIdAndUpdate(hostId, {
        $inc: { wallet: 1 },
      });

      // Track rewards on the stream document
      await LiveStream.findByIdAndUpdate(streamId, {
        $inc: {
          totalCoinsEarned: 1,
          rewardMinutes: 1,
        },
      });

      console.log(`🪙 1 coin rewarded to host (${hostId}) for stream (${streamId})`);
    } catch (err) {
      console.error("Error in reward timer interval:", err);
    }
  }, 60000); // 1 minute (60,000 ms)

  timers.set(key, interval);
}

/**
 * Stops and cleans up the interval timer for a stream
 * @param {string|ObjectId} streamId 
 */
function stopRewardTimer(streamId) {
  const key = streamId.toString();
  const timer = timers.get(key);

  if (timer) {
    clearInterval(timer);
    timers.delete(key);
    console.log(`⏹️ Reward timer stopped for stream (${key})`);
  }
}

module.exports = {
  startRewardTimer,
  stopRewardTimer,
};