const express = require("express");
const auth = require("../middlewares/auth");


const {
  createConnectAccount,
  getOnboardingLink
} = require("../controllers/stripe.connect.controller");

const router = express.Router();

router.post("/create-account", auth, createConnectAccount);
router.get("/onboarding-link", auth, getOnboardingLink);

module.exports = router;
