import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserDocsAction, getDocByIdAction } from "@/app/actions/docs";
import { getUserProjectsAction } from "@/app/actions/projects";
import { getUserPreferencesAction } from "@/app/actions/user";
import { getUserWorkspacesAction } from "@/app/actions/workspaces";
import { DEFAULT_USER_PREFERENCES } from "@/db/schema";
import { DocsWorkspace } from "@/components/docs/DocsWorkspace";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs & Notes | Weekly Planning",
  description: "Create, organize and link rich-text documents and notes with your weekly tasks.",
};

export default async function DocsPage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const [docsRes, projectsRes, prefRes, workspacesRes] = await Promise.all([
    getUserDocsAction(),
    getUserProjectsAction(),
    getUserPreferencesAction(),
    getUserWorkspacesAction(),
  ]);

  const initialDocs = docsRes.docs || [];
  const userProjects = projectsRes.projects || [];
  const initialPreferences = prefRes.preferences || DEFAULT_USER_PREFERENCES;
  const workspaces = workspacesRes.workspaces || [];
  const activeWorkspaceId = workspacesRes.activeWorkspaceId || "";

  let initialSelectedDoc = null;
  if (initialDocs.length > 0) {
    const firstDocRes = await getDocByIdAction(initialDocs[0].id);
    initialSelectedDoc = firstDocRes.doc || null;
  }

  return (
    <DocsWorkspace
      key={activeWorkspaceId}
      initialDocs={initialDocs}
      userProjects={userProjects}
      userEmail={session.email}
      initialSelectedDoc={initialSelectedDoc}
      initialPreferences={initialPreferences}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
    />
  );
}
