const { Server } = require("socket.io");
const Message = require("./models/Message");
const User = require("./models/User");
const Call = require("./models/Call");
const BlockedUser = require("./models/Block"); // adjust path if needed
const jwt = require("jsonwebtoken");

// Global timer map for reconnection grace periods
const disconnectTimers = new Map();
let ioInstance = null; // Ensuring instance is tracked

/**
 * ✅ Structure updated for JWT-based Auth and Auto-Joining
 */
const initSocket = (server, extraOptions = {}) => {
  const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000,
    ...extraOptions 
  });

  ioInstance = io;

  // =========================
  // 1. JWT MIDDLEWARE
  // =========================
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ✅ Map decoded ID to socket.userId
      socket.userId = decoded.id || decoded._id; 

      if (!socket.userId) {
        return next(new Error("Invalid token payload"));
      }
      next();
    } catch (err) {
      console.log("❌ Socket auth error:", err.message);
      next(new Error("Authentication error"));
    }
  });

  // =========================
  // 2. CONNECTION HANDLER
  // =========================
  io.on("connection", async (socket) => {
    const userIdStr = String(socket.userId);
    console.log(`🔌 New Connection: ${socket.id} (User: ${userIdStr})`);

    // ✅ FETCH USER FIRST (🔥 FIX)
    const user = await User.findById(socket.userId);
    
    // 🚫 BLOCK IF DELETED OR BANNED
    if (!user || user.isDeleted || user.actionstatus !== "active") {
      console.log(`🚫 Refusing socket: ${userIdStr} is deleted/banned.`);
      socket.emit("force_logout", { message: "Account inactive" });
      return socket.disconnect(); // Terminate connection immediately
    }

    // ✅ AUTOMATIC ROOM JOINING
    socket.join(userIdStr);

    // ✅ SET USER ONLINE IMMEDIATELY
    try {
      await User.findByIdAndUpdate(socket.userId, { 
        status: "online", 
        lastSeen: null 
      });

      io.emit("status-updated", {
        userId: socket.userId,
        status: "online",
      });

      // Clear any pending disconnect timers if user reconnected fast
      if (disconnectTimers.has(socket.userId)) {
        clearTimeout(disconnectTimers.get(socket.userId));
        disconnectTimers.delete(socket.userId);
        console.log(`♻️ Reconnection detected for ${userIdStr}, timer cleared.`);
      }
    } catch (err) {
      console.error("Online status error:", err);
    }

    // =========================
    // 3. CHAT MESSAGING LOGIC
    // =========================
    socket.on("send-message", async (data) => {
      try {
        const { senderId, receiverId, type = "text" } = data;

        // 🔒 STEP 1: Check if blocked
        const isBlocked = await BlockedUser.findOne({
          $or: [
            { blocker: senderId, blocked: receiverId },
            { blocker: receiverId, blocked: senderId }
          ]
        });

        if (isBlocked) {
          // silently reject OR notify sender
          io.to(String(senderId)).emit("message-blocked", {
            message: "User not available"
          });
          return;
        }

        const messageData = {
          senderId,
          receiverId,
          type,
          isRead: false
        };

        if (type === "text") messageData.text = data.text;
        if (type === "image" || type === "video") messageData.media = data.media;
        if (type === "audio") messageData.audio = data.audio;
        if (type === "gift") messageData.gift = data.gift;

        const message = await Message.create(messageData);

        const payload = {
          _id: message._id,
          senderId,
          receiverId,
          type: message.type,
          text: message.text,
          media: message.media,
          audio: message.audio,
          gift: message.gift,
          createdAt: message.createdAt,
        };

        io.to(String(senderId)).emit("receive-message", payload);
        io.to(String(receiverId)).emit("receive-message", payload);

        const unreadCount = await Message.countDocuments({
          receiverId,
          isRead: false
        });

        io.to(String(receiverId)).emit("unread-count-updated", {
          count: unreadCount
        });

      } catch (err) {
        console.error("Message save error:", err);
      }
    });

    // =========================
    // 4. SEND GIFT
    // =========================
    socket.on("send-gift", async ({ to, gift }) => {
      try {
        const message = await Message.create({
          senderId: socket.userId,
          receiverId: to,
          type: "gift",
          gift: gift._id
        });

        const populated = await message.populate("gift");

        io.to(String(socket.userId)).emit("receive-message", populated);
        io.to(String(to)).emit("receive-message", populated);
      } catch (err) {
        console.error("Gift save error:", err);
      }
    });

    // =========================
    // 5. WEBRTC SIGNALING (CALLS)
    // =========================
    
    // OFFER
    socket.on("call-offer", ({ to, offer, callId, name }) => {
      const targetRoom = String(to);
      const clients = io.sockets.adapter.rooms.get(targetRoom);

      if (!clients || clients.size === 0) {
        console.log(`⚠️ Call failed: Target ${targetRoom} is offline!`);
        socket.emit("call-error", { message: "User is offline or unreachable" });
      } else {
        console.log(`📞 Offer from ${socket.userId} to ${targetRoom}`);
        io.to(targetRoom).emit("call-offer", {
          from: socket.userId, 
          offer,
          callId,
          name: name
        });
      }
    });

    // ANSWER
    socket.on("call-answer", async ({ to, answer }) => {
      const targetRoom = String(to);
      console.log(`✅ Call Answer from ${socket.userId} to ${targetRoom}`);

      // ✅ SET BOTH USERS BUSY
      await User.findByIdAndUpdate(socket.userId, { status: "busy" });
      await User.findByIdAndUpdate(to, { status: "busy" });

      // ✅ EMIT STATUS UPDATE
      io.emit("status-updated", { userId: socket.userId, status: "busy" });
      io.emit("status-updated", { userId: to, status: "busy" });

      io.to(targetRoom).emit("call-answer", {
        from: socket.userId,
        answer
      });
    });

    // ICE CANDIDATE
    socket.on("ice-candidate", ({ to, candidate }) => {
      const targetRoom = String(to);
      io.to(targetRoom).emit("ice-candidate", {
        from: socket.userId,
        candidate
      });
    });

    // CALL END
    socket.on("call-end", async ({ callId }) => {
      try {
        if (!callId) return;

        const call = await Call.findById(callId);
        if (!call) return;

        if (call.status === "cancelled" || call.status === "rejected") return;

        const callerIdStr = String(call.callerId);
        const hostIdStr = String(call.hostId);
        const currentUserId = String(socket.userId);

        if (callerIdStr !== currentUserId && hostIdStr !== currentUserId) {
          console.log("🚫 Unauthorized call-end blocked");
          return;
        }

        if (call.status === "ringing" || call.status === "ongoing") {
          call.status = "completed";
          call.endedAt = new Date();
          await call.save();
        }

        console.log(`📤 Broadcasting call-end: ${callId}`);
        
        io.to(callerIdStr).emit("call-end", { callId });
        io.to(hostIdStr).emit("call-end", { callId });

        await User.findByIdAndUpdate(callerIdStr, { status: "online" });
        await User.findByIdAndUpdate(hostIdStr, { status: "online" });

        io.emit("status-updated", { userId: callerIdStr, status: "online" });
        io.emit("status-updated", { userId: hostIdStr, status: "online" });

      } catch (error) {
        console.error("❌ Error in socket call-end:", error.message);
      }
    });

    // =========================
    // 6. LIVE ROOM SIGNALING (JOIN/LEAVE)
    // =========================
    socket.on("join-live-room", (roomName) => {
      socket.join(roomName);
      console.log(`📺 Socket ${socket.id} joined live room: ${roomName}`);
    });

    socket.on("leave-live-room", (roomName) => {
      socket.leave(roomName);
      console.log(`🚪 Socket ${socket.id} left live room: ${roomName}`);
    });

    // =========================
    // 7. DISCONNECT LOGIC
    // =========================
    socket.on("disconnect", async (reason) => {
      console.log(`📡 Socket ${socket.id} disconnected. Reason: ${reason}`);

      if (!socket.userId) return;

      // Mark offline in DB
      await User.findByIdAndUpdate(socket.userId, {
        status: "offline",
        lastSeen: new Date(),
      });

      io.emit("status-updated", {
        userId: socket.userId,
        status: "offline",
      });

      // 🔒 Grace period (10 seconds)
      const timer = setTimeout(async () => {
        console.log(`⏱ Grace expired for ${socket.userId}`);

        const activeCalls = await Call.find({
          status: "ongoing",
          $or: [
            { callerId: socket.userId },
            { hostId: socket.userId }
          ]
        });

        for (const call of activeCalls) {
          call.status = "completed";
          call.endedAt = new Date();
          await call.save();

          io.to(String(call.callerId)).emit("call-end", { callId: call._id });
          io.to(String(call.hostId)).emit("call-end", { callId: call._id });

          await User.findByIdAndUpdate(call.callerId, { status: "online" });
          await User.findByIdAndUpdate(call.hostId, { status: "online" });
          
          io.emit("status-updated", { userId: call.callerId, status: "online" });
          io.emit("status-updated", { userId: call.hostId, status: "online" });
        }
        
        disconnectTimers.delete(socket.userId);
      }, 10000); 

      disconnectTimers.set(socket.userId, timer);
    });
  });

  return io;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized!");
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };