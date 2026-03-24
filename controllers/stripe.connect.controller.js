const stripe = require("../config/stripe");
const User = require("../models/User");

/**
 * Creates a Stripe Connect Express account for the user (Host)
 * Country is set to IN (India) as per your requirements.
 */
exports.createConnectAccount = async (req, res) => {
  try {
    console.log("🔵 [createConnectAccount] API HIT");
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // If user already has an account ID, return it to prevent duplicates
    if (user.stripeAccountId) {
      return res.json({ success: true, stripeAccountId: user.stripeAccountId });
    }

    // Create the Express account on Stripe
    const account = await stripe.accounts.create({
      type: "express",
      country: "IN",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    // Save the ID to your MongoDB User model
    user.stripeAccountId = account.id;
    await user.save();

    res.json({ success: true, stripeAccountId: account.id });
  } catch (error) {
    console.error("❌ Stripe Account Creation Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generates the onboarding link that redirects the user to Stripe's hosted setup page.
 * Uses environment variables for production/development switching.
 */
exports.getOnboardingLink = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.stripeAccountId) {
      return res.status(400).json({ 
        success: false, 
        message: "Stripe account not created. Call createConnectAccount first." 
      });
    }

    // Stripe requires absolute URLs (HTTPS in production)
    // These should be set in your backend .env file
    const refreshUrl = process.env.STRIPE_REFRESH_URL || "http://localhost:5173/stripe/refresh";
    const returnUrl = process.env.STRIPE_RETURN_URL || "http://localhost:5173/stripe/success";

    const link = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    res.json({ success: true, url: link.url });
  } catch (error) {
    console.error("❌ Stripe Link Generation Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};