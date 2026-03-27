const express = require("express");
const router = express.Router();
const { saveBankDetails, getBankDetails } = require("../controllers/bankController");
const authMiddleware = require("../middlewares/auth");

// Save or update bank details
router.post("/", authMiddleware, saveBankDetails);

// Get bank details
router.get("/", authMiddleware, getBankDetails);

module.exports = router; 