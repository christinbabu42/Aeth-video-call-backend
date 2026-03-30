const mongoose = require("mongoose");
const Avatar = require("../models/Avatar");

mongoose.connect("mongodb+srv://christinbabu42_db_user:JNtGNNu2QagQ3uZP@cluster0.p1foncl.mongodb.net/aeth_app?appName=Cluster0");

const boys = Array.from({ length: 10 }).map((_, i) => ({
  url: `/public/avathar-boy/${i + 1}.png`,
  gender: "boy",
}));

const girls = Array.from({ length: 10 }).map((_, i) => ({
  url: `/public/avathar-girl/${i + 1}.png`,
  gender: "girl",
}));

async function seed() {
  await Avatar.deleteMany();
  await Avatar.insertMany([...boys, ...girls]);
  console.log("✅ Avatars seeded");
  process.exit();
}

seed();