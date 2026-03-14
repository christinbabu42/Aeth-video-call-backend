const cron = require("node-cron");
const { cleanupDeletedUsers } = require("./deleteCleanup");

function startCronJobs() {
  cron.schedule("* * * * *", async () => {
    console.log("🧹 Running cleanup job...");
    await cleanupDeletedUsers();
  });
}

module.exports = startCronJobs;