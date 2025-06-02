
export type TradeDirection = "Long" | "Short" | "No Trade" | "Withdrawal" | "Deposit";

export interface JournalEntry {
  id: string;
  date: Date;
  time: string; // HH:MM
  direction: TradeDirection;
  market: string; // For trades; can be "N/A" or "Account" for withdrawals/deposits
  entryPrice?: number;
  accountBalanceAtEntry: number;
  positionSize?: number;
  slPrice?: number;
  tpPrice?: number;
  actualExitPrice?: number;
  rrr?: string; // e.g., "2.50:1" or "N/A"
  pl?: number; // Profit/Loss for trades, Amount for withdrawal/deposit (negative for withdrawal)
  screenshot?: string; // Base64 data URL
  notes?: string;
  disciplineRating: 1 | 2 | 3 | 4 | 5; // Might be N/A for withdrawal/deposit
  emotionalState?: string;
  session?: string;
  reasonForEntry?: string; // Or "Reason for Transaction"
  reasonForExit?: string;
}

export interface JournalData {
  accountName: string;
  initialBalance: number;
  entries: JournalEntry[];
}
