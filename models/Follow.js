const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
  // The person who clicks "Follow"
  follower: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    index: true 
  },
  // The person who is being followed
  following: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    index: true 
  },
}, { timestamps: true });

// ✅ Crucial: Prevents double-following
followSchema.index({ follower: 1, following: 1 }, { unique: true });

module.exports = mongoose.model("Follow", followSchema);