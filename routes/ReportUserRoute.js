const express = require("express");
const router = express.Router();
const ReportUser = require("../models/ReportUser");
const User = require("../models/User");
const auth = require("../middlewares/auth");

// POST /api/report-user
router.post("/", auth, async (req, res) => {
  try {

    const { reportedUserId, reason, description } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (reportedUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot report yourself",
      });
    }

    const reportedUser = await User.findById(reportedUserId);

    if (!reportedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const report = await ReportUser.create({
      reporter: req.user.id,
      reportedUser: reportedUserId,
      reason,
      description: description || "",
    });

    await User.findByIdAndUpdate(reportedUserId, {
      $inc: { reportCount: 1 },
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already reported this user. Wait for the action",
      });
    }

    console.error("Report User Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// GET my reported users
router.get("/my-reports", auth, async (req, res) => {
  try {

    const reports = await ReportUser.find({
      reporter: req.user.id
    })
      .populate("reportedUser", "name nickname profilePic")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      reports
    });

  } catch (err) {
    console.error("Fetch reports error", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;