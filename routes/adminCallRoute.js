// routes/adminCallRoute.js
const express = require("express");
const router = express.Router();
const Call = require("../models/Call");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

/**
 * @route   GET /api/admin/calls
 * @desc    Get all calls with filters
 */
router.get("/", auth, admin, async (req, res) => {
  try {
    const { status, callType, timeRange } = req.query;

    let filter = {};

    // Status filter
    if (status) filter.status = status;

    // Type filter
    if (callType) filter.callType = callType;

    // 🔥 Time range filter
    if (timeRange) {
      let startDate = new Date();

      switch (timeRange) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;

        case "2days":
          startDate.setDate(startDate.getDate() - 2);
          break;

        case "1week":
          startDate.setDate(startDate.getDate() - 7);
          break;

        case "1month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;

        case "6months":
          startDate.setMonth(startDate.getMonth() - 6);
          break;

        case "1year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      filter.createdAt = { $gte: startDate };
    }

    const calls = await Call.find(filter)
      .populate("callerId", "name email")
      .populate("hostId", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, calls });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/calls/:id
 * @desc    Get single call details
 */
router.get("/:id", auth, admin, async (req, res) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate("callerId", "name email")
      .populate("hostId", "name email");

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    res.json({ success: true, call });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/admin/calls/:id
 * @desc    Delete call record (admin only)
 */
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const call = await Call.findByIdAndDelete(req.params.id);

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    res.json({ success: true, message: "Call deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;