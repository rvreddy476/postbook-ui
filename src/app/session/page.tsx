import Link from 'next/link';
import { CalendarDays, CheckCircle2, FileCode2, NotebookPen } from 'lucide-react';

const workItems = [
  'Home/feed layout tightened and spacing issues addressed (post container edge gaps removed).',
  'Messenger/group UX updated: group creation flow moved to group-side context and cleaned from inbox clutter.',
  'Unrelated existing type issue fixed in NotificationPostPopup.tsx (line 87 reported earlier).',
  'Create Post redesigned with modern structure, responsive layout, and stronger visual hierarchy.',
  'Create Post now adapts to app surface theme: dark remains dark, light uses clean white feed-matching palette.',
  'Header actions refined: Cancel + Save Draft + Publish kept in header.',
  'Add To Post interactions converted to quick popovers (mood/tags/location/schedule/settings) for faster flow.',
  'Visibility/settings dropdown moved below user name inside the editor card as requested.',
  'Modal width and visual density adjusted to reduce excessive horizontal stretch.',
];

export default function SessionPage() {
  return (
    <div className="min-h-screen bg-[#fcfaff]">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-2xl bg-slate-900 p-2.5 text-white">
              <NotebookPen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Session Notes</h1>
              <p className="mt-1 text-sm text-slate-500">Persistent summary of what we changed in this cycle.</p>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            Updated during current UI redesign session
          </div>

          <ul className="space-y-3">
            {workItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-sm leading-6 text-slate-700">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FileCode2 className="h-4 w-4 text-slate-500" />
              Back To Feed
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
