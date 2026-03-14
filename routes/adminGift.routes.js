const express = require("express");
const router = express.Router();
const Gift = require("../models/Gift");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

console.log("✅ adminGift.routes loaded");

// GET ALL
router.get("/", auth, admin,async (req, res) => {
  const gifts = await Gift.find().sort({ price: 1 });
  res.json({
    success: true,
    data: gifts
  });
});

// CREATE
router.post("/",auth, admin, async (req, res) => {
  const gift = await Gift.create(req.body);
  res.json({
    success: true,
    data: gift
  });
});

// UPDATE
router.put("/:id", auth, admin,async (req, res) => {
  const gift = await Gift.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json({
    success: true,
    data: gift
  });
});

// DELETE
// DELETE
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const gift = await Gift.findByIdAndDelete(req.params.id);
    if (!gift) return res.status(404).json({ message: "Gift not found" });
    res.json({ success: true, message: "Gift deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;
