const express = require("express");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

const {
  getPendingWithdrawals,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal
} = require("../controllers/admin.withdraw.controller");

const router = express.Router();

// ✅ Get all withdrawals (pending + processing)
router.get("/pending", auth, admin, getPendingWithdrawals);

// ✅ STEP 1: Approve → pending → processing
router.post("/approve/:userId", auth, admin, approveWithdrawal);

// ✅ STEP 2: Complete → processing → completed
router.post("/complete/:userId", auth, admin, completeWithdrawal);

// ❌ STEP 3: Reject → refund coins
router.post("/reject/:userId", auth, admin, rejectWithdrawal);

module.exports = router;