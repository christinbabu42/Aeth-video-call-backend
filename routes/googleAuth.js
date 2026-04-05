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
    // Standardizing localhost IP for ipapi compatibility
    const cleanIp = (ip === "::1" || ip === "127.0.0.1") ? "" : ip;
    const res = await axios.get(`https://ipapi.co/${cleanIp}/json/`);
    return res.data.country_name || null;
  } catch (err) {
    return null;
  }
};

/**
 * POST /api/auth/google
 */
router.post("/google", async (req, res) => {
  console.log("Incoming Request Body:", req.body);
  console.log("🔥 Google auth hit");

  try {
    const { idToken, accessToken, isAdminLogin } = req.body;

        // ✅ ADD DEBUG LOGS HERE
    console.log("ENV CLIENT ID:", process.env.GOOGLE_WEB_CLIENT_ID);
    console.log("FRONTEND TOKEN RECEIVED:", idToken ? "YES" : "NO");

    if (!idToken && !accessToken) {
      return res.status(400).json({ message: "Staff Token (ID or Access) required" });
    }

    let payload;

    // ✅ HYBRID VERIFICATION LOGIC
    if (idToken) {
      // Logic for standard JWT ID Tokens
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else if (accessToken) {
      // Logic for 'ya29...' style Access Tokens
      const googleRes = await axios.get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`
      );
      payload = googleRes.data;
      // Map googleapis field names to match verifyIdToken payload names
      payload.sub = payload.id; 
      payload.picture = payload.picture;
    }

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

    // ✅ ADMIN LOGIN CHECK (ONLY FOR ADMIN PANEL)
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

    // ✅ CHECK ONBOARDING STATUS
    const isOnboarded =
      user.onboardingCompleted === true ||
      Boolean(user.nickname && user.gender && user.dateOfBirth);

    // 🔐 Create JWT with Role
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      },
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