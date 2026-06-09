import { Suspense } from 'react';
import PostBoekApp from '@/features/postboek/PostBoekApp';

// PostBoekApp now reads ?tab= via useSearchParams() so the landing-page
// feature cards can deep-link straight into a specific app tab (e.g.
// "Direct Message" → /?tab=Chat). Next 15 requires that to be wrapped
// in a Suspense boundary or the build's static-page prerender bails out.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <PostBoekApp />
    </Suspense>
  );
}
