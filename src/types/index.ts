export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export type ThemeMode = 'dark' | 'light';

export type SelectionStyle = 'chips' | 'dropdown';
export type NotificationDirection = 'top' | 'bottom';

export type UpiProvider = 'slice' | 'gpay' | 'phonepe' | 'paytm' | 'bank' | 'cred' | string;

export type PaymentProfileKind =
  | 'upi'
  | 'debit'
  | 'credit'
  | 'wallet'
  | 'forex'
  | 'netbanking';

export type BankBrand =
  | 'hdfc'
  | 'icici'
  | 'sbi'
  | 'axis'
  | 'kotak'
  | 'amex'
  | string;

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
  isReceivingDefault?: boolean;
}

export interface Friend {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  upiId?: string;
  paymentName?: string;
  receivingProvider?: UpiProvider;
  receivingBankBrand?: BankBrand;
  phone?: string;
  netBalance: number; // Positive = friend owes you, Negative = you owe friend
  avatarRef?: string;
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
  category: string;
  icon: string;
  coverGradient: [string, string];
  coverImage?: string;
  startDate: string;
  endDate?: string;
  totalSpend: number;
  members: string[]; // friend IDs including 'user'
  currency: CurrencyCode;
  ownerId?: string;
  coverImageRef?: string;
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
  location?: string;
  notes?: string;
  creatorId?: string;
  toAccountId?: string;
  remainingAmount?: number;
  sourceTransactionId?: string;
  settlementVector?: { memberId: string; remainingAmount: number; balances: { creditorId: string; debtorId: string; amount: number }[] }[];
  deletedAt?: string;
  expiresAt?: number;
  canRestore?: boolean;
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
