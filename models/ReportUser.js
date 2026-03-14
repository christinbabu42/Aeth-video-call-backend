const mongoose = require("mongoose");

const reportUserSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "Inappropriate Content",
        "Nudity",
        "Harassment or Bullying",
        "Fake Profile / Impersonation",
        "Scam or Fraud",
        "Underage User",
        "Hate Speech / Discrimination",
        "Spam / Advertising",
        "Other", // ✅ added
      ],
    },
        // ✅ ADD THIS
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate report from same user for same person
reportUserSchema.index({ reporter: 1, reportedUser: 1 }, { unique: true });

module.exports = mongoose.model("ReportUser", reportUserSchema);