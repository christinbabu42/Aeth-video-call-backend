const express = require("express");
const mongoose = require("mongoose");
const ReportUser = require("../models/ReportUser");
const User = require("../models/User");
const auth = require("../middlewares/auth");
const admin = require("../middlewares/admin");

const router = express.Router();

/**
 * @route   GET /api/admin/reports
 * @desc    Get all reports (Admin)
 */
router.get("/", auth, admin, async (req, res) => {
  try {
    const reports = await ReportUser.find()
      .populate("reporter", "name email profilePic")
      .populate("reportedUser", "name email profilePic actionstatus")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Get Reports Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * @route   PATCH /api/admin/reports/:id
 * @desc    Update report status
 */
router.patch("/:id", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "reviewed", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const report = await ReportUser.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate("reporter", "name email")
      .populate("reportedUser", "name email");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      message: "Report status updated",
      report,
    });
  } catch (error) {
    console.error("Update Report Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * @route   DELETE /api/admin/reports/:id
 * @desc    Delete report (Admin)
 */
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const report = await ReportUser.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Delete Report Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


router.patch("/users/:id/suspend", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { actionstatus: "suspended" },
      { new: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.patch("/users/:id/ban", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { actionstatus: "banned" },
      { new: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.patch("/users/:id/reactivate", auth, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { actionstatus: "active" },
      { new: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;