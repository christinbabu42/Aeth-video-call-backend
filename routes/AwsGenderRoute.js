const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  RekognitionClient,
  DetectFacesCommand,
} = require("@aws-sdk/client-rekognition");


// Correct code (Uppercase matches your .env)
console.log("ACCESS:", process.env.AWS_Rekognition_ACCESS_KEY);
console.log("SECRET:", process.env.AWS_Rekognition_SECRET_ACCESS_KEY);

// memory storage (no file save)
const upload = multer({ storage: multer.memoryStorage() });

// AWS client
const client = new RekognitionClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_Rekognition_ACCESS_KEY,
    secretAccessKey: process.env.AWS_Rekognition_SECRET_ACCESS_KEY,
  },
});

// POST /api/aws/detect-gender
router.post("/detect-gender", upload.single("image"), async (req, res) => {
    console.log("reached")
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image required" });
    }

    const command = new DetectFacesCommand({
      Image: {
        Bytes: req.file.buffer,
      },
      Attributes: ["ALL"],
    });

    const response = await client.send(command);

    if (!response.FaceDetails || response.FaceDetails.length === 0) {
      return res.json({ gender: null, message: "No face detected" });
    }

    const genderData = response.FaceDetails[0].Gender;

    res.json({
      gender: genderData.Value, // Male / Female
      confidence: genderData.Confidence,
    });
  } catch (error) {
    console.error("AWS Rekognition Error:", error);
    res.status(500).json({ message: "Detection failed" });
  }
});

module.exports = router;