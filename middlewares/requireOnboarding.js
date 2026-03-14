// middleware/requireOnboarding.js
module.exports = function requireOnboarding(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  if (!req.user.onboardingCompleted) {
    return res.status(403).json({
      success: false,
      onboardingRequired: true,
      message: "Complete onboarding first",
    });
  }

  next();
};