const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

function arrayLimit(val) {
  return val.length <= 4;
}

const userSchema = new mongoose.Schema(
  {
    // BASIC INFO
    name: {
      type: String,
      trim: true,
    },

    nickname: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    googleId: {
      type: String,
      index: true,
    },

    publicId: {
    type: String,
    unique: true,
    index: true
  },

    profilePic: {
      type: String,
    },

    role: {
    type: String,
    enum: ["user", "host", "admin","superadmin", "support", "finance"],
    default: "user",
    index: true
    },
    isAdmin: { type: Boolean, default: false }, // Quick check for your current login logic


    coverPhotos: {
      type: [String], // array of image URLs
      validate: [arrayLimit, "Maximum 4 cover photos allowed"],
      default: [],
    },

    // PERSONAL DETAILS
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    dateOfBirth: {
      type: Date,
    },

    language: {
      type: String,
      default: "en",
    },

    nation: {
      type: String,
    },

    // OWNED GIFTS
    ownedGifts: [
      {
        gift: { type: mongoose.Schema.Types.ObjectId, ref: "Gift" },
        quantity: { type: Number, default: 1 },
        purchasedAt: { type: Date, default: Date.now }
      }
    ],



status: {
  type: String,
  enum: ["offline", "online", "live", "busy"],
  default: "offline",
  index: true
},

reportCount: {
  type: Number,
  default: 0,
},

isDeleted: {
  type: Boolean,
  default: false
},
deletedAt: {
  type: Date,
  default: null
},

    // ✅ NEW FIELD
    BigScreen: {
      type: Boolean,
      default: false,
    },

      lastSeen: {
        type: Date,
      },
      
    
    // ONBOARDING 
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },

    // STATUS & SECURITY
    actionstatus: { type: String, enum: ["active", "suspended", "banned"], default: "active" },

    // ANALYTICS
    callstats: {
      totalSpent: { type: Number, default: 0 },
      callsMade: { type: Number, default: 0 },
      callsReceived: { type: Number, default: 0 }
    },

    // LEVEL SYSTEM
xp: {
  type: Number,
  default: 0
},

level: {
  type: Number,
  default: 0
},

callRate: {
  type: Number,
  default: 60
},


// bank details

bankAdded: {
  type: Boolean,
  default: false
},
// 💰 Payout Details
country: {
  type: String,
  default: "IN",
  index: true
},

bankDetails: {
  accountHolderName: String,
  accountNumber: String,
  ifsc: {
  type: String,
  match: /^[A-Z]{4}0[A-Z0-9]{6}$/ // basic IFSC validation
},
  bankName: String
},
upiId: String,

paypalEmail: { 
  type: String,
  lowercase: true,
  trim: true
},

/* =========================
       FOLLOW & VISIT COUNTS
    ========================= */
    // ✅ Keep counts here for fast UI loading
    // ❌ REMOVED: followers: [] and following: [] arrays
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    visitorsCount: { type: Number, default: 0 } // Standardized name
  
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* =========================
   VIRTUAL FIELD: AGE
========================= */
userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
});

/* =========================
   AUTO HIDE DELETED USERS
========================= */
userSchema.pre(/^find/, function () {
  this.where({ isDeleted: { $ne: true } });
});

/* =========================
   AUTO generated ID for users
========================= */

userSchema.pre("save", async function () {
  if (!this.publicId) {
    this.publicId = nanoid();
  }
});

/* =========================
   Bank details added
========================= */

userSchema.pre("save", function (next) {
  if (this.bankDetails?.accountNumber && this.bankDetails?.ifsc) {
    this.bankAdded = true;
  } else {
    this.bankAdded = false;
  }
  next();
});

module.exports = mongoose.model("User", userSchema);  