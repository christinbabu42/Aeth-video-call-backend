const XP_MULTIPLIER = 500;

function getXPForLevel(level) {
  return level * level * XP_MULTIPLIER;
}

function calculateLevel(totalXP) {
  let level = 0;

  while (totalXP >= getXPForLevel(level + 1)) {
    level++;
  }

  return level;
}

module.exports = {
  getXPForLevel,
  calculateLevel
};