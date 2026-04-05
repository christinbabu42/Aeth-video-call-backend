const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios"); 
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const router = express.Router();

// ✅ Initialize OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

// ✅ ADMIN CONFIGURATION
const SUPERADMIN_EMAIL = "christinbabu42@gmail.com";

// ✅ GET COUNTRY FROM IP
const getCountryFromIP = async (ip) => {
  try {
    const cleanIp = (ip === "::1" || ip === "127.0.0.1") ? "" : ip;
    const res = await axios.get(`https://ipapi.co/${cleanIp}/json/`);
    return res.data.country_name || null;
  } catch (err) {
    return null;
  }
};

/**
 * 🛡️ NEW: POST /api/auth/guest
 * Specifically for Google Play Store Reviewers
 */
router.post("/guest", async (req, res) => {
  console.log("🔥 Guest/Reviewer login hit");
  
  try {
    const guestEmail = "reviewer@test.com"; // Static email for the reviewer
    
    // Get IP/Country for the reviewer
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const detectedCountry = await getCountryFromIP(ip);

    // Find or Create the Reviewer account
    let user = await User.findOne({ email: guestEmail });

    if (!user) {
      user = await User.create({
        googleId: "google_reviewer_bypass_id",
        email: guestEmail,
        name: "Play Store Reviewer",
        profilePic: "https://ui-avatars.com/api/?name=Reviewer&background=random",
        coins: 500, // Give them coins so they can test the gifting features
        status: "online",
        lastSeen: new Date(),
        nation: detectedCountry || "India",
        role: "user",
        onboardingCompleted: true // Skip onboarding for reviewers to keep it fast
      });
    } else {
      user.status = "online";
      user.lastSeen = new Date();
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user,
      isOnboarded: true, // Always true for reviewer to get them to the video features faster
      isAdmin: false,
    });
  } catch (error) {
    console.error("Guest Auth Error:", error.message);
    res.status(500).json({ success: false, message: "Guest login failed" });
  }
});

/**
 * POST /api/auth/google
 */
router.post("/google", async (req, res) => {
  console.log("Incoming Request Body:", req.body);
  console.log("🔥 Google auth hit");

  try {
    const { idToken, accessToken, isAdminLogin } = req.body;

    console.log("ENV CLIENT ID:", process.env.GOOGLE_WEB_CLIENT_ID);
    console.log("FRONTEND TOKEN RECEIVED:", idToken ? "YES" : "NO");

    if (!idToken && !accessToken) {
      return res.status(400).json({ message: "Staff Token (ID or Access) required" });
    }

    let payload;

    if (idToken) {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else if (accessToken) {
      const googleRes = await axios.get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`
      );
      payload = googleRes.data;
      payload.sub = payload.id; 
    }

    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const detectedCountry = await getCountryFromIP(ip);

    let user = await User.findOne({ email: payload.email });

    if (user && user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deleted.",
      });
    }

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
        role: payload.email === SUPERADMIN_EMAIL ? "superadmin" : "user",
      });
    } else {
      user.name = payload.name;
      if (!user.profilePic) {
        user.profilePic = payload.picture;
      }
      user.status = "online";
      user.lastSeen = new Date();
      
      if (user.email === SUPERADMIN_EMAIL) user.role = "superadmin";
      if (!user.nation && detectedCountry) user.nation = detectedCountry;
      await user.save();
    }

    const adminRoles = ["admin", "superadmin", "support", "finance"];
    if (isAdminLogin) {
      const isAdmin = adminRoles.includes(user.role);
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admins only.",
        });
      }
    }

    const isOnboarded =
      user.onboardingCompleted === true ||
      Boolean(user.nickname && user.gender && user.dateOfBirth);

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user,
      isOnboarded,
      isAdmin: adminRoles.includes(user.role),
    });
  } catch (error) {
    console.error("Google Auth Error:", error.response?.data || error.message);
    res.status(401).json({ message: "Invalid Google token or session" });
  }
});

module.exports = router;