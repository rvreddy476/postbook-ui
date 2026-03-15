import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MessageSquare, 
  Users, 
  Settings, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Smile, 
  Phone, 
  Video, 
  Info,
  Circle,
  Hash,
  Globe,
  Bell,
  LogOut,
  ChevronRight,
  Compass,
  Sparkles,
  LayoutGrid,
  Mail,
  Calendar,
  Briefcase,
  Star,
  User as UserIcon,
  SlidersHorizontal,
  Plus,
  UserCircle,
  MoreHorizontal,
  Link2,
  Image,
  Mic,
  Camera,
  Check,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat, ChatType, Message, User } from './types';
import { mockChats, currentUser, mockUsers } from './mockData';
import { GlassChatItem } from './components/ChatItems';

export default function App() {
  const [activeTab, setActiveTab] = useState<'direct' | 'group' | 'public'>('direct');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(mockChats[0].id);
  const [messageInput, setMessageInput] = useState('');

  const selectedChat = useMemo(() => {
    return mockChats.find(chat => chat.id === selectedChatId) || null;
  }, [selectedChatId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChat) return;
    setMessageInput('');
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-lavender p-8">
      <div className="app-container flex flex-col w-full h-full max-w-[1400px] max-h-[900px]">
        {/* Top Navigation Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center shadow-sm">
              <MessageSquare className="text-white w-5 h-5 fill-current" />
            </div>
            <span className="font-bold text-brand-500 text-xl tracking-tight">Chat Bot</span>
          </div>

          <div className="flex items-center gap-8">
            <TopNavIcon icon={<LayoutGrid />} />
            <TopNavIcon icon={<MessageSquare />} active />
            <TopNavIcon icon={<Mail />} />
            <TopNavIcon icon={<Calendar />} />
            <TopNavIcon icon={<Briefcase />} />
            <TopNavIcon icon={<Star />} />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search" 
                className="bg-slate-50 border-none rounded-full py-1.5 pl-10 pr-4 text-xs w-48 focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>
            <button className="text-slate-400 hover:text-brand-500 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            </div>
            <button className="text-slate-400 hover:text-brand-500 transition-colors">
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Inbox */}
          <aside className="w-72 flex flex-col border-r border-slate-100 flex-shrink-0">
            <div className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-4">
                  <SidebarActionIcon icon={<MessageSquare />} active />
                  <SidebarActionIcon icon={<Phone />} />
                  <SidebarActionIcon icon={<Mail />} />
                  <SidebarActionIcon icon={<Users />} />
                  <SidebarActionIcon icon={<UserCircle />} />
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-sm font-bold text-slate-700">Chats</h2>
                <button className="text-brand-500 hover:bg-brand-50 p-1 rounded-md transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 px-2">
                <TabButton label="Direct" active={activeTab === 'direct'} onClick={() => setActiveTab('direct')} />
                <TabButton label="Group" active={activeTab === 'group'} onClick={() => setActiveTab('group')} />
                <TabButton label="Public" active={activeTab === 'public'} onClick={() => setActiveTab('public')} />
              </div>

              {/* Search */}
              <div className="relative mb-4 px-2">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full bg-slate-50 border-none rounded-lg py-2 pl-10 pr-4 text-[11px] focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {mockChats.map(chat => (
                  <GlassChatItem 
                    key={chat.id} 
                    chat={chat} 
                    active={selectedChatId === chat.id} 
                    onClick={() => setSelectedChatId(chat.id)} 
                  />
                ))}
              </div>
            </div>
          </aside>

          {/* Middle Column - Chat Window */}
          <main className="flex-1 flex flex-col border-r border-slate-100 bg-white">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <header className="h-16 px-6 flex items-center justify-between border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100">
                      <img src={selectedChat.avatar} alt={selectedChat.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">{selectedChat.name}</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Last Seen 10:30PM ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <button className="hover:text-brand-500 transition-colors"><Phone className="w-4 h-4" /></button>
                    <button className="hover:text-brand-500 transition-colors"><Video className="w-4 h-4" /></button>
                    <button className="hover:text-brand-500 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                  </div>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                  {selectedChat.messages.map((msg, idx) => (
                    <MessageBubble 
                      key={msg.id} 
                      message={msg} 
                      isMe={msg.senderId === 'me'} 
                      sender={msg.senderId === 'me' ? currentUser : mockUsers.find(u => u.id === msg.senderId)}
                    />
                  ))}
                </div>

                {/* Input Area */}
                <footer className="p-4 border-t border-slate-50">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3 bg-slate-50 rounded-full px-4 py-2">
                      <input 
                        type="text" 
                        placeholder="Say something..." 
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-slate-600"
                      />
                      <div className="flex items-center gap-2 text-slate-400">
                        <button type="button" className="hover:text-brand-500 transition-colors"><Link2 className="w-4 h-4" /></button>
                        <button type="button" className="hover:text-brand-500 transition-colors"><Image className="w-4 h-4" /></button>
                        <button type="button" className="hover:text-brand-500 transition-colors"><Smile className="w-4 h-4" /></button>
                        <button type="button" className="hover:text-brand-500 transition-colors"><Mic className="w-4 h-4" /></button>
                        <button type="button" className="hover:text-brand-500 transition-colors"><Camera className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      className="w-10 h-10 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </footer>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                Select a chat to start messaging
              </div>
            )}
          </main>

          {/* Right Sidebar - Info/Notifications */}
          <aside className="w-64 flex flex-col flex-shrink-0 relative">
            <div className="p-4 overflow-y-auto h-full space-y-8">
              {/* Notifications */}
              <section>
                <h3 className="text-xs font-bold text-slate-700 mb-4 px-2">Notification</h3>
                <div className="space-y-4">
                  <NotificationItem 
                    name="Nathan" 
                    text="Nullam facilisis velit eu nulla dictum volutpat." 
                    time="23 hours ago" 
                    avatar="https://picsum.photos/seed/n8/100" 
                  />
                  <NotificationItem 
                    name="Christian" 
                    text="Proin iaculis eros non odio ornare efficitur." 
                    time="3 hours ago" 
                    avatar="https://picsum.photos/seed/c9/100" 
                  />
                  <NotificationItem 
                    name="Dylan" 
                    text="Morbi quis ex eu arcu auctor sagittis." 
                    time="Yesterday" 
                    avatar="https://picsum.photos/seed/d10/100" 
                  />
                  <NotificationItem 
                    name="Nathan" 
                    text="Nullam facilisis velit eu nulla" 
                    time="23 hours ago" 
                    avatar="https://picsum.photos/seed/n11/100" 
                  />
                </div>
              </section>

              {/* Suggestions */}
              <section>
                <h3 className="text-xs font-bold text-slate-700 mb-4 px-2">Suggestions</h3>
                <div className="space-y-4">
                  <SuggestionItem name="Austin" mutual="12 mutual" avatar="https://picsum.photos/seed/a12/100" />
                  <SuggestionItem name="Thomas" mutual="1 mutual" avatar="https://picsum.photos/seed/t13/100" />
                  <SuggestionItem name="Chase" mutual="22 mutual" avatar="https://picsum.photos/seed/c14/100" />
                  <SuggestionItem name="Xavier" mutual="12 mutual" avatar="https://picsum.photos/seed/x15/100" />
                </div>
              </section>
            </div>

            {/* Floating Action Bar */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-1 bg-white shadow-lg rounded-l-lg border border-slate-100">
              <div className="w-6 h-6 bg-brand-100 text-brand-500 rounded flex items-center justify-center"><Globe className="w-3 h-3" /></div>
              <div className="w-6 h-6 bg-rose-100 text-rose-500 rounded flex items-center justify-center"><MessageSquare className="w-3 h-3" /></div>
              <div className="w-6 h-6 bg-amber-100 text-amber-500 rounded flex items-center justify-center"><Image className="w-3 h-3" /></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TopNavIcon({ icon, active = false }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <button className={`p-2 transition-all ${active ? 'text-brand-500 bg-brand-50 rounded-lg' : 'text-slate-400 hover:text-slate-600'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
    </button>
  );
}

function SidebarActionIcon({ icon, active = false }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <button className={`p-1 transition-all ${active ? 'text-brand-500' : 'text-slate-400 hover:text-slate-600'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
    </button>
  );
}

function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
        active ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function NotificationItem({ name, text, time, avatar }: { name: string, text: string, time: string, avatar: string }) {
  return (
    <div className="flex gap-3 px-2">
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] font-bold text-slate-700">{name}</span>
          <span className="text-[9px] text-slate-400">{time}</span>
        </div>
        <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">{text}</p>
      </div>
    </div>
  );
}

function SuggestionItem({ name, mutual, avatar }: { name: string, mutual: string, avatar: string }) {
  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold text-slate-700 leading-none mb-1">{name}</h4>
          <p className="text-[9px] text-slate-400">{mutual}</p>
        </div>
      </div>
      <button className="bg-brand-500 text-white text-[9px] font-bold px-3 py-1 rounded-md shadow-sm hover:bg-brand-600 transition-all">
        Add
      </button>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  sender?: User;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, sender }) => {
  return (
    <div className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1">
        <img src={sender?.avatar} alt={sender?.name} className="w-full h-full object-cover" />
      </div>
      <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[10px] font-bold text-slate-700">{sender?.name}</span>
          <span className="text-[9px] text-slate-400">{message.timestamp}</span>
        </div>
        <div className={`px-4 py-3 rounded-2xl text-[11px] leading-relaxed shadow-sm ${
          isMe 
          ? 'bg-brand-500 text-white rounded-tr-none' 
          : 'bg-white text-slate-600 rounded-tl-none border border-slate-50'
        }`}>
          {message.text}
        </div>
      </div>
    </div>
  );
};
