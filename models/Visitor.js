const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  // The person looking at the profile
  visitor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },
  // The person whose profile is being looked at
  visited: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  },
}, { timestamps: true });

// We remove the { unique: true } so we can track return visits,
// but we keep the index so the query is lightning fast.
visitorSchema.index({ visitor: 1, visited: 1 });

module.exports = mongoose.model("Visitor", visitorSchema);