module.exports = (req, res, next) => {
  console.log("🔥 ADMIN CHECK USER:", {
    email: req.user?.email,
    role: req.user?.role,
  });

  // Auth middleware must run first
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  // 🔒 STRICT — only admin & superadmin
  const allowedRoles = ["admin", "superadmin", "finance", "support"];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Admin access denied",
    });
  }

  next();
};