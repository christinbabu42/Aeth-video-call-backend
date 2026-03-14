const mongoose = require("mongoose");

const liveStreamViewerSchema = new mongoose.Schema({
  liveStreamId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "LiveStream", 
    required: true, 
    index: true 
  },

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },

  roomName: { 
    type: String, 
    required: true 
  },

  // Session Tracking
  joinedAt: { 
    type: Date, 
    default: Date.now 
  },

  leftAt: { 
    type: Date 
  },

  watchDurationSeconds: { 
    type: Number, 
    default: 0 
  },

  isActive: { 
    type: Boolean, 
    default: true 
  },

  // Revenue tracking per viewer
  totalGiftsSentInSession: { 
    type: Number, 
    default: 0 
  },

  totalCoinsSpent: { 
    type: Number, 
    default: 0 
  },

}, { timestamps: true });


// 🚀 Prevent duplicate active session for same user
liveStreamViewerSchema.index(
  { liveStreamId: 1, userId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model("LiveStreamViewer", liveStreamViewerSchema);