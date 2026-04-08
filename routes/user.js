const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const auth = require("../middlewares/auth");
// ✅ ADD THIS LINE BELOW
const Visitor = require("../models/Visitor");
const BlockedUser = require("../models/Block");
const GlobalConfig = require("../models/GlobalConfig"); // ✅ Added this
const requireOnboarding = require("../middlewares/requireOnboarding");

const router = express.Router();

/* =========================
   UPDATE ONBOARDING DETAILS
   POST /api/user/onboarding
========================= */
router.post("/onboarding", auth, async (req, res) => {
  try {
    const { nickname, gender, dateOfBirth, nation  } = req.body;

    // ✅ Basic validation
    if (!nickname || !gender || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!nation || typeof nation !== "string") {
      return res.status(400).json({
        success: false,
        message: "Country is required",
      });
    }

    const allowedGenders = ["male", "female", "other"];
    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender value",
      });
    }

    // ✅ Find logged-in user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔒 Optional: prevent re-onboarding
    if (user.nickname && user.gender && user.dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: "Onboarding already completed",
      });
    }

    // ✅ DOB validation
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date of birth",
      });
    }

    // ✅ Age validation (18+)
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(403).json({
        success: false,
        message: "User must be 18+",
      });
    }

    // ✅ Update user fields
    user.nickname = nickname;
    user.gender = gender;
    user.dateOfBirth = dob;
    user.nation = nation; // ✅ SAVE COUNTRY
    user.onboardingCompleted = true;

    await user.save();

    res.json({
      success: true,
      message: "Onboarding completed",
      user,
    });
  } catch (error) {
    console.error("Onboarding Save Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* =========================
   GET LOGGED-IN USER
   GET /api/user/me
========================= */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
      console.log("Connected DB:", mongoose.connection.name);
console.log("User onboarding:", user.onboardingCompleted);
console.log("User ID:", user._id);

    // ✅ ADD VISITOR COUNT (no logic changed)
    const visitors = await Visitor.countDocuments({
      visited: user._id,
    });

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        visitors,
      },
    });
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* =========================
   UPDATE PROFILE (EDIT)
   PUT /api/user/profile
========================= */
router.put("/profile", auth, async (req, res) => {
  try {
    const { nickname, dateOfBirth, language, profilePic, nation } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (nickname !== undefined) user.nickname = nickname;
    if (language !== undefined) user.language = language;
    if (nation !== undefined) user.nation = nation;

    // ✅ CLOUDINARY URL ONLY
    if (profilePic) {
      if (profilePic.startsWith("data:image")) {
        return res.status(400).json({
          success: false,
          message: "Base64 images are not allowed",
        });
      }
      user.profilePic = profilePic;
    }

    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid DOB" });
      }
      user.dateOfBirth = dob;
    }

    await user.save();

    res.json({ success: true, message: "Profile updated", user });
  } catch (err) {
    console.error("Profile Update Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// =========================
// GET /api/user/online
// =========================
router.get("/online", auth, requireOnboarding, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    
    // ✅ Check Review Mode Status
    const config = await GlobalConfig.findOne({ key: "showGuestLogin" });
    const isReviewMode = config ? config.value : false;

    // 1️⃣ Get users current user blocked
    const blockedByMe = await BlockedUser.find({
      blocker: currentUser._id,
    }).select("blocked");
    const blockedByMeIds = blockedByMe.map((b) => b.blocked);

    // 2️⃣ Get users who blocked current user
    const blockedMe = await BlockedUser.find({
      blocked: currentUser._id,
    }).select("blocker");
    const blockedMeIds = blockedMe.map((b) => b.blocker);

    // 3️⃣ Combine all excluded IDs
    const excludedIds = [
      ...blockedByMeIds,
      ...blockedMeIds,
      currentUser._id,
    ];

    // 4️⃣ Build Query
    let query = {
      status: { $in: ["online", "busy", "live"] },
      _id: { $nin: excludedIds }
    };

    // ✅ If NOT in review mode, apply the gender filter
    if (!isReviewMode) {
      query.gender = currentUser.gender === "male" ? "female" : "male";
    }

    const users = await User.find(query)
      .select("nickname profilePic nation status lastSeen publicId gender");

    res.json({ success: true, users });

  } catch (err) {
    console.error("Online users error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ................
// //Offline APIs
// ................

router.put("/offline", auth, requireOnboarding, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      status: "offline",
      lastSeen: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


/* =========================
   GET USER BY ID
   GET /api/user/:id
========================= */
router.get("/:id", auth,requireOnboarding, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("name nickname gender profilePic coverPhotos nation status followersCount followingCount publicId BigScreen");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ ADD VISITOR COUNT (no other change)
    const visitors = await Visitor.countDocuments({
      visited: user._id,
    });

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        visitors,
      },
    });
  } catch (error) {
    console.error("Get User by ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
/* =========================
   UPDATE COVER PHOTOS
   PUT /api/user/cover-photos
========================= */
router.put("/cover-photos", auth,requireOnboarding, async (req, res) => {
  try {
    console.log("➡️ PUT /api/user/cover-photos called");

    // 🔍 DEBUG: auth middleware result
    console.log("🔐 req.user:", req.user);

    // ❌ Safety check (debug only)
    if (!req.user || !req.user.id) {
      console.error("❌ User ID missing in req.user");
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
    }

    const { coverPhotos } = req.body;

    // 🔍 DEBUG: request body
    console.log("📦 coverPhotos received:", coverPhotos);

    if (!Array.isArray(coverPhotos) || coverPhotos.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Maximum 4 photos allowed",
      });
    }

    // 🔍 DEBUG: user lookup
    console.log("🔍 Finding user with ID:", req.user.id);

    const user = await User.findById(req.user.id);

    if (!user) {
      console.error("❌ User not found in DB");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔍 DEBUG: before update
    console.log("📸 Old coverPhotos:", user.coverPhotos);

    user.coverPhotos = coverPhotos;
    await user.save();

    // 🔍 DEBUG: after update
    console.log("✅ Updated coverPhotos:", user.coverPhotos);

    return res.json({
      success: true,
      message: "Cover photos updated",
      coverPhotos: user.coverPhotos,
    });
  } catch (err) {
    console.error("🔥 Cover photo update error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* =========================
   UPDATE CALL RATE
   PUT /api/user/update-rate
========================= */

router.put("/update-rate", auth, requireOnboarding, async (req, res) => {
  try {
    const { callRate } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const level = user.level || 1;

    // LEVEL LOCK RULES
    let allowedRates = [];

    if (level >= 14) {
      allowedRates = [60, 100, 150, 200, 300];
    } else if (level >= 8) {
      allowedRates = [60, 100, 150, 200];
    } else if (level >= 5) {
      allowedRates = [60, 100, 150];
    } else if (level >= 3) {
      allowedRates = [60, 100];
    } else {
      allowedRates = [60];
    }

    if (!allowedRates.includes(callRate)) {
      return res.status(403).json({
        success: false,
        message: "Rate locked for your level",
      });
    }

    user.callRate = callRate;
    await user.save();

    res.json({
      success: true,
      message: "Call rate updated",
      callRate: user.callRate,
    });

  } catch (error) {
    console.error("Update rate error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// 📁 routes/userRoutes.js

router.post("/bank-details", auth);


module.exports = router;
