'use client';

import React, { useState } from 'react';
import { User } from '../types';
import PostCard from './PostCard';
import { updateUser } from '../services/authService';

interface ProfileProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'friends' | 'gallery'>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user.name,
    bio: user.bio || '',
    education: user.education || '',
    location: user.location || '',
    work: user.work || '',
    dob: user.dob || '',
    hobbies: user.hobbies || ''
  });

  const handleSave = () => {
    onUpdate({ ...user, ...editForm });
    updateUser({ ...user, ...editForm });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="min-h-screen bg-[#fcfaff] p-6 sm:p-12 animate-fadeIn">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Identity Registry</h2>
              <p className="text-[10px] font-black text-slate-400 tracking-[0.4em] uppercase mt-1">Recalibrating Neural Parameters</p>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          </header>

          <div className="bg-white/70 backdrop-blur-3xl rounded-[3rem] shadow-xl border border-white/60 p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { label: 'Full Identifier', field: 'name', type: 'text' },
                { label: 'Origin Date (DOB)', field: 'dob', type: 'date' },
                { label: 'Current Base', field: 'location', type: 'text' },
                { label: 'Education Hub', field: 'education', type: 'text' },
                { label: 'Primary Sphere (Work)', field: 'work', type: 'text' },
                { label: 'Active Frequencies (Hobbies)', field: 'hobbies', type: 'text' }
              ].map((item) => (
                <div key={item.field} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{item.label}</label>
                  <input
                    type={item.type}
                    value={(editForm as any)[item.field]}
                    onChange={(e) => setEditForm({ ...editForm, [item.field]: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                </div>
              ))}
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Core Manifest (Bio)</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all h-32 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-6 bg-gradient-to-r from-blue-600 to-[#b80d35] text-white rounded-[2.5rem] font-black text-lg uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Synchronize Identity
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-10 px-4 sm:px-10 animate-fadeIn">
      <div className="flex flex-col lg:flex-row gap-12 items-start mb-16">
        <div className="relative group">
          <div className="w-64 h-64 rounded-[3.5rem] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.1)] border-8 border-white ring-1 ring-slate-100 bg-white">
            <img src={user.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="absolute -bottom-4 -right-4 bg-white border border-slate-100 p-4 rounded-3xl shadow-2xl hover:scale-110 transition-transform text-blue-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 pt-4">
          <div className="space-y-1">
            <h1 className="text-5xl font-black text-slate-950 tracking-tighter uppercase italic">{user.name}</h1>
            <p className="text-xl font-bold text-slate-400 italic">"{user.bio}"</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Work', val: user.work, icon: '💼' },
              { label: 'Academy', val: user.education, icon: '🎓' },
              { label: 'Base', val: user.location, icon: '📍' },
              { label: 'Origin', val: user.dob, icon: '🎂' }
            ].map(info => (
              <div key={info.label} className="p-5 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{info.icon} {info.label}</p>
                <p className="font-bold text-xs text-slate-900 truncate">{info.val || 'Uncharted'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex bg-white/50 backdrop-blur-xl p-2 rounded-[2rem] border border-white shadow-sm">
            {['posts', 'friends', 'gallery'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab === 'posts' ? 'Manifests' : tab === 'friends' ? 'Network' : 'Archives'}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === 'posts' && (
              <PostCard post={{
                id: 'p-user-1',
                author_id: user.id,
                text: "Reflecting on the latest neural updates. The prismatic grid is expanding beautifully. 💎",
                visibility: 'public',
                content_type: 'post',
                is_pinned: false,
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                counts: { likes: 240, comments: 12 },
              }} />
            )}
            {activeTab !== 'posts' && (
              <div className="p-20 text-center bg-white/40 rounded-[3rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-300 font-black uppercase tracking-[0.5em] text-sm italic">Data stream empty</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gradient-to-br from-blue-600 to-[#b80d35] rounded-[3rem] p-8 text-white shadow-2xl shadow-[#D8103F]/20">
            <h3 className="font-black uppercase text-xs tracking-[0.3em] mb-6 italic">Active Frequencies</h3>
            <div className="flex flex-wrap gap-2">
              {(user.hobbies || 'Design, AI, Code').split(',').map(h => (
                <span key={h} className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/20">{h.trim()}</span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm">
            <h3 className="text-slate-900 font-black uppercase text-xs tracking-[0.3em] mb-6 italic">Network Nodes</h3>
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden hover:scale-110 transition-transform cursor-pointer shadow-sm border border-white">
                  <img src={`https://picsum.photos/seed/pnode${i}/150/150`} className="w-full h-full object-cover" alt="" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;