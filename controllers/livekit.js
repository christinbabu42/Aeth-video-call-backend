// Example Backend Logic (controllers/livekit.js)
const { AccessToken } = require('livekit-server-sdk');

const getToken = async (req, res) => {
  const { room, userId, name } = req.query;

  // 1. Initialize the AccessToken
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY, 
    process.env.LIVEKIT_API_SECRET, 
    { identity: userId, name: name }
  );

  // 2. Add Permissions
  at.addGrant({ 
    roomJoin: true, 
    room: room, 
    canPublish: true, 
    canSubscribe: true 
  });

  // 3. GENERATE THE JWT (This is what you might be missing)
  const token = await at.toJwt();

  // 4. Send back as an object
  res.json({
    token: token,
    url: process.env.LIVEKIT_URL
  });
};