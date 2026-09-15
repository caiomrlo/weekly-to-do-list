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

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const [docsRes, projectsRes, docDetailRes, prefRes, workspacesRes] =
    await Promise.all([
      getUserDocsAction(),
      getUserProjectsAction(),
      getDocByIdAction(id),
      getUserPreferencesAction(),
      getUserWorkspacesAction(),
    ]);

  const initialDocs = docsRes.docs || [];
  const userProjects = projectsRes.projects || [];
  const initialSelectedDoc = docDetailRes.doc || null;
  const initialPreferences = prefRes.preferences || DEFAULT_USER_PREFERENCES;
  const workspaces = workspacesRes.workspaces || [];
  const activeWorkspaceId = workspacesRes.activeWorkspaceId || "";

  return (
    <DocsWorkspace
      key={activeWorkspaceId}
      initialDocs={initialDocs}
      userProjects={userProjects}
      userEmail={session.email}
      activeDocIdFromRoute={id}
      initialSelectedDoc={initialSelectedDoc}
      initialPreferences={initialPreferences}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
    />
  );
}
