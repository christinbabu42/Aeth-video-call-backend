const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // Call Type differentiation
  callType: { 
    type: String, 
    enum: ['video', 'audio'], 
    required: true 
  },

  status: { 
    type: String, 
    enum: ['ongoing', 'completed', 'rejected', 'missed', 'failed', 'busy', "ringing"], 
    default: 'ongoing' 
  },

  // Billing Logic
  ratePerMinute: { type: Number, required: true }, // Snapshots the rate at start of call
  duration: { type: Number, default: 0 }, // Total duration in seconds
  totalCoinsSpent: { type: Number, default: 0 },
  hostEarnings: { type: Number, default: 0 },
  platformCommission: { type: Number, default: 0 },

  // 🔥 New fields
  hostEarningsInRupees: { type: Number, default: 0 },
  platformFeeInRupees: { type: Number, default: 0 },

  // Technical Tracking
  channelName: { type: String }, // Agora/WebRTC Channel ID
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  
  // For Admin Review
  endReason: { type: String, enum: ['user_hung_up', 'host_hung_up', 'low_balance', 'admin_forced', 'network_error'] }
}, { timestamps: true });

module.exports = mongoose.model("Call", callSchema);