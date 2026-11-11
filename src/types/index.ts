export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  exchangeRate: number; // relative to USD
}

export type ThemeMode = 'dark' | 'light';

export type UpiProvider = 'slice' | 'gpay' | 'phonepe' | 'paytm' | 'bank' | 'cred';

export type PaymentProfileKind = 'upi' | 'debit' | 'credit';

export type BankBrand = 'hdfc' | 'icici' | 'sbi' | 'axis' | 'kotak' | 'amex';

export interface UpiAccount {
  id: string;
  title: string;
  kind?: PaymentProfileKind;
  bankName?: string;
  bankBrand?: BankBrand;
  provider: UpiProvider;
  upiId: string;
  cardHolder: string;
  cardNumber: string; // e.g. "•••• •••• •••• 4821"
  expiry: string;     // e.g. "08/30"
  cardType: 'VISA' | 'Mastercard' | 'RuPay';
  accentColor: string;
  secondaryColor: string;
  balance: number;
  totalSpent: number;
  isDefault?: boolean;
}

export interface Friend {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  upiId?: string;
  phone?: string;
  netBalance: number; // Positive = friend owes you, Negative = you owe friend
}

export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';

export interface SplitMemberShare {
  friendId: string;
  amount: number;
  share?: number;
  percentage?: number;
  paidAmount: number;
}

export interface Trip {
  id: string;
  name: string;
  category: 'trip' | 'apartment' | 'party' | 'weekend' | 'general';
  icon: string;
  coverGradient: [string, string];
  coverImage?: string;
  startDate: string;
  endDate?: string;
  totalSpend: number;
  members: string[]; // friend IDs including 'user'
  currency: CurrencyCode;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  iconKey: string;
  color: string;
}

export interface CategoryMetric {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  color: string;
  icon: string;
  size: number; // relative bubble radius
  x: number;    // center x percent (0-100)
  y: number;    // center y percent (0-100)
}

export interface Transaction {
  id: string;
  title: string;
  subtitle?: string;
  amount: number;
  type: 'expense' | 'income' | 'settlement' | 'transfer';
  category: string;
  categoryIcon: string;
  date: string;
  time: string;
  upiAccountId: string; // ID of the UpiAccount used
  tripId?: string;       // Linked Trip if categorized
  paidBy: string;        // 'user' or friendId
  splitType: SplitType;
  splits: SplitMemberShare[];
  settled: boolean;
  notes?: string;
}

export interface DebtSimplification {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  toUpiId?: string;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  income: number;
  expense: number;
}
