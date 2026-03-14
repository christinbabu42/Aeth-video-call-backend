const stripe = require("../config/stripe");
const User = require("../models/User");


exports.createConnectAccount = async (req, res) => {
     console.log("🔵 [createConnectAccount] API HIT");
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.stripeAccountId) {
    return res.json({ stripeAccountId: user.stripeAccountId });
  }

  const account = await stripe.accounts.create({
  type: "express",
  country: "IN",
  email: "testuser@email.com"
});


  user.stripeAccountId = account.id;
  await user.save();

  res.json({ stripeAccountId: account.id });
};

exports.getOnboardingLink = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.stripeAccountId) {
    return res.status(400).json({ message: "Stripe account not created" });
  }

  const link = await stripe.accountLinks.create({
    account: user.stripeAccountId,
    refresh_url: "http://localhost:5173/stripe/refresh",
    return_url: "http://localhost:5173/stripe/success",
    type: "account_onboarding"
  });

  res.json({ url: link.url });
};
