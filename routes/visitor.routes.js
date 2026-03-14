const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const Visitor = require("../models/Visitor");
const User = require("../models/User");

/**
 * GET VISITORS LIST
 * GET /api/visitor/list
 */
// GET /api/visitor/list/:userId
router.get("/list/:userId", auth, async (req, res) => {
  try {
    const visitedUserId = req.params.userId;

    const rawVisitors = await Visitor.find({ visited: visitedUserId })
      .populate("visitor", "name nickname profilePic")
      .sort({ createdAt: -1 });

    const activeVisitors = rawVisitors.filter(v => v.visitor !== null);

    const uniqueMap = new Map();
    activeVisitors.forEach(item => {
      const id = item.visitor._id.toString();
      if (!uniqueMap.has(id)) uniqueMap.set(id, item);
    });

    res.json({
      success: true,
      visitors: Array.from(uniqueMap.values()),
    });
  } catch (err) {
    console.error("Visitor list error:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ADD VISITOR
 * POST /api/visitor/:userId
 */
router.post("/:userId", auth, async (req, res) => {
  try {
    const visitedUserId = req.params.userId;
    const visitorId = req.user.id;

    if (visitedUserId === visitorId) {
      return res.json({ success: true });
    }

    const alreadyVisited = await Visitor.findOne({
      visitor: visitorId,
      visited: visitedUserId,
    });

    if (!alreadyVisited) {
      await Visitor.create({
        visitor: visitorId,
        visited: visitedUserId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Visitor error:", err);
    res.status(500).json({ success: false });
  }
});
// GET /api/visitor/count/:userId
router.get("/count/:userId", auth, async (req, res) => {
  try {
    const uniqueVisitors = await Visitor.distinct("visitor", {
      visited: req.params.userId,
    });

    res.json({
      success: true,
      count: uniqueVisitors.length,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


module.exports = router;