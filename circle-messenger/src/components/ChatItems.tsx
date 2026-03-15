import React from 'react';
import { Chat } from '../types';

interface ChatItemProps {
  chat: Chat;
  active: boolean;
  onClick: () => void;
}

export const GlassChatItem: React.FC<ChatItemProps> = ({ chat, active, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all mb-2 ${
        active 
        ? 'bg-white shadow-lg ring-1 ring-slate-100' 
        : 'hover:bg-slate-50'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
          <img 
            src={chat.avatar || `https://picsum.photos/seed/${chat.name}/200`} 
            alt={chat.name} 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
          />
        </div>
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="text-sm font-bold text-slate-700 truncate">
            {chat.name}
          </h3>
          <span className="text-[10px] font-medium text-slate-400">
            {chat.lastMessage?.timestamp || '10:00pm'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 truncate">
          {chat.lastMessage?.text || 'Nullam facilisis velit.'}
        </p>
      </div>
    </button>
  );
};

// Keeping other styles but making them similar to the design
export const MinimalChatItem = GlassChatItem;
export const VibrantChatItem = GlassChatItem;
export const OrganicChatItem = GlassChatItem;
