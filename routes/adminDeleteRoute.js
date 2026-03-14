const express = require("express");
const router = express.Router();
const DeleteRequest = require("../models/DeleteRequest"); // Adjust path
const User = require("../models/User"); // Adjust path

// @route   GET /api/admin/delete-requests
// @desc    Get all pending delete requests with user details
router.get("/delete-requests", async (req, res) => {
  try {
    const requests = await DeleteRequest.find({ status: "pending" })
      .populate("userId", "name nickname profilePic email phoneNumber")
      .sort({ requestedAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// @route   DELETE /api/admin/process-delete/:requestId
// @desc    Permanently delete user and mark request as processed
router.delete("/process-delete/:requestId", async (req, res) => {
  try {
    const request = await DeleteRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // 1. Delete the actual User
    await User.findByIdAndDelete(request.userId);

    // 2. Mark request as processed (or delete the request record)
    request.status = "processed";
    await request.save();

    res.json({ message: "User permanently deleted and request processed." });
  } catch (err) {
    res.status(500).json({ message: "Action failed", error: err.message });
  }
});

module.exports = router;