const User = require("../models/User");
const Wallet = require("../models/Wallet");
const DeleteRequest = require("../models/DeleteRequest");

exports.requestDeleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isDeleted) {
      return res.status(400).json({ message: "Account already deleted" });
    }

    const wallet = await Wallet.findOne({ userId });

    if (wallet && wallet.balance > 0) {
      return res.status(400).json({
        message: "Please withdraw wallet balance before deleting account"
      });
    }

    const reason = req.body?.reason
      ? String(req.body.reason).trim().substring(0, 500)
      : "";

    // ✅ Mark as deleted
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.status = "offline"; // 🔥 force offline
    await user.save();

    // 🔥 EMIT SOCKET EVENT HERE
    const io = req.app.get("socketio");
    if (io) {
      io.emit("status-updated", {
        userId: user._id,
        status: "offline"
      });
    }

    await DeleteRequest.create({
      userId,
      reason
    });

    return res.json({
      success: true,
      message: "Account scheduled for deletion"
    });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};