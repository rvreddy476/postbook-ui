'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Reel {
  id: number;
  title: string;
  author: string;
  videoUrl: string;
  views: string;
  likes: string;
  comments: string;
}

const REELS: Reel[] = [
  { 
    id: 1, 
    title: 'Visualizing the Prismatic Mesh Architecture 💎 #web3 #postbook', 
    author: 'OrchidMedia', 
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-motion-of-colors-and-shapes-2342-large.mp4', 
    views: '2.8M',
    likes: '124K',
    comments: '1.2K'
  },
  { 
    id: 2, 
    title: 'Cyberpunk vibes in the neural forge tonight 🌃 #tech #future', 
    author: 'LogicForge', 
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-flying-over-a-futuristic-city-at-night-42801-large.mp4', 
    views: '4.1M',
    likes: '89K',
    comments: '3.4K'
  },
  { 
    id: 3, 
    title: 'Manifesting digital dreams with AI Generators 🎨 #ai #creation', 
    author: 'VividCity', 
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-prismatic-glass-cube-reflecting-light-34661-large.mp4', 
    views: '1.4M',
    likes: '230K',
    comments: '560'
  },
  { 
    id: 4, 
    title: 'The sound of the infinite scroll... 🔊 #asmr #postbook', 
    author: 'AudioRefract', 
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-slow-motion-of-water-droplets-falling-into-a-puddle-3011-large.mp4', 
    views: '900K',
    likes: '45K',
    comments: '120'
  }
];

const ReelItem: React.FC<{ reel: Reel }> = ({ reel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.7
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(e => console.log("Auto-play blocked", e));
          setIsPlaying(true);
        } else {
          videoRef.current?.pause();
          setIsPlaying(false);
        }
      });
    }, options);

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.log("Play blocked", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-80px)] bg-black snap-start overflow-hidden flex items-center justify-center">
      {/* Video Background with Blur for non-portrait ratios */}
      <div className="absolute inset-0 overflow-hidden">
        <video src={reel.videoUrl} className="w-full h-full object-cover blur-2xl opacity-30 scale-110" muted loop playsInline />
      </div>

      {/* Main Video Element */}
      <div className="relative z-10 w-full max-w-[500px] h-full shadow-[0_0_100px_rgba(0,0,0,0.5)]">
        <video
          ref={videoRef}
          src={reel.videoUrl}
          className="w-full h-full object-cover"
          muted={isMuted}
          loop
          playsInline
          onClick={togglePlay}
        />
        
        {/* UI Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
        
        <div className="absolute bottom-0 left-0 right-0 p-8 z-20 pointer-events-none">
           <div className="flex items-center gap-3 mb-4 pointer-events-auto">
              <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden shadow-xl">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${reel.author}`} alt="" />
              </div>
              <p className="text-white font-black text-sm italic uppercase tracking-widest">{reel.author}</p>
              <button className="bg-rose-600 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Follow</button>
           </div>
           <p className="text-white text-sm font-medium mb-4 line-clamp-2 max-w-[80%] pointer-events-auto">
             {reel.title}
           </p>
        </div>

        {/* Right Sidebar Actions */}
        <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-20 items-center pointer-events-auto">
          <div className="flex flex-col items-center gap-1 group">
             <button className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-rose-600 transition-all border border-white/20">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
             </button>
             <span className="text-white text-[10px] font-black">{reel.likes}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <button className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-violet-600 transition-all border border-white/20">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
             </button>
             <span className="text-white text-[10px] font-black">{reel.comments}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <button className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-indigo-600 transition-all border border-white/20">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
             </button>
             <span className="text-white text-[10px] font-black">Share</span>
          </div>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 mt-4"
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.38.29-.79.52-1.25.68v2.06c1.02-.22 1.95-.66 2.76-1.26l2.97 2.97 1.27-1.27L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ShortsGallery: React.FC = () => {
  return (
    <div className="h-full w-full bg-black overflow-y-auto snap-y snap-mandatory scrollbar-hide">
      {REELS.map(reel => (
        <ReelItem key={reel.id} reel={reel} />
      ))}
    </div>
  );
};

export default ShortsGallery;
