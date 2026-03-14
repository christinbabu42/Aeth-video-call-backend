const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else {
      token = req.headers["x-auth-token"];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("JWT DECODED PAYLOAD:", decoded);

    // 🔥 FETCH FULL USER FROM DB
    const user = await User.findById(decoded.id);

    // 🚫 1️⃣ BLOCK IF USER NOT FOUND OR DELETED
    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: "Account not found or deleted",
        forceLogout: true, // 🔥 frontend hint to clear local storage
      });
    }

    // 🚫 2️⃣ BLOCK BANNED / SUSPENDED USERS
    if (user.actionstatus !== "active") {
      return res.status(403).json({
        success: false,
        message:
          user.actionstatus === "banned"
            ? "Your account has been banned"
            : "Your account is suspended",
        forceLogout: true, // 🔥 frontend hint
      });
    }

    // 🔥 Attach full user object
    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};