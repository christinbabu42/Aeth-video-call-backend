const mongoose = require("mongoose");

const liveStreamSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  title: { type: String, trim: true },
  coverImage: { type: String },
  
  status: { 
    type: String, 
    enum: ['streaming', 'ended', 'banned'], 
    default: 'streaming' 
  },

  // Live Metrics
  currentViewers: { type: Number, default: 0 },
  maxConcurrentViewers: { type: Number, default: 0 },
  totalUniqueViewers: { type: Number, default: 0 },
  
  // Revenue during this specific session
  totalGiftsReceived: { type: Number, default: 0 },
  totalCoinsEarned: { type: Number, default: 0 },

  // Session Timing
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },

  // Admin Controls
  isMuted: { type: Boolean, default: false },
  tags: [String], // e.g., ['gaming', 'chatting', 'dance']
}, { timestamps: true });

module.exports = mongoose.model("LiveStream", liveStreamSchema);