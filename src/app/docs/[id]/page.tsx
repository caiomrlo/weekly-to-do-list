import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserDocsAction, getDocByIdAction } from "@/app/actions/docs";
import { getUserProjectsAction } from "@/app/actions/projects";
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

  const [docsRes, projectsRes, docDetailRes] = await Promise.all([
    getUserDocsAction(),
    getUserProjectsAction(),
    getDocByIdAction(id),
  ]);

  const initialDocs = docsRes.docs || [];
  const userProjects = projectsRes.projects || [];
  const initialSelectedDoc = docDetailRes.doc || null;

  return (
    <DocsWorkspace
      initialDocs={initialDocs}
      userProjects={userProjects}
      userEmail={session.email}
      activeDocIdFromRoute={id}
      initialSelectedDoc={initialSelectedDoc}
    />
  );
}
