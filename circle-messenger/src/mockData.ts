import { Chat, User } from './types';

export const currentUser: User = {
  id: 'me',
  name: 'Mimi Carreira',
  avatar: 'https://picsum.photos/seed/mimi/200',
  status: 'online'
};

export const mockUsers: User[] = [
  { id: '1', name: 'Theron Trump', avatar: 'https://picsum.photos/seed/theron/200', status: 'online' },
  { id: '2', name: 'Sarah Kortney', avatar: 'https://picsum.photos/seed/sarah/200', status: 'online' },
  { id: '3', name: 'Nathan Johen', avatar: 'https://picsum.photos/seed/nathan/200', status: 'offline' },
  { id: '4', name: 'Semi Doe', avatar: 'https://picsum.photos/seed/semi/200', status: 'online' },
  { id: '5', name: 'Mical Clark', avatar: 'https://picsum.photos/seed/mical/200', status: 'online' },
  { id: '6', name: 'Colin Nathan', avatar: 'https://picsum.photos/seed/colin/200', status: 'online' },
  { id: '7', name: 'Johen Doe', avatar: 'https://picsum.photos/seed/johen/200', status: 'offline' },
  { id: '8', name: 'Nathan', avatar: 'https://picsum.photos/seed/nathan2/200', status: 'online' },
  { id: '9', name: 'Christian', avatar: 'https://picsum.photos/seed/christian/200', status: 'online' },
  { id: '10', name: 'Dylan', avatar: 'https://picsum.photos/seed/dylan/200', status: 'online' },
  { id: '11', name: 'Austin', avatar: 'https://picsum.photos/seed/austin/200', status: 'online' },
  { id: '12', name: 'Thomas', avatar: 'https://picsum.photos/seed/thomas/200', status: 'online' },
  { id: '13', name: 'Chase', avatar: 'https://picsum.photos/seed/chase/200', status: 'online' },
  { id: '14', name: 'Xavier', avatar: 'https://picsum.photos/seed/xavier/200', status: 'online' },
];

export const mockChats: Chat[] = [
  {
    id: 'chat-1',
    type: 'individual',
    name: 'Theron Trump',
    avatar: 'https://picsum.photos/seed/theron/200',
    members: [currentUser, mockUsers[0]],
    messages: [
      { id: 'm1', senderId: '2', text: 'What do you think about our plans for this product launch?', timestamp: '09:25', isRead: true },
      { id: 'm2', senderId: '2', text: 'It looks to me like you have a lot planned before your deadline. I would suggest you push your deadline back so you have time to run a successful advertising campaign.', timestamp: '09:28', isRead: true },
      { id: 'm3', senderId: 'me', text: 'I would suggest you discuss this further with the advertising team.', timestamp: '09:41', isRead: true },
      { id: 'm4', senderId: 'me', text: 'I am very busy at the moment and on top of everything, I forgot my umbrella today.', timestamp: '09:41', isRead: true },
    ],
    lastMessage: { id: 'm4', senderId: 'me', text: 'I am very busy at the moment and on top of everything, I forgot my umbrella today.', timestamp: '09:41', isRead: true },
    unreadCount: 0,
    isPublic: false
  },
  {
    id: 'chat-2',
    type: 'individual',
    name: 'Mical Clark',
    avatar: 'https://picsum.photos/seed/mical/200',
    members: [currentUser, mockUsers[4]],
    messages: [],
    lastMessage: { id: 'm0', senderId: '5', text: 'Nullam facilisis velit.', timestamp: '10:00pm', isRead: true },
    unreadCount: 0,
    isPublic: false
  },
  {
    id: 'chat-3',
    type: 'individual',
    name: 'Colin Nathan',
    avatar: 'https://picsum.photos/seed/colin/200',
    members: [currentUser, mockUsers[5]],
    messages: [],
    lastMessage: { id: 'm0', senderId: '6', text: 'Nullam facilisis velit.', timestamp: '10:00pm', isRead: true },
    unreadCount: 0,
    isPublic: false
  },
  {
    id: 'chat-4',
    type: 'individual',
    name: 'Nathan Johen',
    avatar: 'https://picsum.photos/seed/nathan/200',
    members: [currentUser, mockUsers[2]],
    messages: [],
    lastMessage: { id: 'm0', senderId: '3', text: 'Nullam facilisis velit.', timestamp: '10:00pm', isRead: true },
    unreadCount: 0,
    isPublic: false
  },
  {
    id: 'chat-5',
    type: 'individual',
    name: 'Semi Doe',
    avatar: 'https://picsum.photos/seed/semi/200',
    members: [currentUser, mockUsers[3]],
    messages: [],
    lastMessage: { id: 'm0', senderId: '4', text: 'Nullam facilisis velit.', timestamp: '10:00pm', isRead: true },
    unreadCount: 0,
    isPublic: false
  },
  {
    id: 'chat-6',
    type: 'individual',
    name: 'Johen Doe',
    avatar: 'https://picsum.photos/seed/johen/200',
    members: [currentUser, mockUsers[6]],
    messages: [],
    lastMessage: { id: 'm0', senderId: '7', text: 'Nullam facilisis velit.', timestamp: '10:00pm', isRead: true },
    unreadCount: 0,
    isPublic: false
  }
];
