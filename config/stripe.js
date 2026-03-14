// config/stripe.js
import Stripe from "stripe";
import 'dotenv/config'; // make sure env is loaded

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default stripe;