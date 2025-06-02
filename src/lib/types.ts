export type TradeDirection = "Long" | "Short" | "No Trade";

export interface JournalEntry {
  id: string;
  date: Date;
  time: string; // HH:MM
  direction: TradeDirection;
  market: string;
  entryPrice?: number;
  accountBalanceAtEntry: number;
  positionSize?: number;
  slPrice?: number;
  tpPrice?: number;
  actualExitPrice?: number;
  rrr?: string; // e.g., "2.50:1" or "N/A"
  pl?: number; // Profit/Loss (currency value)
  screenshot?: string; // Base64 data URL
  notes?: string;
  disciplineRating: 1 | 2 | 3 | 4 | 5;
  emotionalState?: string;
  session?: string;
  reasonForEntry?: string;
  reasonForExit?: string;
}

export interface JournalData {
  accountName: string;
  initialBalance: number;
  entries: JournalEntry[];
}
