const express = require("express");
const router = express.Router();

const {
  saveBankDetails,
  getBankDetails
} = require("../controllers/bankController");

const authMiddleware = require("../middlewares/auth"); // adjust if your auth path is different

// ✅ Save bank details
router.post("/bank-details", authMiddleware, saveBankDetails);

// ✅ Get bank details (optional - useful for edit screen)
router.get("/bank-details", authMiddleware, getBankDetails);

module.exports = router;