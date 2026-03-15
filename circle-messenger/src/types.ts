export type ChatType = 'individual' | 'group';

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string;
  avatar?: string;
  members: User[];
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
  isPublic?: boolean;
}
