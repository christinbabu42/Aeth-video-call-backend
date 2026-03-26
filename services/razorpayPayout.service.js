// services/razorpayPayout.service.js
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.payoutToUser = async ({ amount, accountNumber, ifsc }) => {
  const response = await razorpay.payouts.create({
    account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
    fund_account: {
      account_type: "bank_account",
      bank_account: {
        name: "User",
        ifsc: ifsc,
        account_number: accountNumber,
      },
    },
    amount: amount * 100, // paise
    currency: "INR",
    mode: "IMPS",
    purpose: "payout",
  });

  return response;
};