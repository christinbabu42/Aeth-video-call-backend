const User = require("../models/User");
const Follow = require("../models/Follow");
const Block = require("../models/Block");
const Visitor = require("../models/Visitor");
const LiveStreamViewer = require("../models/LiveStreamViewer");

exports.cleanupDeletedUsers = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  //const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);

  // 🔍 Find users already soft-deleted
  const users = await User.find({
    isDeleted: true,
    deletedAt: { $lt: thirtyDaysAgo }
    //deletedAt: { $lt: oneMinuteAgo }
  });

  if (!users.length) {
    console.log("No users to cleanup");
    return;
  }

  const ids = users.map(u => u._id);

  // 🧹 Remove social relations (Follow)
  await Follow.deleteMany({
    $or: [
      { follower: { $in: ids } },
      { following: { $in: ids } }
    ]
  });

  // 🧹 Remove block relations
  await Block.deleteMany({
    $or: [
      { blocker: { $in: ids } },
      { blocked: { $in: ids } }
    ]
  });

  // 🧹 Remove visitors data
  await Visitor.deleteMany({
    $or: [
      { visitor: { $in: ids } },
      { visited: { $in: ids } }
    ]
  });

  // 🧹 Remove live stream viewer records
  await LiveStreamViewer.deleteMany({
    userId: { $in: ids }
  });

  // ⚠️ DO NOT TOUCH:
  // - Calls
  // - Messages
  // - Reports
  // - LiveStreams
  // - Any financial records

  // 🧨 Permanently remove users
  await User.deleteMany({ _id: { $in: ids } });

  console.log("Deleted permanently:", ids.length);
};