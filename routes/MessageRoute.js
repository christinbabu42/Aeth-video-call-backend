const express = require("express");
const Message = require("../models/Message");
const router = express.Router();
const mongoose = require("mongoose"); // MUST BE AT TOP

// ✅ STEP 1: New Imports for Media Handling
const multer = require("multer");
const path = require("path");


// ✅ STEP 2: Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/messages/");
  },
  filename: (req, file, cb) => {
    // Generates a unique filename using timestamp
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// ================= ROUTES =================

// ✅ STEP 3: New Media Upload Route
// This handles images, videos, and audio uploads from the chat
router.post("/upload", upload.single("file"), (req, res) => {
  console.log("api works");

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    console.log("Uploaded file type:", req.file.mimetype);
    console.log("Uploaded file size:", req.file.size);

    const fileUrl = `${req.protocol}://${req.get("host")}/public/messages/${req.file.filename}`;

    res.json({
      success: true,
      url: fileUrl,
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error during upload"
    });
  }
});

// GET total unread count for a specific user
router.get("/unread-count/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.log("⚠️ Invalid or missing userId received for unread count");
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const count = await Message.countDocuments({
      receiverId: new mongoose.Types.ObjectId(userId),
      isRead: false
    });

    res.json({ success: true, count });
  } catch (err) {
    console.error("❌ Backend error in /unread-count:", err);
    res.status(500).json({ success: false, count: 0, error: err.message });
  }
});

// GET Conversations
router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { receiverId: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
              "$receiverId",
              "$senderId",
            ],
          },
          lastMessage: { $first: "$text" },
          time: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", new mongoose.Types.ObjectId(userId)] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },

// ✅ Add this stage to control deleted users
{
  $addFields: {
    "userDetails.name": {
      $cond: [
        { $eq: ["$userDetails.isDeleted", true] },
        "User Deleted",
        "$userDetails.name"
      ]
    },
    "userDetails.nickname": {
      $cond: [
        { $eq: ["$userDetails.isDeleted", true] },
        null,
        "$userDetails.nickname"
      ]
    },
    "userDetails.profilePic": {
      $cond: [
        { $eq: ["$userDetails.isDeleted", true] },
        "/public/avatar.png",
        "$userDetails.profilePic"
      ]
    }
  }
}
    ]);

    res.json({ success: true, conversations });
  } catch (err) {
    console.error("Aggregation Error:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * GET chat messages between two users
 */
router.get("/:userId/:otherUserId", async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    })
    .populate("gift")
    .sort({ createdAt: 1 });

    res.json({ success: true, messages });
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ success: false, message: "Failed to load messages" });
  }
});

// Mark messages as read and NOTIFY SOCKET
router.post("/mark-read", async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;

    if (!userId || !otherUserId) {
      return res.status(400).json({ success: false, message: "Missing IDs" });
    }

    // 1️⃣ Mark messages as read
    await Message.updateMany(
      { senderId: otherUserId, receiverId: userId, isRead: false },
      { $set: { isRead: true } }
    );

    // 2️⃣ Recalculate unread count
    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false
    });

    // 3️⃣ Get socket instance
    const io = req.app.get("socketio");

    if (io) {
      io.to(String(userId)).emit("unread-count-updated", {
        count: unreadCount
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Mark-read error:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;