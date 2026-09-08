import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserDocsAction } from "@/app/actions/docs";
import { getUserProjectsAction } from "@/app/actions/projects";
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

  const [docsRes, projectsRes] = await Promise.all([
    getUserDocsAction(),
    getUserProjectsAction(),
  ]);

  const initialDocs = docsRes.docs || [];
  const userProjects = projectsRes.projects || [];

  return (
    <DocsWorkspace
      initialDocs={initialDocs}
      userProjects={userProjects}
      userEmail={session.email}
    />
  );
}
