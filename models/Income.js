const mongoose = require("mongoose");

const incomeSchema = new mongoose.Schema(
  {
    // =========================================
    // USER REFERENCE
    // =========================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // =========================================
    // EARNING BREAKDOWN
    // =========================================
    liveCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    giftCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    callCoins: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================
    // TOTAL EARNED
    // =========================================
    totalCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRupees: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================
    // WITHDRAWAL BALANCES
    // =========================================
    withdrawnCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingWithdrawalCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableCoins: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================
    // USAGE STATISTICS
    // =========================================
    liveMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalGifts: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================================
    // WITHDRAWAL HISTORY ONLY
    // =========================================
    withdrawalHistory: [
      {
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
          enum: ["pending", "processing", "completed", "failed"],
          default: "pending",
        },
        description: {
          type: String,
          default: "Withdrawal request",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        processedAt: {
          type: Date,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Income", incomeSchema);