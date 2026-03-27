const User = require("../models/User");

exports.saveBankDetails = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { 
      accountHolderName, 
      accountNumber, 
      ifsc, 
      bankName, 
      upiId, 
      paypalEmail, 
      phone,       // ✅ New
      country, 
      countryName 
    } = req.body;

    // 1. Basic Validation
    if (!accountHolderName || !accountNumber) {
      return res.status(400).json({ message: "Account name and number are required" });
    }

    // 2. Conditional IFSC Validation (Only for India)
    if (country === "IN" || countryName === "India") {
      if (!ifsc) {
        return res.status(400).json({ message: "IFSC code is required for Indian bank accounts" });
      }
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifsc)) {
        return res.status(400).json({ message: "Invalid IFSC code format" });
      }
    }

    // 3. Update User
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.bankDetails = { accountHolderName, accountNumber, ifsc, bankName, phone  };
    user.upiId = upiId;
    user.paypalEmail = paypalEmail;
    user.country = country || "IN";
    user.countryName = countryName || "India";

    // The pre-save hook in the model will automatically set 'bankAdded' to true
    await user.save();

    res.json({
      success: true,
      message: "Bank details saved successfully",
      data: {
        bankAdded: user.bankAdded,
        bankDetails: user.bankDetails,
        upiId: user.upiId,
        paypalEmail: user.paypalEmail,
        country: user.country,
        countryName: user.countryName
      },
    });
  } catch (err) {
    console.error("Bank save error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      "bankDetails upiId paypalEmail email phone bankAdded country countryName"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, data: user });
  } catch (err) {
    console.error("Failed to fetch bank details:", err);
    res.status(500).json({ message: "Server error" });
  }
};