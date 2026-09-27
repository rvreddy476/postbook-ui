import { redirect } from "next/navigation";

import { tubeRedirectTarget } from "@/features/posttube/tubeRedirect";

/*
  `/tube/*` is an alias of `/posttube/*`: the notification deep link stays
  `/tube/watch/{id}` (Android parses it), the web lands it on the real
  route. The query is carried across; the mapping is the pure helper in
  features/posttube/tubeRedirect.ts and is tested there. Same shape as
  app/reels/[id]/page.tsx: a server page that only redirects.
*/
export default async function TubeAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  redirect(tubeRedirectTarget(path, query));
}
