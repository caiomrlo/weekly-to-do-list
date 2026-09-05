import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("⚠️  DATABASE_URL não configurada. Ignorando migrações automáticas.");
    return;
  }

  console.log("🚀 Iniciando verificação e aplicação de migrações no banco de dados...");

  let pool = null;
  let success = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await pool.connect();
      client.release();

      const db = drizzle(pool);
      await migrate(db, { migrationsFolder: "./drizzle" });

      console.log("✅ Migrações aplicadas/verificadas com sucesso!");
      success = true;
      break;
    } catch (error) {
      console.warn(
        `⏳ Tentativa ${attempt}/${MAX_RETRIES} de conexão ou migração falhou (${error.message}). Tentando novamente em ${RETRY_DELAY_MS / 1000}s...`
      );
      if (pool) {
        try {
          await pool.end();
        } catch {
          // ignore cleanup error
        }
      }
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  if (pool && success) {
    try {
      await pool.end();
    } catch {
      // ignore cleanup error
    }
  }

  if (!success) {
    console.error("❌ Não foi possível conectar ao banco de dados ou aplicar as migrações após as tentativas.");
    process.exit(1);
  }
}

runMigrations();
