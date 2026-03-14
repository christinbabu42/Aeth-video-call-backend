const express = require("express");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

const router = express.Router();

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

router.post("/generate-token", (req, res) => {

    console.log("🔥 Incoming Agora Token Request:", req.body); // 👈 ADD THIS LINE

  const { channelName, uid } = req.body;

if (!channelName || typeof uid !== "number" || isNaN(uid)) {
  console.log("❌ Invalid channelName or uid:", channelName, uid);
  return res.status(400).json({ error: "channelName and valid uid required" });
}

  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpireTime
  );

  res.json({ token });
});

module.exports = router;