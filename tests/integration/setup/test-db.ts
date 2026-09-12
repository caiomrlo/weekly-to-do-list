import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export { db };

/**
 * Clean up a test user and all cascading relational records
 * (tasks, docs, projects, tags, attachments, junction tables).
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (err) {
    console.error(`Failed to cleanup test user ${userId}:`, err);
  }
}
