import { db } from "@/db";
import { tasks, taskAssignees, users, workspaceMembers, TaskAssigneeUser } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export async function batchFetchTaskAssignees(
  taskIds: string[]
): Promise<Map<string, TaskAssigneeUser[]>> {
  const map = new Map<string, TaskAssigneeUser[]>();
  if (taskIds.length === 0) return map;

  const rows = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      avatarColor: users.avatarColor,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(inArray(taskAssignees.taskId, taskIds))
    .orderBy(asc(taskAssignees.assignedAt));

  for (const row of rows) {
    const list = map.get(row.taskId) || [];
    list.push({
      id: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
      avatarColor: row.avatarColor,
    });
    map.set(row.taskId, list);
  }

  return map;
}

export async function updateTaskAssigneesInternal(
  taskId: string,
  userIds: string[],
  sessionUserId: string
): Promise<TaskAssigneeUser[]> {
  const [task] = await db
    .select({ id: tasks.id, workspaceId: tasks.workspaceId })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task) {
    throw new Error("Task not found.");
  }

  const [membership] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, task.workspaceId),
        eq(workspaceMembers.userId, sessionUserId)
      )
    );

  if (!membership) {
    throw new Error("Task not found.");
  }

  if (userIds.length > 0) {
    const validMembers = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, task.workspaceId),
          inArray(workspaceMembers.userId, userIds)
        )
      );

    const validUserIdSet = new Set(validMembers.map((m) => m.userId));
    const hasInvalidUser = userIds.some((id) => !validUserIdSet.has(id));
    if (hasInvalidUser) {
      throw new Error("One or more users are not members of this workspace.");
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));

    if (userIds.length > 0) {
      const uniqueUserIds = Array.from(new Set(userIds));
      await tx.insert(taskAssignees).values(
        uniqueUserIds.map((userId) => ({
          taskId,
          userId,
        }))
      );
    }
  });

  const assigneesMap = await batchFetchTaskAssignees([taskId]);
  return assigneesMap.get(taskId) || [];
}
