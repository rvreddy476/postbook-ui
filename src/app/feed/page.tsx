import { Suspense } from 'react';
import PostBoekApp from '@/features/postboek/PostBoekApp';

export default function FeedPage() {
  return <Suspense fallback={null}><PostBoekApp key="feed" initialSurface="Feed" /></Suspense>;
}
