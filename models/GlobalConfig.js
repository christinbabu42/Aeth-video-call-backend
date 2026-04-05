const mongoose = require("mongoose");

const globalConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, 
  value: { type: Boolean, default: false },
  description: String
});

// ✅ MUST USE module.exports to work with require() in your routes
module.exports = mongoose.model("GlobalConfig", globalConfigSchema);