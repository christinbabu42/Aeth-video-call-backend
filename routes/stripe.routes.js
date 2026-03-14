const express = require("express");
const { createPaymentIntent, verifyPayment } = require("../controllers/stripe.controller.js");
const auth = require("../middlewares/auth"); // ✅ Ensure this points to the new file

const router = express.Router();

router.post("/create-payment-intent", auth, createPaymentIntent);
router.post("/verify-payment", auth, verifyPayment);

module.exports = router;