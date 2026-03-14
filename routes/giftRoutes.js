const express = require("express");
const router = express.Router();
const { getAllGifts } = require("../controllers/giftController");

router.get("/", getAllGifts);

module.exports = router;
