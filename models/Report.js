const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reported user/host
  callId: { type: mongoose.Schema.Types.ObjectId, ref: 'Call' }, // Reference call
  reason: { type: String, required: true },
  evidenceImage: { type: String }, // Screenshot URL
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  adminAction: { type: String, enum: ['none', 'warning', 'ban', 'refund'] },
  adminNotes: String
}, { timestamps: true });

module.exports = mongoose.model("Report", reportSchema);