const express = require("express");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

const {
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} = require("../controllers/admin.withdraw.controller");

const router = express.Router();

// Get all pending withdrawals
router.get("/pending", auth, admin, getPendingWithdrawals);

// Approve withdrawal
router.post(
  "/approve/:userId",
  auth,
  admin,
  (req, res, next) => {
    next();
  },
  approveWithdrawal
);


// Reject withdrawal
router.post("/reject/:userId", auth, admin, rejectWithdrawal);

module.exports = router;
