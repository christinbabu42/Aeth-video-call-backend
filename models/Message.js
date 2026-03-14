const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "gift", "image", "video", "audio"],
      default: "text",
    },

    // ✅ Text message (required only if type === text)
    text: {
      type: String,
      trim: true,
      required: function () {
        return this.type === "text";
      },
    },

    // ✅ Media URL (image or video)
    media: {
      type: String,
      required: function () {
        return this.type === "image" || this.type === "video";
      },
    },

    // ✅ Audio URL
    audio: {
      type: String,
      required: function () {
        return this.type === "audio";
      },
    },

    // ✅ Gift reference
    gift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gift",
      required: function () {
        return this.type === "gift";
      },
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Message", messageSchema);