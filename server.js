require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const googleAuthRoutes = require("./routes/googleAuth");
const userRoutes = require("./routes/user");
const adminuserRoutes = require("./routes/adminuser"); 
const stripeRoutes = require("./routes/stripe.routes.js");
const walletRoutes = require("./routes/wallet.routes.js");
const stripeWebhook = require("./webhooks/stripe.webhook.js");
const adminTransactionRoute = require("./routes/adminTransactionRoute");
const callRoutes = require("./routes/call.routes.js");
const incomeRoutes = require("./routes/incomeRoute");
const startCronJobs = require("./jobs/cron.js"); // adjust path if needed

const path = require("path");
const app = express();
const server = http.createServer(app);

// Connect DB
connectDB();

app.get("/", (req, res) => {
  res.send("API running...");
});

app.use(cors({
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE" ,"PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use("/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.json());

//multer media
app.use('/public', express.static('public'));

// Routes
app.use("/api/auth", googleAuthRoutes);
app.use("/api/user", userRoutes);
app.use("/api/follow", require("./routes/follow.routes"));
app.use("/api/visitor", require("./routes/visitor.routes"));
app.use("/api/messages", require("./routes/MessageRoute.js"));
app.use("/api/stripe", stripeRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminuserRoutes);
app.use("/api/wallet/admin", adminTransactionRoute);
app.use("/api/calls", callRoutes);
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/api/gifts", require("./routes/giftRoutes"));
app.use("/api/gift-purchase", require("./routes/giftPurchase.routes"));
app.use("/api/admin/gifts", require("./routes/adminGift.routes"));
app.use("/api/admin/gift-transactions", require("./routes/adminGiftTransaction.routes"));
app.use("/api/income", incomeRoutes);
app.use("/api/livekit", require("./routes/livekit.routes"));
app.use("/api/admin/rate-config", require("./routes/AdminRateCoinConfigRoute.js"));
app.use("/api/admin/revenue", require("./routes/AdminRevenueRoute.js"));
app.use("/api/coin-packs", require("./routes/coinPack.routes.js"));
app.use("/api/admin/coin-packs", require("./routes/adminPurchaseCoinRoute"));
app.use("/api/admin/calls", require("./routes/adminCallRoute"));
app.use("/api/withdraw", require("./routes/withdraw.routes.js"));
app.use("/api/admin/withdraw", require("./routes/admin.withdraw.routes.js"));
app.use("/api/stripe/connect", require("./routes/stripe.payout.connect.routes.js"));
app.use("/api/aws", require("./routes/AwsGenderRoute.js"));
app.use("/api/report-user", require("./routes/ReportUserRoute.js"));
app.use("/api/admin/reports", require("./routes/AdminReportRoute.js"));
app.use("/api/block", require("./routes/blockRoute.js"));
app.use("/api/delete", require("./routes/delete.user.routes.js"));
app.use("/api/admin/delete", require("./routes/adminDeleteRoute.js"));
app.use("/api/admin/video", require("./routes/adminVideoRoute"));
app.use("/agora", require("./routes/agoraTokenRoute.js"));




// ================= REDIS & SOCKET.IO SETUP =================

const startServer = async () => {
  let socketOptions = {};

  try {
    // 1. Setup Redis Clients with NO RECONNECT strategy for local dev
    const pubClient = createClient({ 
      url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      socket: {
        reconnectStrategy: false // ❌ Stop the infinite loop if it fails once
      }
    });

    const subClient = pubClient.duplicate();

    // 2. Try to connect
    console.log("⏳ Attempting Redis connection...");
    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    console.log("✅ Redis Adapter Connected");
    socketOptions.adapter = createAdapter(pubClient, subClient);

  } catch (err) {
    console.error("⚠️ Redis not running. Continuing in Local Memory Mode.");
  }

  // 3. Initialize Socket.io (regardless of Redis success)
  const io = initSocket(server, socketOptions);
  app.set("socketio", io); 

  // ✅ START CRON JOBS HERE
  startCronJobs();

  // ================= START SERVER =================
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend running on port ${PORT}`);
  });
};

startServer();