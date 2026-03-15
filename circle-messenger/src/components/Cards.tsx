import React from 'react';
import { Users, Globe, UserPlus, MessageSquare, MoreHorizontal, Heart, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { User, Chat } from '../types';

interface UserCardProps {
  user: User;
  mutualFriends?: number;
  bio?: string;
}

export const UserCard: React.FC<UserCardProps> = ({ user, mutualFriends = 5, bio = "Passionate designer and coffee enthusiast. Always looking for new circles to join!" }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center group relative overflow-hidden"
    >
      {/* Background Accent */}
      <div className="absolute top-0 left-0 w-full h-24 bg-brand-50 -z-10 group-hover:bg-brand-100 transition-colors"></div>
      
      <div className="relative mb-4">
        <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white shadow-md">
          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        {user.status === 'online' && (
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full"></div>
        )}
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-1">{user.name}</h3>
      <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">{user.status}</p>
      
      <p className="text-sm text-slate-500 line-clamp-2 mb-4 px-2">
        {bio}
      </p>

      <div className="flex items-center gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">1.2k</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Followers</p>
        </div>
        <div className="w-px h-6 bg-slate-200"></div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">{mutualFriends}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Mutual</p>
        </div>
      </div>

      <div className="flex w-full gap-2">
        <button className="flex-1 bg-brand-500 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all">
          <UserPlus className="w-4 h-4" />
          Add Circle
        </button>
        <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all">
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};

interface GroupCardProps {
  chat: Chat;
  category?: string;
}

export const GroupCard: React.FC<GroupCardProps> = ({ chat, category = "Technology" }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 group"
    >
      <div className="h-32 bg-slate-200 relative">
        <img 
          src={`https://picsum.photos/seed/${chat.name}/600/300`} 
          alt={chat.name} 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-slate-900 uppercase tracking-widest">
            {category}
          </span>
        </div>
        <button className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/40 transition-all">
          <Heart className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 pt-10 relative">
        <div className="absolute -top-8 left-6">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center overflow-hidden border-4 border-white">
            {chat.avatar ? (
              <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-brand-500 text-white font-bold text-2xl">
                {chat.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-slate-900 truncate pr-2">{chat.name}</h3>
          <div className="flex items-center gap-1 text-emerald-500">
            <Globe className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Public</span>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-6 line-clamp-2">
          Join the {chat.name} circle to connect with like-minded individuals and share your passion.
        </p>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-slate-100">
                <img src={`https://picsum.photos/seed/user${i}/100`} alt="member" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">
              +12
            </div>
          </div>
          
          <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
            Join Circle
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const MiniCard: React.FC<{ chat: Chat }> = ({ chat }) => {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-brand-200 transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-brand-50">
        {chat.avatar ? (
          <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-brand-600 font-bold text-sm">
            {chat.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 truncate">{chat.name}</h4>
        <p className="text-[10px] text-slate-400 font-medium truncate">
          {chat.members.length} members
        </p>
      </div>
      <button className="p-1.5 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
        <UserPlus className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const FeaturedCard: React.FC<{ chat: Chat }> = ({ chat }) => {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="relative h-64 rounded-[3rem] overflow-hidden group shadow-xl shadow-brand-500/10"
    >
      <img 
        src={`https://picsum.photos/seed/${chat.id}featured/1200/600`} 
        alt={chat.name} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
      
      <div className="absolute top-6 left-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-500 text-white rounded-full shadow-lg">
          <Sparkles className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Featured Circle</span>
        </div>
      </div>

      <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
        <div className="max-w-md">
          <h3 className="text-3xl font-bold text-white mb-2 tracking-tight">{chat.name}</h3>
          <p className="text-slate-200 text-sm line-clamp-2 opacity-90">
            Experience the most vibrant community in our unified network. Join thousands of others in the {chat.name} circle today.
          </p>
        </div>
        <button className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-brand-50 transition-all shadow-xl">
          Explore Now
        </button>
      </div>
    </motion.div>
  );
};
