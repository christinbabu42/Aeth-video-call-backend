const express = require("express");
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const { getIO } = require("../socket");
const LiveStream = require("../models/LiveStream");
const LiveStreamViewer = require("../models/LiveStreamViewer");
const BlockedUser = require("../models/Block");

const router = express.Router();

// =========================
// SERVICE INITIALIZATION
// =========================
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// =========================
// ROUTES
// =========================

/**
 * 1. GENERATE LIVEKIT TOKEN
 * Handles room joining and host status updates
 */
/* --- GET TOKEN ROUTE --- */
router.get("/token", auth, async (req, res) => {
  try {
    const { role, room } = req.query;

    if (!room) {
      return res.status(400).json({ success: false, message: "Missing room" });
    }

    // ✅ Get user from DB using JWT
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Use nickname from backend
    const displayName = user.nickname || user.name || "User";

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: user._id.toString(),
        name: displayName,
      }
    );

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: role === "host",
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // ✅ SET LIVE STATUS FOR HOST & EMIT EVENTS
    if (role === "host") {
      // 1️⃣ Update user status
      await User.findByIdAndUpdate(req.user.id, {
        status: "live",
      });

      // 2️⃣ Create LiveStream session
      const newStream = await LiveStream.create({
        hostId: req.user.id,
        title: `${displayName}'s Live`,
        status: "streaming",
        startedAt: new Date(),
      });

      // 3️⃣ Get Socket Instance (ONLY ONCE)
      const io = getIO(); 

      // 🔴 Emit status update
      io.emit("status-updated", {
        userId: req.user.id,
        status: "live",
      });

      // 🔴 Emit live started (Combined data)
      io.emit("live-started", {
        room: {
          name: room,
          hostId: req.user.id,
          hostName: displayName,
          hostPhoto: user.photo,
          liveStreamId: newStream._id 
        },
      });
    }

    // ==========================
    // VIEWER JOIN TRACKING
    // ==========================
    if (role === "viewer") {
      const hostId = room.replace("live_", "");

      const stream = await LiveStream.findOne({
        hostId,
        status: "streaming"
      });

      if (stream) {
        // Create or reuse active session
        await LiveStreamViewer.findOneAndUpdate(
          {
            liveStreamId: stream._id,
            userId: req.user.id,
            isActive: true
          },
          {
            $setOnInsert: {
              roomName: room,
              joinedAt: new Date()
            }
          },
          { upsert: true }
        );

        // ✅ STEP 1: Increment counts atomically
        await LiveStream.updateOne(
          { _id: stream._id },
          {
            $inc: {
              currentViewers: 1,
              totalUniqueViewers: 1
            }
          }
        );

        // ✅ STEP 2: Update maxConcurrentViewers safely (Native Driver Bypass)
        // Using .collection bypasses Mongoose validation to ensure the pipeline runs
        await LiveStream.collection.updateOne(
          { _id: stream._id },
          [
            {
              $set: {
                maxConcurrentViewers: {
                  $cond: [
                    { $gt: ["$currentViewers", "$maxConcurrentViewers"] },
                    "$currentViewers",
                    "$maxConcurrentViewers"
                  ]
                }
              }
            }
          ]
        );

        // ✅ Fetch the freshest count directly from DB
        const updatedStream = await LiveStream.findById(stream._id);

        // 📈 EMIT UPDATED VIEWER COUNT
        const io = getIO();
        io.to(room).emit("live-view-count-updated", {
          roomName: room,
          currentViewers: updatedStream.currentViewers
        });
      }
    }

    res.json({
      token,
      url: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error("LiveKit Token Error:", error);
    res.status(500).json({ message: "Server error generating token" });
  }
});

/**
 * 2. GET ACTIVE ROOMS
 */
router.get("/active-rooms", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const blockedRelations = await BlockedUser.find({
      $or: [
        { blocker: currentUserId },
        { blocked: currentUserId }
      ]
    });

    const blockedUserIds = blockedRelations.map(rel =>
      String(rel.blocker) === String(currentUserId)
        ? String(rel.blocked)
        : String(rel.blocker)
    );

    const liveUsers = await User.find({
      status: "live",
      _id: { $nin: blockedUserIds }
    }).select("_id nickname name profilePic nation");

    const rooms = liveUsers.map(user => ({
      name: `live_${user._id}`,
      hostId: user._id,
      hostName: user.nickname || user.name,
      hostPhoto: user.profilePic,
      sid: `live_${user._id}`
    }));

    res.json(rooms);

  } catch (error) {
    console.error("Active rooms error:", error);
    res.status(500).json({ message: "Error fetching live users" });
  }
});

/**
 * 3. END/DELETE A ROOM
 */
router.delete("/end-room/:roomName", async (req, res) => {
  try {
    const { roomName } = req.params;

    try {
      await roomService.deleteRoom(roomName);
      console.log(`Room ${roomName} deleted successfully`);
    } catch (err) {
      if (err.code === "not_found" || err.status === 404) {
        console.log(`Room ${roomName} already deleted (safe)`);
      } else {
        throw err;
      }
    }

    if (roomName.startsWith("live_")) {
      const hostId = roomName.replace("live_", "");

      await User.findByIdAndUpdate(hostId, {
        status: "online",
        BigScreen: false, 
      });

      await LiveStream.findOneAndUpdate(
        { hostId, status: "streaming" },
        {
          status: "ended",
          endedAt: new Date(),
          currentViewers: 0 // Reset viewers on end
        }
      );

      const io = getIO();

      io.emit("status-updated", {
        userId: hostId,
        status: "online",
        BigScreen: false, 
      });

      io.emit("live-ended", {
        roomName,
      });
    }

    res.json({ success: true, message: "Room ended safely" });

  } catch (error) {
    console.error("Error ending room:", error);
    res.status(500).json({ success: false, message: "Could not end the room" });
  }
});

// ==========================
// VIEWER LEFT STREAM
// ==========================
router.post("/viewer-left", auth, async (req, res) => {
  try {
    const { roomName } = req.body;
    const hostId = roomName.replace("live_", "");

    const stream = await LiveStream.findOne({
      hostId,
      status: "streaming"
    });

    if (!stream) return res.json({ success: true });

    const viewer = await LiveStreamViewer.findOne({
      liveStreamId: stream._id,
      userId: req.user.id,
      isActive: true
    });

    if (viewer) {
      viewer.leftAt = new Date();
      viewer.isActive = false;
      viewer.watchDurationSeconds =
        Math.floor((viewer.leftAt - viewer.joinedAt) / 1000);

      await viewer.save();
    }

    // ✅ FIX: Atomic decrement to prevent negative numbers or lost counts
    await LiveStream.updateOne(
      { _id: stream._id, currentViewers: { $gt: 0 } },
      { $inc: { currentViewers: -1 } }
    );

    const updatedStream = await LiveStream.findById(stream._id);

    // 📈 EMIT UPDATED VIEWER COUNT
    const io = getIO();
    io.to(roomName).emit("live-view-count-updated", {
      roomName,
      currentViewers: updatedStream ? updatedStream.currentViewers : 0
    });

    res.json({ success: true });

  } catch (error) {
    console.error("Viewer left error:", error);
    res.status(500).json({ success: false });
  }
});

router.post("/set-screen", auth, async (req, res) => { 
  try {
    const { BigScreen } = req.body;
    const screenValue =
      BigScreen === true ||
      BigScreen === "true" ||
      BigScreen === 1 ||
      BigScreen === "1";

    await User.findByIdAndUpdate(
      req.user.id,
      { $set: { BigScreen: screenValue } },
      { new: true }
    );

    const fullUser = await User.findById(req.user.id);

    res.json({
      success: true,
      user: fullUser
    });

  } catch (error) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;