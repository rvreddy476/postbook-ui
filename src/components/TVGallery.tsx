
'use client';

import React from 'react';

const VIDEOS: { id: number; title: string; author: string; thumb: string; views: string; duration: string; time: string }[] = [];

const TVGallery: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 8l6 4-6 4V8z" /><path d="M2 7v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2z" /></svg>
        </div>
        <h2 className="text-3xl font-black text-brand-text tracking-tighter uppercase italic">PostBoek.com TV</h2>
      </div>

      {VIDEOS.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-text/60">
          <svg className="w-16 h-16 mb-4 text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M10 8l6 4-6 4V8z" /><path d="M2 7v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2z" /></svg>
          <p className="text-sm font-semibold">No videos yet</p>
          <p className="text-xs mt-1">Videos will appear here once they are uploaded.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {VIDEOS.map((video) => (
            <div key={video.id} className="group cursor-pointer">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-200 mb-3 shadow-sm border border-brand-divider ring-1 ring-white/50">
                <img src={video.thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={video.title} />
                <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-md">
                  {video.duration}
                </span>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 bg-brand-card/20 backdrop-blur-md rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden ring-1 ring-slate-200">
                  <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${video.author}`} alt={video.author} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-brand-text leading-tight mb-1 group-hover:text-blue-600 transition-colors truncate max-w-[240px]">
                    {video.title}
                  </h3>
                  <p className="text-[11px] font-bold text-brand-highlight uppercase tracking-widest">{video.author}</p>
                  <p className="text-[11px] text-brand-text/60 font-medium">{video.views} views • {video.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TVGallery;
