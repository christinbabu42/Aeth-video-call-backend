const User = require("../models/User");

/**
 * SAVE / UPDATE BANK DETAILS
 */
exports.saveBankDetails = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware

    const {
      accountHolderName,
      accountNumber,
      ifsc,
      bankName,
      upiId,
      paypalEmail
    } = req.body;

    // ✅ Validation
    if (!accountHolderName || !accountNumber || !ifsc) {
      return res.status(400).json({
        message: "Required fields missing"
      });
    }

    // Optional IFSC validation (extra safety)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) {
      return res.status(400).json({
        message: "Invalid IFSC code"
      });
    }

    // ✅ Update user
    const user = await User.findByIdAndUpdate(
      userId,
      {
        bankDetails: {
          accountHolderName,
          accountNumber,
          ifsc,
          bankName
        },
        upiId,
        paypalEmail
      },
      { new: true }
    );

    return res.json({
      success: true,
      message: "Bank details saved",
      bankAdded: user.bankAdded
    });

  } catch (err) {
    console.error("Bank save error:", err);
    res.status(500).json({
      message: "Server error"
    });
  }
};


/**
 * GET BANK DETAILS (for edit/view)
 */
exports.getBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "bankDetails upiId paypalEmail bankAdded"
    );

    res.json({
      success: true,
      data: user
    });

  } catch (err) {
    res.status(500).json({ message: "Failed to fetch" });
  }
};