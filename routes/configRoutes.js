const router = require('express').Router();
const Config = require('../models/Config');

// Public route for the App to fetch settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await Config.find({});
    // Convert array to a simple object { key: value }
    const configMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    
    res.json({ success: true, config: configMap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;