const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { creditWallet } = require("../services/wallet.service");

const router = express.Router();

router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    const sig = req.headers["stripe-signature"];

    try {
        // STEP 1: Verification
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log("✅ [Webhook] Event Verified:", event.type);
    } catch (err) {
        console.error("❌ [Webhook] Signature Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // STEP 2: Logic for Succeeded Payment
    if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object;
        
        console.log("📦 [Webhook] Intent Metadata:", intent.metadata);

        try {
            // STEP 3: Use the Service to handle logic
            await creditWallet(intent);
        } catch (dbErr) {
            console.error("❌ [Webhook] Service Failure:", dbErr.message);
            return res.status(500).send("Database Update Failed");
        }
    }

    res.json({ received: true });
});

module.exports = router;