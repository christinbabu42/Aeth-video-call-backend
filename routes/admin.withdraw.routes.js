const express = require("express");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");
const User = require("../models/User");

const {
  getPendingWithdrawals,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal
} = require("../controllers/admin.withdraw.controller");

const router = express.Router();

// ✅ Get all withdrawals (pending + processing)
router.get("/pending", auth, admin, getPendingWithdrawals);

// ... existing imports

// ✅ Change :userId to :withdrawalId in all payout routes
router.post("/approve/:withdrawalId", auth, admin, approveWithdrawal);
router.post("/complete/:withdrawalId", auth, admin, completeWithdrawal);
router.post("/reject/:withdrawalId", auth, admin, rejectWithdrawal);

module.exports = router;
