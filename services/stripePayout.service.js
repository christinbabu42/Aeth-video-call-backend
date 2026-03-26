const { getRateCoinConfig } = require("../config/RateCoinConfig");

exports.payoutToUser = async ({ coins, stripeAccountId }) => {
  const rateConfig = await getRateCoinConfig();

  const amount = Math.floor(coins * rateConfig.hostCoinValue * 100);

  await stripe.payouts.create(
    {
      amount,
      currency: "inr",
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  return amount / 100;
};