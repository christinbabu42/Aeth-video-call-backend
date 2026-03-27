  const mongoose = require("mongoose");

  const IncomeSchema = new mongoose.Schema({
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      unique: true 
    },
    // This serves as the current "Withdrawable" balance
    totalEarnings: {        // withdrawable coins
      type: Number,
      default: 0
    },

    lockedEarnings: {       // coins under withdrawal processing
      type: Number,
      default: 0
    },

    history: [{
      amount: { type: Number, required: true },
      rupees: { type: Number }, // ✅ ADD THIS
      description: { type: String },
      // Added 'live' to the enum to match your frontend breakdown
      type: { 
        type: String, 
        enum: ['gift', 'call', 'live', 'withdrawal'], 
        default: 'gift' 
      },
      // Optional: useful for tracking if a withdrawal is pending or completed
      status: {
        type: String,
        enum: ['completed', "processing", 'pending', 'failed'],
        default: 'completed'
      },
      createdAt: { type: Date, default: Date.now }
    }]
  }, { timestamps: true }); // Adds updatedAt and createdAt for the whole document

  module.exports = mongoose.model("Income", IncomeSchema);