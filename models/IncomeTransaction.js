const mongoose = require("mongoose");

const incomeTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "call",
        "gift",
        "live",
        "withdrawal",
        "refund",
        "bonus",
      ],
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    rupees: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "completed",
        "pending",
        "failed",
      ],
      default: "completed",
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    referenceModel: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
incomeTransactionSchema.index({
  userId: 1,
  createdAt: -1,
});

incomeTransactionSchema.index({
  userId: 1,
  type: 1,
});

module.exports = mongoose.model(
  "IncomeTransaction",
  incomeTransactionSchema
);