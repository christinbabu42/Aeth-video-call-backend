const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const { getIncome } = require("../controllers/income.controller");

router.get("/", auth, getIncome);

router.post("/withdraw", auth, (req, res) => {
  res.status(200).json({ success: true, message: "Withdrawal request received" });
});

module.exports = router;
