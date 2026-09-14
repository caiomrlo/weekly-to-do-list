import "dotenv/config";
import pg from "pg";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const { Client } = pg;
const CONFIRMATION_TEXT = "RESET LOCAL DATABASE";
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to reset the database.");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Database reset is not allowed when NODE_ENV is production.");
  }

  const databaseUrl = new URL(connectionString);

  if (!LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname)) {
    throw new Error("Database reset is allowed only for a local database host.");
  }

  return connectionString;
}

async function confirmReset() {
  const prompt = createInterface({ input, output });

  try {
    const answer = await prompt.question(
      `This deletes every table and all data in the local database. Type ${CONFIRMATION_TEXT} to continue: `
    );

    return answer === CONFIRMATION_TEXT;
  } finally {
    prompt.close();
  }
}

async function resetDatabase() {
  let connectionString;

  try {
    connectionString = getConnectionString();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (!(await confirmReset())) {
    console.log("Database reset cancelled.");
    return;
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("CREATE SCHEMA public AUTHORIZATION CURRENT_USER");
    await client.query("COMMIT");
    console.log("Local database reset successfully. Run npm run db:migrate to recreate the tables and migration history.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error(`Database reset failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

resetDatabase();
