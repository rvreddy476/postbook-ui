'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bookmark, ChevronDown, Clapperboard, History, Layers3, MessageCircle, PenLine, Play, Radio, Users } from 'lucide-react';
import './creative-home.css';

/** Real destinations only: no Home data fetches, feed, inferred location or
 * invented activity. Unlaunched services stay non-interactive. */
export default function CreativeHome({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="creative-home">
      <header className="home-heading">
        <div><span className="home-eyebrow">VChat / Explore</span><h1>Home</h1></div>
        <button className="home-create-button" onClick={onCreateClick}><PenLine size={17} /> Create</button>
      </header>
      <nav className="home-return" aria-label="Your shortcuts">
        <Link href="/posttube/history" prefetch={false}><History size={17} /> Watch history <ArrowUpRight size={14} /></Link>
        <Link href="/saved" prefetch={false}><Bookmark size={17} /> Saved items <ArrowUpRight size={14} /></Link>
        <Link href="/connections" prefetch={false}><Users size={17} /> Connections <ArrowUpRight size={14} /></Link>
      </nav>
      <div className="home-destinations">
        <section className="home-watch" aria-labelledby="home-watch-heading">
          <div className="home-watch__intro"><span className="home-eyebrow">Video</span><h2 id="home-watch-heading">Find your next watch.</h2></div>
          <div className="home-watch__art" aria-hidden="true">
            <div className="home-watch__orbit" />
            <div className="home-watch__landscape"><span /><Play size={31} fill="currentColor" /><i /></div>
            <div className="home-watch__portrait"><Clapperboard size={23} /><span /><span /><span /></div>
          </div>
          <div className="home-watch__choices">
            <Link href="/reels" prefetch={false}><span><strong>Reels</strong><small>Short videos</small></span><ArrowUpRight size={20} /></Link>
            <Link href="/posttube" prefetch={false}><span><strong>PostTube</strong><small>Videos, channels &amp; series</small></span><ArrowUpRight size={20} /></Link>
          </div>
        </section>
        <Link className="home-messages home-destination" href="/messenger" prefetch={false}>
          <div className="home-card-top"><span className="home-eyebrow">Conversations</span><ArrowUpRight size={21} /></div>
          <div className="home-messages__art" aria-hidden="true"><span><i /><i /><i /></span><span><MessageCircle size={29} /></span></div>
          <div><h2>Your conversations,<br />one place.</h2><p>Direct messages, requests and group chats.</p><span className="home-text-link">Open messages <ArrowRight size={17} /></span></div>
        </Link>
        <Link className="home-groups home-destination" href="/groups" prefetch={false}>
          <div className="home-card-top"><span className="home-service-icon"><Users size={23} /></span><ArrowUpRight size={20} /></div>
          <h2>Groups</h2><p>Shared interests. Ongoing conversations.</p><span className="home-text-link">Explore groups <ArrowRight size={17} /></span>
        </Link>
        <Link className="home-social home-destination" href="/feed" prefetch={false}>
          <div className="home-card-top"><span className="home-service-icon"><Radio size={23} /></span><ArrowUpRight size={20} /></div>
          <h2>Feed</h2><p>Posts, perspectives and people.</p><span className="home-text-link">Open your feed <ArrowRight size={17} /></span>
        </Link>
      </div>
      <section className="home-library" aria-labelledby="home-library-heading">
        <span className="home-service-icon"><Layers3 size={23} /></span>
        <div><h2 id="home-library-heading">Keep what matters.</h2><p>Return to saved posts and your video playlists.</p></div>
        <div className="home-library__links"><Link href="/saved" prefetch={false}>Saved items <ArrowUpRight size={15} /></Link><Link href="/posttube/playlists" prefetch={false}>Playlists <ArrowUpRight size={15} /></Link></div>
      </section>
      <details className="home-directory">
        <summary>More on VChat <ChevronDown size={17} /></summary>
        <div className="home-directory__content">
          <nav aria-label="More destinations"><Link href="/profile" prefetch={false}>Your profile <ArrowUpRight size={15} /></Link><Link href="/search" prefetch={false}>Search <ArrowUpRight size={15} /></Link><Link href="/posttube/subscriptions" prefetch={false}>Channel subscriptions <ArrowUpRight size={15} /></Link></nav>
          <div className="home-future"><span className="home-eyebrow">In development · not available yet</span><p>Shopping · Food · Mopedu rides</p></div>
        </div>
      </details>
    </div>
  );
}
