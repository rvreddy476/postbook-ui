
'use client';

import React from 'react';

const VIDEOS = [
  { id: 1, title: 'The Future of AI Architecture', author: 'TechNexus', thumb: 'https://picsum.photos/id/1/1200/600', views: '1.2M', duration: '12:45', time: '2 days ago' },
  { id: 2, title: 'Unboxing the Nebula VR Pro', author: 'GadgetFlow', thumb: 'https://picsum.photos/id/2/1200/600', views: '800K', duration: '15:20', time: '4 hours ago' },
  { id: 3, title: 'Designing for the Multiverse', author: 'PrismaDesign', thumb: 'https://picsum.photos/id/3/1200/600', views: '2.5M', duration: '10:10', time: '1 week ago' },
  { id: 4, title: 'Go Microservices Masterclass', author: 'BackendHub', thumb: 'https://picsum.photos/id/4/1200/600', views: '45K', duration: '45:00', time: '10 hours ago' },
  { id: 5, title: 'Nature in 8K: Prismatic Peaks', author: 'EarthShot', thumb: 'https://picsum.photos/id/5/1200/600', views: '12M', duration: '08:12', time: '1 month ago' },
  { id: 6, title: 'Cyberpunk City ASMR', author: 'NeonVibe', thumb: 'https://picsum.photos/id/6/1200/600', views: '2M', duration: '1:00:00', time: '3 days ago' },
];

const TVGallery: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 8l6 4-6 4V8z" /><path d="M2 7v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2z" /></svg>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">PostBoek.com TV</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {VIDEOS.map((video) => (
          <div key={video.id} className="group cursor-pointer">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-200 mb-3 shadow-sm border border-slate-100 ring-1 ring-white/50">
              <img src={video.thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={video.title} />
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-md">
                {video.duration}
              </span>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden ring-1 ring-slate-200">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${video.author}`} alt={video.author} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight mb-1 group-hover:text-blue-600 transition-colors truncate max-w-[240px]">
                  {video.title}
                </h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{video.author}</p>
                <p className="text-[11px] text-slate-400 font-medium">{video.views} views • {video.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TVGallery;
