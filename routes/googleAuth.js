const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios"); 
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const router = express.Router();

// ✅ Initialize OAuth Client
const client = new OAuth2Client();

// ✅ ADMIN CONFIGURATION
const SUPERADMIN_EMAIL = "christinbabu42@gmail.com";

// ✅ GET COUNTRY FROM IP
const getCountryFromIP = async (ip) => {
  try {
    const res = await axios.get(`https://ipapi.co/${ip}/json/`);
    return res.data.country_name || null;
  } catch (err) {
    return null;
  }
};

/**
 * POST /api/auth/google
 */
router.post("/google", async (req, res) => {
  console.log("🔥 Google auth hit");

  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Staff ID Token required" });
    }

    // ✅ Verify Token for Web, Android, and Expo
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      ],
    });

    const payload = ticket.getPayload();

    // ✅ GET USER IP + COUNTRY
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const detectedCountry = await getCountryFromIP(ip);

    // ✅ FIND USER IN MONGODB
    let user = await User.findOne({ email: payload.email });

    // 🚫 1️⃣ BLOCK DELETED USERS
    if (user && user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deleted.",
      });
    }

    // 🚫 2️⃣ BLOCK BANNED / SUSPENDED USERS
    // We check if user exists and their status is not active. Superadmin bypasses this.
    if (
      user &&
      user.actionstatus !== "active" &&
      user.email !== SUPERADMIN_EMAIL
    ) {
      return res.status(403).json({
        success: false,
        message:
          user.actionstatus === "banned"
            ? "Your account has been banned. Contact support."
            : "Your account is suspended. Please try later.",
      });
    }

    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        profilePic: payload.picture,
        coins: 0,
        status: "online",
        lastSeen: new Date(),
        nation: detectedCountry,
        role: payload.email === SUPERADMIN_EMAIL ? "superadmin" : "user", // ✅ Assign role on creation
      });
    } else {
      user.name = payload.name;
      // ✅ Only set Google picture if user does NOT have custom one
      if (!user.profilePic) {
        user.profilePic = payload.picture;
      }
      user.status = "online";
      user.lastSeen = new Date();
      
      // Update role if it's the admin logging in
      if (user.email === SUPERADMIN_EMAIL) user.role = "superadmin";
      
      if (!user.nation && detectedCountry) user.nation = detectedCountry;
      await user.save();
    }

    // ✅ ADMIN LOGIN CHECK (ONLY FOR ADMIN PANEL)
    if (req.body.isAdminLogin) {
      const isAdmin = ["admin", "superadmin", "support", "finance"].includes(user.role);

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admins only.",
        });
      }
    }

    // ✅ CHECK ONBOARDING STATUS
    const isOnboarded =
      user.onboardingCompleted === true ||
      Boolean(user.nickname && user.gender && user.dateOfBirth);

    // 🔐 Create JWT with Role
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role // ✅ Important: Include role in token
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user,
      isOnboarded,
      isAdmin: ["admin", "superadmin", "support", "finance"].includes(user.role),
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

module.exports = router;