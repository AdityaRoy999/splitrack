import { Platform } from 'react-native';
import { Friend, Transaction, Trip } from '../types';

export interface MemberActivitySummary {
  memberTransactions: Transaction[];
  settlements: Transaction[];
  splitExpenses: Transaction[];
  sharedTrips: Trip[];
  totalSharedVolume: number;
  settledVolume: number;
  paidByMemberTotal: number;
  memberShareOfExpenses: number;
}

/** Checks whether a transaction involves the given member as payer, split participant, or named settlement. */
export function doesTransactionInvolveMember(tx: Transaction, friend: Friend): boolean {
  if (tx.paidBy === friend.id) return true;
  if (tx.splits?.some((s) => s.friendId === friend.id)) return true;
  if (
    tx.type === 'settlement' &&
    friend.name.trim().length > 0 &&
    tx.title.toLowerCase().includes(friend.name.trim().toLowerCase())
  ) {
    return true;
  }
  return false;
}

/** Aggregates transactions, settlements, shared trips, and volume totals for a member. */
export function getMemberActivitySummary(
  friend: Friend,
  transactions: Transaction[],
  trips: Trip[]
): MemberActivitySummary {
  const memberTransactions = transactions.filter((tx) =>
    doesTransactionInvolveMember(tx, friend)
  );
  const settlements = memberTransactions.filter((tx) => tx.type === 'settlement');
  const splitExpenses = memberTransactions.filter((tx) => tx.type !== 'settlement');
  const sharedTrips = trips.filter((trip) => trip.members.includes(friend.id));

  let totalSharedVolume = 0;
  let paidByMemberTotal = 0;
  let memberShareOfExpenses = 0;

  for (const tx of splitExpenses) {
    const absAmt = Math.abs(tx.amount);
    totalSharedVolume += absAmt;
    if (tx.paidBy === friend.id) {
      paidByMemberTotal += absAmt;
    }
    const splitRow = tx.splits?.find((s) => s.friendId === friend.id);
    if (splitRow) {
      memberShareOfExpenses += splitRow.amount;
    }
  }

  const settledVolume = settlements.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return {
    memberTransactions,
    settlements,
    splitExpenses,
    sharedTrips,
    totalSharedVolume,
    settledVolume,
    paidByMemberTotal,
    memberShareOfExpenses,
  };
}

/** Copies text on Web when Clipboard API is available. */
export function copyTextSafe(text: string): void {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
