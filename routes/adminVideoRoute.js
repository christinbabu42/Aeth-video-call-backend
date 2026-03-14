const express = require("express");
const router = express.Router();
const LiveStream = require("../models/LiveStream");
const LiveStreamViewer = require("../models/LiveStreamViewer");

// @route   GET /api/admin/video/all-streams
// @desc    Get all live streams with host details
router.get("/all-streams", async (req, res) => {
  try {
    const streams = await LiveStream.find()
      .populate("hostId", "name nickname profilePic")
      .sort({ startedAt: -1 });

    res.json(streams);
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// @route   PATCH /api/admin/video/end-stream/:streamId
// @desc    Force end a stream (Admin control)
router.patch("/end-stream/:streamId", async (req, res) => {
  try {
    const stream = await LiveStream.findByIdAndUpdate(
      req.params.streamId,
      { status: "ended", endedAt: Date.now() },
      { new: true }
    );
    
    // Also mark all active viewer sessions as inactive
    await LiveStreamViewer.updateMany(
      { liveStreamId: req.params.streamId, isActive: true },
      { isActive: false, leftAt: Date.now() }
    );

    res.json({ message: "Stream ended by admin", stream });
  } catch (err) {
    res.status(500).json({ message: "Action failed" });
  }
});

router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ message: "No IDs provided" });
    
    await LiveStream.deleteMany({ _id: { $in: ids } });
    // Optional: also delete associated viewer logs
    await LiveStreamViewer.deleteMany({ liveStreamId: { $in: ids } });
    
    res.json({ message: `${ids.length} streams deleted successfully.` });
  } catch (err) {
    res.status(500).json({ message: "Bulk delete failed" });
  }
});

module.exports = router;