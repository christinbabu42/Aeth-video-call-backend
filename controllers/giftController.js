const Gift = require("../models/Gift");


// GET ALL GIFTS
exports.getAllGifts = async (req, res) => {
  try {
    const gifts = await Gift.find({ active: true }).sort({ price: 1 });

    res.json({
      success: true,
      gifts
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
