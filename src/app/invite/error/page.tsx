import Link from "next/link";
import { Link2Off, ArrowLeft, Home } from "lucide-react";

export default async function InviteErrorPage(props: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await props.searchParams;

  const isExpired = reason === "expired";
  const title = isExpired ? "Invitation Expired" : "Invalid Invitation";
  const message = isExpired
    ? "This workspace invitation link has expired. Please ask the workspace owner or admin to generate a new invitation link."
    : "This invitation link is invalid, has been revoked, or the workspace no longer exists. Please request a new invite link.";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-rose-300/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-400/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-md">
        <div className="glass-panel rounded-3xl p-7 sm:p-9 border border-white/80 dark:border-slate-800 text-center shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/60 text-rose-500 mx-auto flex items-center justify-center mb-5 shadow-sm">
            <Link2Off className="w-7 h-7" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">
            {message}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Go to App</span>
            </Link>

            <Link
              href="/login"
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
