"use server";

import { db } from "@/db";
import { projects, Project } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getUserProjectsAction(): Promise<{ projects?: Project[]; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    const list = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, session.userId))
      .orderBy(asc(projects.name));

    return { projects: list };
  } catch (err: unknown) {
    console.error("Error fetching projects:", err);
    return { error: "Failed to fetch projects." };
  }
}

export async function createProjectAction(data: {
  name: string;
  color?: string;
}): Promise<{ project?: Project; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const name = data.name.trim();
  if (!name) {
    return { error: "Project name cannot be empty." };
  }

  if (name.length > 50) {
    return { error: "Project name must be at most 50 characters." };
  }

  const validColors = [
    "indigo",
    "violet",
    "emerald",
    "amber",
    "rose",
    "sky",
    "orange",
    "slate",
  ];
  const color = data.color && validColors.includes(data.color) ? data.color : "amber";

  try {
    const now = new Date();
    const [newProject] = await db
      .insert(projects)
      .values({
        userId: session.userId,
        name,
        color,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    revalidatePath("/");
    return { project: newProject };
  } catch (err: unknown) {
    console.error("Error creating project:", err);
    return { error: "Failed to create project." };
  }
}

export async function deleteProjectAction(
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  try {
    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)));

    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error deleting project:", err);
    return { error: "Failed to delete project." };
  }
}

export async function updateProjectAction(
  projectId: string,
  data: {
    name?: string;
    color?: string;
  }
): Promise<{ project?: Project; error?: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Not authenticated." };
  }

  const updates: Partial<{ name: string; color: string; updatedAt: Date }> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) {
      return { error: "Project name cannot be empty." };
    }
    if (trimmed.length > 50) {
      return { error: "Project name must be at most 50 characters." };
    }
    updates.name = trimmed;
  }

  if (data.color !== undefined) {
    const validColors = [
      "indigo",
      "violet",
      "emerald",
      "amber",
      "rose",
      "sky",
      "orange",
      "slate",
    ];
    if (validColors.includes(data.color)) {
      updates.color = data.color;
    }
  }

  try {
    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
      .returning();

    if (!updated) {
      return { error: "Project not found or access denied." };
    }

    revalidatePath("/");
    revalidatePath("/docs");

    return { project: updated };
  } catch (err: unknown) {
    console.error("Error updating project:", err);
    return { error: "Failed to update project." };
  }
}


