const RateCoinConfig = require("../models/RateCoinConfig");

let cachedConfig = null;

async function getRateCoinConfig() {
  if (cachedConfig) return cachedConfig;

  let config = await RateCoinConfig.findOne();
  if (!config) {
    config = await RateCoinConfig.create({});
  }

  cachedConfig = config;
  return config;
}

// Clear cache when admin updates
function clearConfigCache() {
  cachedConfig = null;
}

module.exports = {
  getRateCoinConfig,
  clearConfigCache
};
