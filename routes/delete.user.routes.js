const express = require("express");
const router = express.Router();
const { requestDeleteAccount } = require("../controllers/delete.user.controller");
const authMiddleware = require("../middlewares/auth");

router.post("/delete-account", authMiddleware, requestDeleteAccount);

module.exports = router;