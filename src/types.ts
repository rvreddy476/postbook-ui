
export interface User {
  id: string;
  name: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  gender?: 'Male' | 'Female' | 'Others';
  loginId?: string;
  avatar: string;
  isOnline?: boolean;
  bio?: string;
  education?: string;
  location?: string;
  work?: string;
  joinDate?: string;
  coverImage?: string;
  dob?: string;
  hobbies?: string;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  type: 'text' | 'image' | 'video' | 'short';
  mediaUrl?: string;
  likes: number;
  comments: number;
  timestamp: string;
}

export type NavItem = 'Home' | 'Chat' | 'TV' | 'Reels' | 'Shop' | 'Profile' | 'Friends' | 'My Circle' | 'Memories' | 'Groups' | 'Flicks' | 'Create' | 'Messenger' | 'Ask' | 'Pages' | 'PostMatch';
