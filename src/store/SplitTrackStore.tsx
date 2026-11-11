import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationType, triggerNotification } from '../utils/haptics';
import {
  UpiAccount,
  Friend,
  Trip,
  Transaction,
  CategoryMetric,
  DebtSimplification,
  ChartDataPoint,
  ExpenseCategory,
} from '../types';

const STORE_STORAGE_KEY = '@splittrack_app_data_v4';

const initialCategories: ExpenseCategory[] = [
  { id: 'cat-food', name: 'Food & Drinks', iconKey: 'cup-hot', color: '#F97316' },
  { id: 'cat-groceries', name: 'Groceries', iconKey: 'cart-large-minimalistic', color: '#10B981' },
  { id: 'cat-travel', name: 'Travel', iconKey: 'bus', color: '#3B82F6' },
  { id: 'cat-stay', name: 'Stay', iconKey: 'home-2', color: '#8B5CF6' },
  { id: 'cat-shopping', name: 'Shopping', iconKey: 'bag-2', color: '#EC4899' },
  { id: 'cat-work', name: 'Work', iconKey: 'case-minimalistic', color: '#06B6D4' },
  { id: 'cat-software', name: 'Software & Tools', iconKey: 'layers', color: '#6366F1' },
  { id: 'cat-fun', name: 'Fun', iconKey: 'confetti', color: '#F59E0B' },
  { id: 'cat-other', name: 'Other', iconKey: 'tag', color: '#71717A' },
];

// Initial UPI Profiles for split tracking & settlements
const initialAccounts: UpiAccount[] = [
  {
    id: 'acc-slice',
    title: 'Personal • Slice UPI',
    provider: 'slice',
    upiId: 'alex@slice',
    cardHolder: 'Alex',
    cardNumber: '',
    expiry: '',
    cardType: 'RuPay',
    accentColor: '#6366F1',
    secondaryColor: '#2A2E3D',
    balance: 0,
    totalSpent: 4230.15,
    isDefault: true,
  },
  {
    id: 'acc-gpay',
    title: 'Main • GPay',
    provider: 'gpay',
    upiId: 'alex@okaxis',
    cardHolder: 'Alex',
    cardNumber: '',
    expiry: '',
    cardType: 'RuPay',
    accentColor: '#3B82F6',
    secondaryColor: '#0E2248',
    balance: 0,
    totalSpent: 12450.0,
  },
  {
    id: 'acc-phonepe',
    title: 'Splits • PhonePe',
    kind: 'upi',
    provider: 'phonepe',
    upiId: 'alex@ybl',
    cardHolder: 'Alex',
    cardNumber: '',
    expiry: '',
    cardType: 'RuPay',
    accentColor: '#8B5CF6',
    secondaryColor: '#1E50BA',
    balance: 0,
    totalSpent: 1820.5,
  },
  {
    id: 'acc-hdfc-credit',
    title: 'Millennia Credit',
    kind: 'credit',
    bankName: 'HDFC Bank',
    bankBrand: 'hdfc',
    provider: 'bank',
    upiId: '',
    cardHolder: 'Alex',
    cardNumber: '•••• •••• •••• 4821',
    expiry: '08/30',
    cardType: 'VISA',
    accentColor: '#1D4ED8',
    secondaryColor: '#C81E32',
    balance: 0,
    totalSpent: 3140.0,
  },
  {
    id: 'acc-icici-debit',
    title: 'Coral Debit',
    kind: 'debit',
    bankName: 'ICICI Bank',
    bankBrand: 'icici',
    provider: 'bank',
    upiId: '',
    cardHolder: 'Alex',
    cardNumber: '•••• •••• •••• 9104',
    expiry: '11/29',
    cardType: 'Mastercard',
    accentColor: '#EA580C',
    secondaryColor: '#9A3412',
    balance: 0,
    totalSpent: 960.0,
  },
];

// Friends matching Quick Send carousel in Reference Image 2
const initialFriends: Friend[] = [
  {
    id: 'friend-1',
    name: 'Emily Smith',
    handle: '@emily_s',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    upiId: 'emily@oksbi',
    phone: '+1 555-0192',
    netBalance: 450.0, // Emily owes you $450
  },
  {
    id: 'friend-2',
    name: 'Olivia Wilson',
    handle: '@olivia_w',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    upiId: 'olivia@slice',
    phone: '+1 555-0144',
    netBalance: -120.0, // You owe Olivia $120
  },
  {
    id: 'friend-3',
    name: 'James Davis',
    handle: '@james_d',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    upiId: 'james@okaxis',
    phone: '+1 555-0188',
    netBalance: 650.0, // James owes you $650
  },
  {
    id: 'friend-4',
    name: 'Robert Smith',
    handle: '@robert_s',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    upiId: 'robert@ybl',
    phone: '+1 555-0112',
    netBalance: -200.0, // You owe Robert $200
  },
  {
    id: 'friend-5',
    name: 'William Smith',
    handle: '@william_s',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
    upiId: 'william@paytm',
    phone: '+1 555-0131',
    netBalance: 0.0, // Settled
  },
];

// Initial Trips
const initialTrips: Trip[] = [
  {
    id: 'trip-goa',
    name: 'Goa Road Trip 🌴',
    category: 'trip',
    icon: 'Palmtree',
    coverGradient: ['#FF6036', '#FF3730'],
    coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80',
    startDate: 'May 12, 2026',
    endDate: 'May 18, 2026',
    totalSpend: 1420.0,
    members: ['user', 'friend-1', 'friend-2', 'friend-3'],
    currency: 'INR',
  },
  {
    id: 'trip-manali',
    name: 'Manali Snow Trek 🏔️',
    category: 'trip',
    icon: 'Mountain',
    coverGradient: ['#1A3E7D', '#4D88FF'],
    coverImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=600&q=80',
    startDate: 'Jun 20, 2026',
    endDate: 'Jun 26, 2026',
    totalSpend: 2150.0,
    members: ['user', 'friend-3', 'friend-4', 'friend-5'],
    currency: 'INR',
  },
  {
    id: 'trip-flatmates',
    name: 'Apartment 402 & Bills 🏠',
    category: 'apartment',
    icon: 'Home',
    coverGradient: ['#10B981', '#059669'],
    coverImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80',
    startDate: 'Ongoing',
    totalSpend: 840.5,
    members: ['user', 'friend-1', 'friend-2'],
    currency: 'INR',
  },
];

// Initial Transactions (matching Reference Image 1 & 3)
const initialTransactions: Transaction[] = [
  {
    id: 'tx-1',
    title: 'Adobe Creative Cloud',
    subtitle: 'Today, 09:42',
    amount: -59.99,
    type: 'expense',
    category: 'Software & Tools',
    categoryIcon: 'Layers',
    date: '2026-11-11',
    time: '09:42',
    upiAccountId: 'acc-slice',
    paidBy: 'user',
    splitType: 'equal',
    splits: [],
    settled: true,
  },
  {
    id: 'tx-2',
    title: 'Monthly Allowance',
    subtitle: 'Today, 08:15',
    amount: 187.5,
    type: 'income',
    category: 'Income',
    categoryIcon: 'ArrowDownLeft',
    date: '2026-11-11',
    time: '08:15',
    upiAccountId: 'acc-gpay',
    paidBy: 'user',
    splitType: 'equal',
    splits: [],
    settled: true,
  },
  {
    id: 'tx-3',
    title: 'Office Supplies',
    subtitle: 'Jun 28, 10:22',
    amount: -24.0,
    type: 'expense',
    category: 'Work',
    categoryIcon: 'Briefcase',
    date: '2026-06-28',
    time: '10:22',
    upiAccountId: 'acc-phonepe',
    paidBy: 'user',
    splitType: 'equal',
    splits: [],
    settled: true,
  },
  {
    id: 'tx-4',
    title: 'Beach Villa Stay',
    subtitle: 'Goa Road Trip • Split',
    amount: -450.0,
    type: 'expense',
    category: 'Travel',
    categoryIcon: 'Home',
    date: '2026-05-14',
    time: '14:20',
    upiAccountId: 'acc-slice',
    tripId: 'trip-goa',
    paidBy: 'user',
    splitType: 'equal',
    splits: [
      { friendId: 'user', amount: 112.5, paidAmount: 450 },
      { friendId: 'friend-1', amount: 112.5, paidAmount: 0 },
      { friendId: 'friend-2', amount: 112.5, paidAmount: 0 },
      { friendId: 'friend-3', amount: 112.5, paidAmount: 0 },
    ],
    settled: false,
  },
  {
    id: 'tx-5',
    title: 'Seafood Shack Dinner',
    subtitle: 'Paid by James Davis',
    amount: -160.0,
    type: 'expense',
    category: 'Food & Drinks',
    categoryIcon: 'cup-hot',
    date: '2026-05-15',
    time: '20:45',
    upiAccountId: 'acc-gpay',
    tripId: 'trip-goa',
    paidBy: 'friend-3',
    splitType: 'equal',
    splits: [
      { friendId: 'user', amount: 40.0, paidAmount: 0 },
      { friendId: 'friend-1', amount: 40.0, paidAmount: 0 },
      { friendId: 'friend-2', amount: 40.0, paidAmount: 0 },
      { friendId: 'friend-3', amount: 40.0, paidAmount: 160 },
    ],
    settled: false,
  },
  {
    id: 'tx-6',
    title: 'Supermarket Grocery Run',
    subtitle: 'Apartment 402 • Split',
    amount: -92.4,
    type: 'expense',
    category: 'Groceries',
    categoryIcon: 'ShoppingCart',
    date: '2026-11-08',
    time: '18:10',
    upiAccountId: 'acc-gpay',
    tripId: 'trip-flatmates',
    paidBy: 'user',
    splitType: 'equal',
    splits: [
      { friendId: 'user', amount: 30.8, paidAmount: 92.4 },
      { friendId: 'friend-1', amount: 30.8, paidAmount: 0 },
      { friendId: 'friend-2', amount: 30.8, paidAmount: 0 },
    ],
    settled: false,
  },
];

// 3D Glass Category Bubbles matching Reference Image 1 Screen 3 exactly!
const initialCategoryMetrics: CategoryMetric[] = [
  {
    id: 'cat-groceries',
    name: 'Groceries',
    percentage: 32.8,
    amount: 604.36,
    color: '#FFA500', // Glowing Amber
    icon: 'ShoppingCart',
    size: 130,
    x: 68,
    y: 38,
  },
  {
    id: 'cat-clothes',
    name: 'Clothes and Shoes',
    percentage: 16.1,
    amount: 296.65,
    color: '#FF6F59',
    icon: 'Shirt',
    size: 104,
    x: 28,
    y: 18,
  },
  {
    id: 'cat-cafes',
    name: 'Cafes and Restaurants',
    percentage: 14.8,
    amount: 272.7,
    color: '#FF8C42',
    icon: 'Coffee',
    size: 100,
    x: 28,
    y: 58,
  },
  {
    id: 'cat-sport',
    name: 'Sport',
    percentage: 11.3,
    amount: 208.2,
    color: '#FF7B60',
    icon: 'Dumbbell',
    size: 88,
    x: 24,
    y: 38,
  },
  {
    id: 'cat-health',
    name: 'Health',
    percentage: 8.4,
    amount: 154.77,
    color: '#FF5C6C',
    icon: 'Heart',
    size: 80,
    x: 74,
    y: 16,
  },
  {
    id: 'cat-travel',
    name: 'Travel',
    percentage: 6.7,
    amount: 123.45,
    color: '#FF9E64',
    icon: 'Bus',
    size: 74,
    x: 72,
    y: 60,
  },
];

// Interactive Financial Spline trajectory points matching Reference Image 2 & 3
const initialChartData: ChartDataPoint[] = [
  { date: '2026-02-01', label: 'Feb', income: 420.0, expense: 310.0 },
  { date: '2026-03-01', label: 'Mar', income: 510.0, expense: 480.0 },
  { date: '2026-04-01', label: 'Apr', income: 630.0, expense: 390.0 },
  { date: '2026-05-01', label: 'May', income: 590.0, expense: 520.0 },
  { date: '2026-06-07', label: 'Jun', income: 567.21, expense: 127.0 },
  { date: '2026-07-01', label: 'Jul', income: 680.0, expense: 430.0 },
  { date: '2026-08-01', label: 'Aug', income: 750.0, expense: 490.0 },
];

interface SplitTrackContextType {
  accounts: UpiAccount[];
  friends: Friend[];
  trips: Trip[];
  transactions: Transaction[];
  categories: ExpenseCategory[];
  categoryMetrics: CategoryMetric[];
  chartData: ChartDataPoint[];
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  monthlyExpenses: number;
  netFriendBalance: number;
  totalOwedToYou: number;
  totalYouOwe: number;
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  addFriend: (friend: Omit<Friend, 'id' | 'netBalance'>) => void;
  addTrip: (trip: Omit<Trip, 'id' | 'totalSpend'>) => void;
  addUpiAccount: (acc: Omit<UpiAccount, 'id' | 'totalSpent'>) => UpiAccount;
  addCategory: (name: string, iconKey: string, color?: string) => ExpenseCategory;
  settleWithFriend: (friendId: string, amount?: number) => void;
  getSimplifiedDebts: () => DebtSimplification[];
  resetDemoData: () => void;
}

const SplitTrackContext = createContext<SplitTrackContextType | undefined>(undefined);

export const SplitTrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<UpiAccount[]>(initialAccounts);
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [categoryMetrics] = useState<CategoryMetric[]>(initialCategoryMetrics);
  const [chartData] = useState<ChartDataPoint[]>(initialChartData);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc-slice');

  // Persistence
  useEffect(() => {
    const loadState = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.accounts) {
            const hasCards = parsed.accounts.some(
              (a: UpiAccount) => a.kind === 'debit' || a.kind === 'credit'
            );
            const seededCards = initialAccounts.filter(
              (ia) =>
                (ia.kind === 'debit' || ia.kind === 'credit') &&
                !parsed.accounts.some((pa: UpiAccount) => pa.id === ia.id)
            );
            setAccounts(hasCards ? parsed.accounts : [...parsed.accounts, ...seededCards]);
          }
          if (parsed.friends) setFriends(parsed.friends);
          if (parsed.trips) setTrips(parsed.trips);
          if (parsed.transactions) setTransactions(parsed.transactions);
          if (parsed.categories) setCategories(parsed.categories);
        }
      } catch (err) {
        console.warn('Failed to load store state', err);
      }
    };
    loadState();
  }, []);

  const saveState = async (
    nextAcc = accounts,
    nextFriends = friends,
    nextTrips = trips,
    nextTx = transactions,
    nextCategories = categories
  ) => {
    try {
      await AsyncStorage.setItem(
        STORE_STORAGE_KEY,
        JSON.stringify({
          accounts: nextAcc,
          friends: nextFriends,
          trips: nextTrips,
          transactions: nextTx,
          categories: nextCategories,
        })
      );
    } catch (err) {
      console.warn('Failed to save store state', err);
    }
  };

  // Aggregated totals
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalIncome = 12850.0; // matching reference image metric badge
  const totalExpenses = 5420.0; // matching reference image metric badge

  const totalOwedToYou = friends
    .filter((f) => f.netBalance > 0)
    .reduce((sum, f) => sum + f.netBalance, 0);

  const totalYouOwe = Math.abs(
    friends.filter((f) => f.netBalance < 0).reduce((sum, f) => sum + f.netBalance, 0)
  );

  const monthlyExpenses = totalExpenses;
  const netFriendBalance = totalOwedToYou - totalYouOwe;

  // Add Transaction & update splits/balances
  const addTransaction = (txData: Omit<Transaction, 'id'>) => {
    const newId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      ...txData,
      id: newId,
    };

    const nextTx = [newTx, ...transactions];
    setTransactions(nextTx);

    const targetAccountId = txData.upiAccountId || accounts[0]?.id;
    const nextAcc = accounts.map((acc) => {
      if (acc.id === targetAccountId) {
        const delta = txData.type === 'income' ? txData.amount : -Math.abs(txData.amount);
        return {
          ...acc,
          balance: acc.balance + delta,
          totalSpent: txData.type === 'expense' ? acc.totalSpent + Math.abs(txData.amount) : acc.totalSpent,
        };
      }
      return acc;
    });
    setAccounts(nextAcc);

    // Update friend balances based on splits
    let nextFriends = [...friends];
    if (txData.splits && txData.splits.length > 0) {
      const isPaidByUser = txData.paidBy === 'user';
      nextFriends = nextFriends.map((friend) => {
        const splitForFriend = txData.splits.find((s) => s.friendId === friend.id);
        if (!splitForFriend) return friend;

        let delta = 0;
        if (isPaidByUser) {
          // User paid for friend => friend owes user more
          delta = splitForFriend.amount;
        } else if (txData.paidBy === friend.id) {
          // Friend paid for user => user owes friend (friend's net balance decreases towards negative)
          const userShare = txData.splits.find((s) => s.friendId === 'user')?.amount || 0;
          delta = -userShare;
        }

        return {
          ...friend,
          netBalance: friend.netBalance + delta,
        };
      });
      setFriends(nextFriends);
    }

    // Update Trip spend if linked
    let nextTrips = [...trips];
    if (txData.tripId) {
      nextTrips = nextTrips.map((trip) => {
        if (trip.id === txData.tripId) {
          return {
            ...trip,
            totalSpend: trip.totalSpend + Math.abs(txData.amount),
          };
        }
        return trip;
      });
      setTrips(nextTrips);
    }

    triggerNotification(NotificationType.Success);

    saveState(nextAcc, nextFriends, nextTrips, nextTx);
  };

  // Add friend
  const addFriend = (friendData: Omit<Friend, 'id' | 'netBalance'>) => {
    const newFriend: Friend = {
      ...friendData,
      id: `friend-${Date.now()}`,
      netBalance: 0,
    };
    const nextFriends = [newFriend, ...friends];
    setFriends(nextFriends);
    saveState(accounts, nextFriends, trips, transactions);
  };

  // Add Trip
  const addTrip = (tripData: Omit<Trip, 'id' | 'totalSpend'>) => {
    const newTrip: Trip = {
      ...tripData,
      id: `trip-${Date.now()}`,
      totalSpend: 0,
    };
    const nextTrips = [newTrip, ...trips];
    setTrips(nextTrips);
    saveState(accounts, friends, nextTrips, transactions);
  };

  // Add UPI Profile Account
  const addUpiAccount = (accData: Omit<UpiAccount, 'id' | 'totalSpent'>): UpiAccount => {
    const newAccount: UpiAccount = {
      ...accData,
      id: `acc-${Date.now()}`,
      totalSpent: 0,
    };
    const nextAccounts = [...accounts, newAccount];
    setAccounts(nextAccounts);
    saveState(nextAccounts, friends, trips, transactions, categories);
    return newAccount;
  };

  // Add Custom Category
  const addCategory = (name: string, iconKey: string, color: string = '#6366F1'): ExpenseCategory => {
    const trimmed = name.trim();
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      const updated = categories.map((c) =>
        c.id === existing.id ? { ...c, iconKey, color } : c
      );
      setCategories(updated);
      saveState(accounts, friends, trips, transactions, updated);
      return { ...existing, iconKey, color };
    }
    const newCat: ExpenseCategory = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      iconKey,
      color,
    };
    const nextCats = [...categories, newCat];
    setCategories(nextCats);
    saveState(accounts, friends, trips, transactions, nextCats);
    triggerNotification(NotificationType.Success);
    return newCat;
  };

  // Settle up with a friend
  const settleWithFriend = (friendId: string, customAmount?: number) => {
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) return;

    const amountToSettle = customAmount !== undefined ? customAmount : Math.abs(friend.netBalance);
    const wasOwedToUser = friend.netBalance > 0;

    // Create settlement transaction
    const newTx: Transaction = {
      id: `tx-settle-${Date.now()}`,
      title: `Settled with ${friend.name}`,
      subtitle: wasOwedToUser ? 'Received settlement' : 'Marked as settled',
      amount: wasOwedToUser ? amountToSettle : -amountToSettle,
      type: 'settlement',
      category: 'Settlement',
      categoryIcon: 'CheckCircle2',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      upiAccountId: selectedAccountId,
      paidBy: wasOwedToUser ? friend.id : 'user',
      splitType: 'equal',
      splits: [],
      settled: true,
    };

    const nextFriends = friends.map((f) => {
      if (f.id === friendId) {
        return {
          ...f,
          netBalance: 0, // Reset to zero
        };
      }
      return f;
    });

    const nextTx = [newTx, ...transactions];
    setFriends(nextFriends);
    setTransactions(nextTx);

    triggerNotification(NotificationType.Success);

    saveState(accounts, nextFriends, trips, nextTx);
  };

  // Greedy Minimum Cash Flow Algorithm for debt simplification
  const getSimplifiedDebts = (): DebtSimplification[] => {
    const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
    // Map of net balances for all entities
    const netMap: { [id: string]: { name: string; net: number; upiId?: string } } = {
      user: { name: 'You', net: 0, upiId: activeAccount?.upiId },
    };

    friends.forEach((f) => {
      netMap[f.id] = { name: f.name, net: -f.netBalance, upiId: f.upiId }; // if f.netBalance > 0 (owes user), their net is negative (debtor)
      netMap.user.net += f.netBalance; // user gets positive net
    });

    const debtors: { id: string; name: string; amount: number; upiId?: string }[] = [];
    const creditors: { id: string; name: string; amount: number; upiId?: string }[] = [];

    Object.entries(netMap).forEach(([id, data]) => {
      if (data.net < -0.01) {
        debtors.push({ id, name: data.name, amount: -data.net, upiId: data.upiId });
      } else if (data.net > 0.01) {
        creditors.push({ id, name: data.name, amount: data.net, upiId: data.upiId });
      }
    });

    const simplifications: DebtSimplification[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const minAmount = Math.min(debtor.amount, creditor.amount);

      simplifications.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: Math.round(minAmount * 100) / 100,
        toUpiId: creditor.upiId,
      });

      debtor.amount -= minAmount;
      creditor.amount -= minAmount;

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return simplifications;
  };

  const resetDemoData = () => {
    setAccounts(initialAccounts);
    setFriends(initialFriends);
    setTrips(initialTrips);
    setTransactions(initialTransactions);
    setCategories(initialCategories);
    saveState(initialAccounts, initialFriends, initialTrips, initialTransactions, initialCategories);
    triggerNotification(NotificationType.Warning);
  };

  return (
    <SplitTrackContext.Provider
      value={{
        accounts,
        friends,
        trips,
        transactions,
        categories,
        categoryMetrics,
        chartData,
        totalBalance,
        totalIncome,
        totalExpenses,
        monthlyExpenses,
        netFriendBalance,
        totalOwedToYou,
        totalYouOwe,
        selectedAccountId,
        setSelectedAccountId,
        addTransaction,
        addFriend,
        addTrip,
        addUpiAccount,
        addCategory,
        settleWithFriend,
        getSimplifiedDebts,
        resetDemoData,
      }}
    >
      {children}
    </SplitTrackContext.Provider>
  );
};

export const useSplitTrack = () => {
  const context = useContext(SplitTrackContext);
  if (!context) {
    throw new Error('useSplitTrack must be used within a SplitTrackProvider');
  }
  return context;
};
