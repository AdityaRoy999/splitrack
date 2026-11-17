import type { Friend } from '../types';

// Existing sample profiles; saved friends take precedence in the local directory.
export const MEMBER_DIRECTORY: Omit<Friend, 'id' | 'netBalance'>[] = [
  {
    name: 'Aditya Roy',
    handle: '@aditya',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    upiId: 'aditya@okaxis',
    phone: '+91 91376 57510',
  },
  {
    name: 'Aditya Sharma',
    handle: '@aditya_sharma',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    upiId: 'adityasharma@paytm',
    phone: '+91 98201 44321',
  },
  {
    name: 'Aditya Verma',
    handle: '@adityav',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    upiId: 'adi@slice',
    phone: '+91 97112 88490',
  },
  {
    name: 'Alex Chen',
    handle: '@alex',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    upiId: 'alex@slice',
    phone: '+91 98765 43210',
  },
  {
    name: 'Emily Smith',
    handle: '@emily_s',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    upiId: 'emily@okhdfcbank',
    phone: '+91 98112 33445',
  },
  {
    name: 'Olivia Wilson',
    handle: '@olivia_w',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    upiId: 'olivia@okaxis',
    phone: '+91 99203 11892',
  },
  {
    name: 'James Davis',
    handle: '@james_d',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
    upiId: 'james@ybl',
    phone: '+91 98701 55678',
  },
  {
    name: 'Robert Smith',
    handle: '@robert_s',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    upiId: 'robert@paytm',
    phone: '+91 98334 22110',
  },
  {
    name: 'William Smith',
    handle: '@william_s',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
    upiId: 'william@upi',
    phone: '+91 98450 99887',
  },
  {
    name: 'Priya Kapoor',
    handle: '@priya_k',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    upiId: 'priya@okicici',
    phone: '+91 98200 77123',
  },
  {
    name: 'Rahul Mehta',
    handle: '@rahul_m',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    upiId: 'rahul@slice',
    phone: '+91 98711 00223',
  },
  {
    name: 'Ananya Rao',
    handle: '@ananya_r',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
    upiId: 'ananya@jupiteraxis',
    phone: '+91 99100 44556',
  },
];
