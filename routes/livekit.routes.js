const express = require("express");
const {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver
} = require("livekit-server-sdk");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const { getIO } = require("../socket");
const LiveStream = require("../models/LiveStream");
const LiveStreamViewer = require("../models/LiveStreamViewer");
const BlockedUser = require("../models/Block");

// ✅ Import timer utilities
const { startRewardTimer, stopRewardTimer } = require("../utils/liveRewardTimer");

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
// LIVEKIT WEBHOOK RECEIVER
// =========================
const webhookReceiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Host disconnect grace timers
const hostDisconnectTimers = new Map();

// =========================
// SERVER AUTHORITATIVE LIVE CLEANUP
// =========================
async function endLiveStreamOnServer(
  roomName,
  reason = "server_cleanup"
) {
  if (!roomName || !roomName.startsWith("live_")) {
    return;
  }

  const hostId = roomName.replace("live_", "");

  try {
    console.log(
      `🧹 SERVER LIVE CLEANUP: room=${roomName}, host=${hostId}, reason=${reason}`
    );

    // -----------------------------------------
    // 1. Find active stream
    // -----------------------------------------
    const stream = await LiveStream.findOne({
      hostId,
      status: "streaming"
    });

    // -----------------------------------------
    // 2. Delete LiveKit room
    // -----------------------------------------
    try {
      await roomService.deleteRoom(roomName);

      console.log(
        `🗑️ LiveKit room ${roomName} deleted`
      );
    } catch (err) {
      if (
        err.code === "not_found" ||
        err.status === 404
      ) {
        console.log(
          `ℹ️ LiveKit room ${roomName} already deleted`
        );
      } else {
        console.error(
          `❌ LiveKit room deletion error:`,
          err.message
        );
      }
    }

    // -----------------------------------------
    // 3. End LiveStream in MongoDB
    // -----------------------------------------
    if (stream) {
      await LiveStream.findByIdAndUpdate(
        stream._id,
        {
          status: "ended",
          endedAt: new Date(),
          currentViewers: 0
        }
      );

      // STOP HOST REWARD TIMER
      try {
        stopRewardTimer(stream._id);
      } catch (timerError) {
        console.error(
          "❌ Reward timer stop error:",
          timerError
        );
      }

      console.log(
        `💰 Reward timer stopped: ${stream._id}`
      );
    }

    // -----------------------------------------
    // 4. Restore host status
    // -----------------------------------------
    await User.findByIdAndUpdate(
      hostId,
      {
        status: "online",
        BigScreen: false,
        lastSeen: new Date()
      }
    );

    // -----------------------------------------
    // 5. Notify connected users
    // -----------------------------------------
    const io = getIO();

    io.emit("status-updated", {
      userId: hostId,
      status: "online",
      BigScreen: false
    });

    io.emit("live-ended", {
      roomName,
      hostId,
      reason
    });

    console.log(
      `✅ SERVER LIVE CLEANUP COMPLETE: ${roomName}`
    );

  } catch (error) {
    console.error(
      `❌ SERVER LIVE CLEANUP ERROR:`,
      error
    );
  }
}

// =========================
// ROUTES
// =========================

// =========================
// LIVEKIT WEBHOOK
// =========================
router.post(
  "/webhook",
  express.raw({
    type: "application/webhook+json"
  }),
  async (req, res) => {
    try {
      const body = req.body.toString("utf8");

      const event = await webhookReceiver.receive(
        body,
        req.get("Authorization")
      );

      console.log(
        `📡 LIVEKIT WEBHOOK: ${event.event}`
      );

      // ==========================================
      // HOST / PARTICIPANT JOINED
      // ==========================================
      if (event.event === "participant_joined") {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;

        if (roomName && identity) {
          const timerKey =
            `${roomName}:${identity}`;

          if (hostDisconnectTimers.has(timerKey)) {
            clearTimeout(
              hostDisconnectTimers.get(timerKey)
            );

            hostDisconnectTimers.delete(timerKey);

            console.log(
              `♻️ Host reconnected. Cleanup cancelled: ${timerKey}`
            );
          }
        }
      }

      // ==========================================
      // PARTICIPANT LEFT / CONNECTION ABORTED
      // ==========================================
      if (
        event.event === "participant_left" ||
        event.event === "participant_connection_aborted"
      ) {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;

        if (!roomName || !identity) {
          return res.sendStatus(200);
        }

        // Only AethMeet live rooms
        if (!roomName.startsWith("live_")) {
          return res.sendStatus(200);
        }

        const hostId =
          roomName.replace("live_", "");

        // Ignore viewers
        if (String(identity) !== String(hostId)) {
          console.log(
            `👤 Viewer left ${roomName}: ${identity}`
          );

          return res.sendStatus(200);
        }

        const timerKey =
          `${roomName}:${identity}`;

        // Clear previous timer
        if (hostDisconnectTimers.has(timerKey)) {
          clearTimeout(
            hostDisconnectTimers.get(timerKey)
          );
        }

        console.log(
          `⚠️ HOST DISCONNECTED: ${roomName}`
        );

        // Give host 10 seconds to reconnect
        const timer = setTimeout(
          async () => {
            hostDisconnectTimers.delete(
              timerKey
            );

            try {
              // Check LiveKit directly
              const participants =
                await roomService.listParticipants(
                  roomName
                );

              const hostStillConnected =
                participants.some(
                  participant =>
                    String(participant.identity) ===
                    String(hostId)
                );

              if (hostStillConnected) {
                console.log(
                  `♻️ Host reconnected: ${roomName}`
                );

                return;
              }

              console.log(
                `🚨 Host did not reconnect. Ending ${roomName}`
              );

              await endLiveStreamOnServer(
                roomName,
                event.event ===
                  "participant_connection_aborted"
                  ? "host_connection_aborted"
                  : "host_left"
              );

            } catch (error) {
              console.error(
                `❌ Host connection check failed:`,
                error
              );

              // Still clean up because
              // LiveKit already reported host disconnect
              await endLiveStreamOnServer(
                roomName,
                "host_disconnect_cleanup"
              );
            }
          },
          10000
        );

        hostDisconnectTimers.set(
          timerKey,
          timer
        );
      }

      // ==========================================
      // ROOM FINISHED
      // ==========================================
      if (event.event === "room_finished") {
        const roomName = event.room?.name;

        if (
          roomName &&
          roomName.startsWith("live_")
        ) {
          console.log(
            `🏁 LIVEKIT ROOM FINISHED: ${roomName}`
          );

          await endLiveStreamOnServer(
            roomName,
            "room_finished"
          );
        }
      }

      return res.sendStatus(200);

    } catch (error) {
      console.error(
        "❌ LiveKit webhook error:",
        error
      );

      return res.sendStatus(401);
    }
  }
);

/**
 * 1. GENERATE LIVEKIT TOKEN
 */
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

      // 🪙 START REWARD TIMER FOR HOST
      startRewardTimer(newStream._id, req.user.id);

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
/**
 * 3. END/DELETE A ROOM
 */
router.delete("/end-room/:roomName", async (req, res) => {
  try {
    const { roomName } = req.params;

    // Call your server-side end stream function
    await endLiveStreamOnServer(
      roomName,
      "frontend_end_room"
    );

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

      const stream = await LiveStream.findOneAndUpdate(
        { hostId, status: "streaming" },
        {
          status: "ended",
          endedAt: new Date(),
          currentViewers: 0 // Reset viewers on end
        },
        { new: true }
      );

      // 🛑 STOP REWARD TIMER WHEN STREAM ENDS
      if (stream) {
        stopRewardTimer(stream._id);
      }

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