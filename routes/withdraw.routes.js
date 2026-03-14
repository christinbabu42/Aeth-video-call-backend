const express = require("express");
const auth = require("../middlewares/auth");
const { requestWithdraw } = require("../controllers/withdraw.controller");

const router = express.Router();

router.post("/", auth, requestWithdraw);

module.exports = router;
