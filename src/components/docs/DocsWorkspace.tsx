"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  DocWithRelations,
  Project,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  BackgroundThemeId,
  Workspace,
} from "@/db/schema";
import {
  createDocAction,
  toggleDocFavoriteAction,
  getDocByIdAction,
} from "@/app/actions/docs";
import { updateUserPreferencesAction } from "@/app/actions/user";
import { useDarkMode } from "@/lib/hooks/useDarkMode";
import { AppHeader } from "@/components/header/AppHeader";
import { DocsSidebar } from "./DocsSidebar";
import { DocEditor } from "./DocEditor";
import { FileText, Plus, Loader2 } from "lucide-react";

interface DocsWorkspaceProps {
  initialDocs: DocWithRelations[];
  userProjects: Project[];
  userEmail: string;
  userName?: string;
  userImage?: string | null;
  userAvatarColor?: string | null;
  userId?: string;
  activeDocIdFromRoute?: string;
  initialSelectedDoc?: DocWithRelations | null;
  initialPreferences?: UserPreferences;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}

export function DocsWorkspace({
  initialDocs,
  userProjects: initialProjects,
  userEmail,
  userName,
  userImage,
  userAvatarColor,
  userId,
  activeDocIdFromRoute,
  initialSelectedDoc,
  initialPreferences,
  workspaces,
  activeWorkspaceId,
}: DocsWorkspaceProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [docs, setDocs] = useState<DocWithRelations[]>(initialDocs);
  const [userProjects, setUserProjects] = useState<Project[]>(initialProjects);
  const [preferences, setPreferences] = useState<UserPreferences>(
    initialPreferences || DEFAULT_USER_PREFERENCES
  );

  // Backward compatibility: gracefully redirect legacy /docs?docId=xyz to clean /docs/xyz
  useEffect(() => {
    const legacyDocId = searchParams.get("docId");
    if (legacyDocId) {
      router.replace(`/docs/${legacyDocId}`);
    }
  }, [searchParams, router]);

  const routeParamId =
    typeof params?.id === "string" ? params.id : activeDocIdFromRoute || null;

  const activeDocId =
    routeParamId && docs.some((d) => d.id === routeParamId)
      ? routeParamId
      : routeParamId || (docs.length > 0 ? docs[0].id : null);

  const [selectedDoc, setSelectedDoc] = useState<DocWithRelations | null>(() => {
    if (initialSelectedDoc && initialSelectedDoc.id === activeDocId) {
      return initialSelectedDoc;
    }
    return docs.find((d) => d.id === activeDocId) || null;
  });
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isCreating, startCreateTransition] = useTransition();

  // Dark mode hook
  const isDarkMode = useDarkMode();

  // Load detailed doc (with linked tasks & attachments) whenever activeDocId changes
  useEffect(() => {
    if (!activeDocId) return;

    let isMounted = true;
    getDocByIdAction(activeDocId).then((res) => {
      if (isMounted) {
        if (res.doc) {
          setSelectedDoc(res.doc);
        }
        setIsLoadingDoc(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeDocId]);

  const handleToggleTheme = async () => {
    const nextIsDark = !isDarkMode;

    if (nextIsDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("theme", "dark");
        document.cookie = "theme=dark; path=/; max-age=31536000; SameSite=Lax";
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("theme", "light");
        document.cookie = "theme=light; path=/; max-age=31536000; SameSite=Lax";
      } catch {}
    }

    const nextTheme = nextIsDark ? "dark" : "light";
    try {
      await updateUserPreferencesAction({ theme: nextTheme });
    } catch (err) {
      console.error("Error saving theme preference:", err);
    }
  };

  const handleSelectBackground = async (bgId: BackgroundThemeId) => {
    const updated = { ...preferences, background: bgId };
    setPreferences(updated);
    document.documentElement.setAttribute("data-theme-bg", bgId);
    try {
      localStorage.setItem("theme_bg", bgId);
    } catch {}

    try {
      await updateUserPreferencesAction({ background: bgId });
    } catch (err) {
      console.error("Error saving background preference:", err);
    }
  };


  useEffect(() => {
    const bg = (preferences.background as BackgroundThemeId) || "default";
    document.documentElement.setAttribute("data-theme-bg", bg);
    try {
      localStorage.setItem("theme_bg", bg);
    } catch {}
  }, [preferences.background]);

  const handleCreateDoc = () => {
    startCreateTransition(async () => {
      const res = await createDocAction({
        title: "Untitled Document",
        content: "",
      });

      if (res.doc) {
        const newDoc = res.doc;
        setDocs((prev) => [newDoc, ...prev]);
        setSelectedDoc(newDoc);
        router.push(`/docs/${newDoc.id}`);
      }
    });
  };

  const handleDocUpdated = (updated: DocWithRelations) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
    );
    if (selectedDoc?.id === updated.id) {
      setSelectedDoc(updated);
    }
  };

  const handleDocDeleted = async (docId: string) => {
    const remaining = docs.filter((d) => d.id !== docId);
    setDocs(remaining);
    if (activeDocId === docId) {
      if (remaining.length > 0) {
        setSelectedDoc(remaining[0]);
        router.replace(`/docs/${remaining[0].id}`);
      } else {
        setSelectedDoc(null);
        router.replace("/docs");
      }
    }
  };

  const handleToggleFavorite = async (docId: string, nextFav: boolean) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, isFavorite: nextFav } : d))
    );
    if (selectedDoc?.id === docId) {
      setSelectedDoc((prev) => (prev ? { ...prev, isFavorite: nextFav } : null));
    }
    await toggleDocFavoriteAction(docId, nextFav);
  };

  const handleSelectDoc = (doc: DocWithRelations) => {
    setSelectedDoc(doc);
    router.push(`/docs/${doc.id}`);
  };

  const handleProjectCreated = (newProj: Project) => {
    setUserProjects((prev) => [...prev, newProj]);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setUserProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    if (selectedDoc?.projectId === updatedProject.id) {
      setSelectedDoc((prev) =>
        prev ? { ...prev, project: updatedProject } : null
      );
    }
    setDocs((prev) =>
      prev.map((d) =>
        d.projectId === updatedProject.id
          ? { ...d, project: updatedProject }
          : d
      )
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <AppHeader
        userEmail={userEmail}
        userName={userName}
        userImage={userImage}
        userAvatarColor={userAvatarColor}
        userId={userId}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        preferences={preferences}
        onSelectBackground={handleSelectBackground}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 px-3 sm:px-8 pb-8 w-full">
        <div className="w-full h-[calc(100dvh-165px)] md:h-[calc(100vh-130px)] glass-panel rounded-3xl border border-white/80 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col lg:flex-row">
          {/* Left Sidebar (Hidden on mobile if viewing a document via /docs/[id]) */}
          <div
            className={`w-full lg:w-80 xl:w-96 h-full flex flex-col ${
              routeParamId ? "hidden lg:flex" : "flex"
            }`}
          >
            <DocsSidebar
              docs={docs}
              selectedDocId={activeDocId}
              userProjects={userProjects}
              onSelectDoc={handleSelectDoc}
              onCreateDoc={handleCreateDoc}
              onDeleteDoc={handleDocDeleted}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          {/* Right Editor Pane */}
          <div
            className={`flex-1 h-full flex flex-col bg-white/40 dark:bg-slate-900/40 overflow-hidden ${
              !routeParamId && !selectedDoc ? "hidden lg:flex" : "flex"
            }`}
          >
            {isLoadingDoc && !selectedDoc ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Loading document...</span>
              </div>
            ) : selectedDoc ? (
              <DocEditor
                key={selectedDoc.id}
                doc={selectedDoc}
                userProjects={userProjects}
                onDocUpdated={handleDocUpdated}
                onDocDeleted={handleDocDeleted}
                onBackToList={() => {
                  router.push("/docs");
                }}
                onProjectCreated={handleProjectCreated}
                onProjectUpdated={handleProjectUpdated}
              />
            ) : (
              /* Empty State when no document exists or none is selected */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-sm">
                  <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  No document selected
                </h2>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
                  Select an existing note from the sidebar or create a new document to start drafting.
                </p>
                <button
                  type="button"
                  onClick={handleCreateDoc}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-semibold shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Document</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
