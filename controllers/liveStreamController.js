// controllers/liveStreamController.js
const LiveStream = require("../models/LiveStream");
const { startRewardTimer, stopRewardTimer } = require("../utils/liveRewardTimer");

// POST /api/livekit/start-stream
exports.startStream = async (req, res) => {
  try {
    const displayName = req.user.nickname || req.user.name || "User";

    const newStream = await LiveStream.create({
      hostId: req.user.id,
      title: `${displayName}'s Live`,
      status: "streaming",
      startedAt: new Date(),
    });

    // 🪙 Start 1-minute coin reward timer
    startRewardTimer(newStream._id, req.user.id);

    return res.status(201).json({
      success: true,
      stream: newStream,
    });
  } catch (error) {
    console.error("Error starting stream:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/livekit/end-room/:roomName
exports.endRoom = async (req, res) => {
  try {
    const hostId = req.user.id;

    const stream = await LiveStream.findOneAndUpdate(
      {
        hostId,
        status: "streaming",
      },
      {
        status: "ended",
        endedAt: new Date(),
        currentViewers: 0,
      },
      { new: true }
    );

    if (stream) {
      // 🛑 Stop the reward timer
      stopRewardTimer(stream._id);
    }

    return res.status(200).json({
      success: true,
      message: "Room ended successfully",
      stream,
    });
  } catch (error) {
    console.error("Error ending room:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};