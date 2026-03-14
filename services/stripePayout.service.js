const stripe = require("../config/stripe");

const COIN_TO_RUPEE = 0.62;

exports.payoutToUser = async ({ coins, stripeAccountId }) => {
  const amount = Math.floor(coins * COIN_TO_RUPEE * 100); // paise

  // 1️⃣ Transfer from platform → connected account
  await stripe.transfers.create({
    amount,
    currency: "inr",
    destination: stripeAccountId
  });

  // 2️⃣ Payout to bank (TEST MODE)
  await stripe.payouts.create(
    {
      amount,
      currency: "inr"
    },
    {
      stripeAccount: stripeAccountId
    }
  );

  return amount / 100;
};
