import express from "express";
import stripeRoutes from "./routes/stripe.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import stripeWebhook from "./webhooks/stripe.webhook.js";

const app = express();

app.use("/webhook", stripeWebhook);
app.use(express.json());

app.use("/api/stripe", stripeRoutes);
app.use("/api/wallet", walletRoutes);

export default app;
