import "dotenv/config";


async function run() {
  const args = process.argv.slice(2);
  const forceMorning = args.includes("--force-morning");
  const dryRun = args.includes("--dry-run");

  const dateArg = args.find((a) => a.startsWith("--date="));
  const refDate = dateArg ? new Date(dateArg.split("=")[1]) : new Date();

  console.log("===============================================================================");
  console.log("Weekly To-Do List - Push Notification Dispatcher (CLI Test)");
  console.log("===============================================================================");
  console.log(`Reference Date : ${refDate.toISOString()}`);
  console.log(`Force Morning  : ${forceMorning ? "YES" : "NO"}`);
  console.log(`Dry Run Mode   : ${dryRun ? "YES (simulation only)" : "NO (live push & log)"}`);
  console.log("===============================================================================");
  console.log("Running notification dispatch engine...");

  const startTime = Date.now();
  try {
    const { dispatchNotifications } = await import("../src/lib/notifications/dispatcher");
    const result = await dispatchNotifications({
      refDate,
      forceMorning,
      dryRun,
    });

    const elapsed = Date.now() - startTime;

    console.log("");
    console.log("-------------------------------------------------------------------------------");
    console.log("Dispatch Summary:");
    console.log(`- Subscribed Users Evaluated: ${result.usersEvaluated}`);
    console.log(`- Morning Summaries Sent    : ${result.morningSummariesSent}`);
    console.log(`- Morning Summaries Skipped : ${result.morningSummariesSkipped} (already sent today)`);
    console.log(`- Task Reminders Sent       : ${result.taskRemindersSent}`);
    console.log(`- Task Reminders Skipped    : ${result.taskRemindersSkipped} (already sent)`);
    console.log(`- Execution Time            : ${elapsed}ms`);
    if (result.errors.length > 0) {
      console.log(`- Errors (${result.errors.length}):`);
      for (const err of result.errors) {
        console.error(`  * ${err}`);
      }
    }
    console.log("-------------------------------------------------------------------------------");
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Fatal error during dispatch execution:", err);
    process.exit(1);
  }
}

run();
