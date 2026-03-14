const mongoose = require("mongoose");

const giftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  price: {
    type: Number, // coins
    required: true
  },

  image: {
    type: String, // filename only (rose.png)
    required: true
  },

  category: {
    type: String,
    default: "default"
  },

  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Gift", giftSchema);  