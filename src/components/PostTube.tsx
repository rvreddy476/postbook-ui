'use client';

import React, { useState } from 'react';
import { User } from '../types';

interface PostTubeProps {
  currentUser: User;
}

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  avatar: string;
  views: string;
  timestamp: string;
  duration: string;
  category: string;
  description: string;
  subscribers: string;
}

const CATEGORIES = ['All', 'Podcasts', 'Music', 'History', 'Tech', 'Live', 'Gaming'];

const INITIAL_VIDEOS: Video[] = [
  { 
    id: 'v1', 
    title: 'The Future of AI Architecture in Social Spaces', 
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1200', 
    author: 'TechNexus', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechNexus', 
    views: '1.2M', 
    timestamp: '2 days ago', 
    duration: '15:20', 
    category: 'Tech', 
    description: 'Exploring how AI and neural networks are reshaping digital connection. Dive deep into the prismatic grid architecture.', 
    subscribers: '450K' 
  },
  { 
    id: 'v2', 
    title: 'Digital Minimalism: Ep. 42 with Sarah Wilson', 
    thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=1200', 
    author: 'Postcast Hub', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', 
    views: '800K', 
    timestamp: '5 hours ago', 
    duration: '1:02:45', 
    category: 'Podcasts', 
    description: 'Sarah Wilson joins us to talk about finding balance in an infinite scroll world.', 
    subscribers: '1.2M' 
  },
  { 
    id: 'v3', 
    title: 'Prismatic Mornings - Deep Chill Lo-fi [Original]', 
    thumbnail: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=1200', 
    author: 'VibeStation', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vibe', 
    views: '4.1M', 
    timestamp: '1 week ago', 
    duration: '3:00:00', 
    category: 'Music', 
    description: 'Relax or study with these prismatic beats curated for the soul.', 
    subscribers: '890K' 
  },
  { 
    id: 'v4', 
    title: 'The Hidden History of Distributed Data Systems', 
    thumbnail: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=1200', 
    author: 'HistoryFlow', 
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=History', 
    views: '200K', 
    timestamp: '1 day ago', 
    duration: '22:15', 
    category: 'History', 
    description: 'Uncovering ancient methods of collective memory management.', 
    subscribers: '150K' 
  }
];

const PostTube: React.FC<PostTubeProps> = ({ currentUser }) => {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

  const filteredVideos = activeCategory === 'All' 
    ? INITIAL_VIDEOS 
    : INITIAL_VIDEOS.filter(v => v.category === activeCategory);

  return (
    <div className="w-full h-full min-h-screen bg-[#fcfaff] animate-fadeIn p-4 sm:p-10 flex flex-col">
      {/* PostTube.in Navigation */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 w-full max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setSelectedVideo(null)}>
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-[#b80d35] text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-400/20 group-hover:scale-110 transition-transform">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M10 8l6 4-6 4V8z"/><path d="M2 7v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-950 tracking-tighter uppercase italic">PostTube<span className="text-indigo-600">.in</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-0.5">Infinite Cinema Hub</p>
          </div>
        </div>

        <div className="flex-1 max-w-xl w-full">
           <div className="relative">
              <input 
                type="text" 
                placeholder="Search podcasts, music, history..." 
                className="w-full bg-white border border-slate-200/60 rounded-2xl py-3.5 px-6 pl-12 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
           </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="bg-gradient-to-r from-indigo-600 to-[#b80d35] text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-400/20 hover:scale-105 active:scale-95 transition-all">
            Channel Creator
          </button>
        </div>
      </div>

      {selectedVideo ? (
        <div className="w-full max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 animate-slideUp">
          <div className="lg:col-span-2 space-y-8">
            <div className="aspect-video bg-black rounded-[3rem] overflow-hidden shadow-2xl relative border-4 border-white ring-1 ring-slate-100">
               <img src={selectedVideo.thumbnail} className="w-full h-full object-cover opacity-80" alt="" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <button className="w-24 h-24 bg-white/20 backdrop-blur-2xl rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform shadow-2xl border border-white/20">
                    <svg className="w-12 h-12 translate-x-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
               </div>
            </div>

            <div className="bg-white/70 backdrop-blur-3xl rounded-[3rem] p-10 shadow-sm border border-white/60">
               <h2 className="text-3xl font-black text-slate-950 uppercase italic tracking-tight mb-6">{selectedVideo.title}</h2>
               <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-100 pb-8 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl border-2 border-white">
                      <img src={selectedVideo.avatar} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-950 text-base uppercase italic">{selectedVideo.author}</h4>
                      <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{selectedVideo.subscribers} Citizens</p>
                    </div>
                    <button 
                      onClick={() => setIsSubscribed(!isSubscribed)}
                      className={`ml-4 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        isSubscribed ? 'bg-slate-100 text-slate-500' : 'bg-gradient-to-r from-indigo-600 to-[#b80d35] text-white shadow-xl shadow-indigo-400/20'
                      }`}
                    >
                      {isSubscribed ? 'Synchronized' : 'Subscribe'}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <button 
                       onClick={() => {setIsLiked(!isLiked); setIsDisliked(false);}}
                       className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                         isLiked ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-xl' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                       }`}
                     >
                        <svg className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        Pulse
                     </button>
                     <button 
                       onClick={() => {setIsDisliked(!isDisliked); setIsLiked(false);}}
                       className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                         isDisliked ? 'bg-rose-600 text-white shadow-rose-500/20 shadow-xl' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                       }`}
                     >
                        <svg className="w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                     </button>
                  </div>
               </div>
               <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                  <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-2">{selectedVideo.views} Manifestations • {selectedVideo.timestamp}</p>
                  <p className="text-slate-700 font-bold leading-relaxed">{selectedVideo.description}</p>
               </div>
            </div>

            <div className="bg-white/50 rounded-[3rem] p-10 border border-white">
              <h3 className="text-xl font-black text-slate-950 uppercase italic tracking-tight mb-8">Manifestations</h3>
              <div className="flex gap-6 mb-10">
                <img src={currentUser.avatar} className="w-12 h-12 rounded-2xl shadow-lg border border-white" alt="" />
                <div className="flex-1">
                  <input type="text" placeholder="Sync a thought..." className="w-full bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-3 font-bold text-lg transition-all" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Neural Chain</h3>
             {INITIAL_VIDEOS.filter(v => v.id !== selectedVideo.id).map(v => (
               <div 
                 key={v.id} 
                 onClick={() => setSelectedVideo(v)}
                 className="flex gap-4 p-3 rounded-3xl hover:bg-white transition-all cursor-pointer group hover:shadow-xl"
               >
                 <div className="w-36 aspect-video rounded-2xl overflow-hidden shadow-md flex-shrink-0 relative">
                    <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg backdrop-blur-md">{v.duration}</span>
                 </div>
                 <div className="min-w-0 flex flex-col justify-center">
                    <h4 className="text-[11px] font-black text-slate-950 leading-tight line-clamp-2 uppercase italic mb-1 group-hover:text-indigo-600 transition-colors">{v.title}</h4>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.author}</p>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">{v.views} views</p>
                 </div>
               </div>
             ))}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-screen-2xl mx-auto flex flex-col flex-1">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide mb-12">
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  activeCategory === cat 
                  ? 'bg-gradient-to-r from-indigo-600 to-[#b80d35] text-white shadow-xl shadow-indigo-400/20 scale-105' 
                  : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-10">
            {filteredVideos.map(video => (
              <div 
                key={video.id} 
                className="group cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-slate-200 mb-5 shadow-sm border border-slate-100 group-hover:shadow-2xl transition-all duration-500 group-hover:-translate-y-1">
                  <img src={video.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                  <span className="absolute bottom-4 right-4 bg-black/80 text-white text-[10px] font-black px-2.5 py-1 rounded-xl backdrop-blur-md">
                    {video.duration}
                  </span>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-all duration-500 shadow-2xl">
                      <svg className="w-8 h-8 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 px-2">
                   <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border border-slate-50 flex-shrink-0">
                     <img src={video.avatar} className="w-full h-full object-cover" alt="" />
                   </div>
                   <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-950 leading-tight mb-1 uppercase italic tracking-tight line-clamp-2 group-hover:text-indigo-600 transition-colors">{video.title}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{video.author}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{video.views} Views • {video.timestamp}</p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostTube;