
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { JournalEntry, TradeDirection } from './types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'trading_journal.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initialBalance REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL, -- ISO8601 string
      time TEXT NOT NULL,
      direction TEXT CHECK(direction IN ('Long', 'Short', 'No Trade')) NOT NULL,
      market TEXT NOT NULL,
      entryPrice REAL,
      accountBalanceAtEntry REAL NOT NULL,
      positionSize REAL,
      slPrice REAL,
      tpPrice REAL,
      actualExitPrice REAL,
      rrr TEXT,
      pl REAL,
      screenshot TEXT, -- Base64 data URL or reference
      notes TEXT,
      disciplineRating INTEGER CHECK(disciplineRating >= 1 AND disciplineRating <= 5) NOT NULL,
      emotionalState TEXT,
      session TEXT,
      reasonForEntry TEXT,
      reasonForExit TEXT,
      accountId TEXT NOT NULL,
      FOREIGN KEY (accountId) REFERENCES accounts(id)
    );
  `);

  // Ensure default account exists
  const defaultAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get('default_account');
  if (!defaultAccount) {
    db.prepare('INSERT INTO accounts (id, name, initialBalance) VALUES (?, ?, ?)')
      .run('default_account', 'Demo Account', 10000);
  }
}

initializeSchema();

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
}

export function getAccount(accountId: string): Account | null {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as Account | undefined;
  return row || null;
}

export function updateAccount(accountId: string, name: string, initialBalance: number): void {
  db.prepare('UPDATE accounts SET name = ?, initialBalance = ? WHERE id = ?')
    .run(name, initialBalance, accountId);
}

export function getJournalEntries(accountId: string): JournalEntry[] {
  const rows = db.prepare('SELECT * FROM entries WHERE accountId = ? ORDER BY date ASC, time ASC').all(accountId) as any[];
  return rows.map(row => ({
    ...row,
    date: new Date(row.date), // Convert ISO string back to Date object
    disciplineRating: row.disciplineRating as 1 | 2 | 3 | 4 | 5,
    direction: row.direction as TradeDirection,
  }));
}

export function addJournalEntry(entry: Omit<JournalEntry, 'id'>, accountId: string): string {
  const id = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const stmt = db.prepare(`
    INSERT INTO entries (
      id, date, time, direction, market, entryPrice, accountBalanceAtEntry,
      positionSize, slPrice, tpPrice, actualExitPrice, rrr, pl,
      screenshot, notes, disciplineRating, emotionalState, session,
      reasonForEntry, reasonForExit, accountId
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);
  stmt.run(
    id,
    entry.date.toISOString(), // Store date as ISO string
    entry.time,
    entry.direction,
    entry.market,
    entry.entryPrice,
    entry.accountBalanceAtEntry,
    entry.positionSize,
    entry.slPrice,
    entry.tpPrice,
    entry.actualExitPrice,
    entry.rrr,
    entry.pl,
    entry.screenshot,
    entry.notes,
    entry.disciplineRating,
    entry.emotionalState,
    entry.session,
    entry.reasonForEntry,
    entry.reasonForExit,
    accountId
  );
  return id;
}

export function clearJournalEntries(accountId: string): void {
  db.prepare('DELETE FROM entries WHERE accountId = ?').run(accountId);
}

// Used by CSV import
export function batchInsertJournalEntries(entries: Omit<JournalEntry, 'id'>[], accountId: string): void {
  const insert = db.prepare(`
    INSERT INTO entries (
      id, date, time, direction, market, entryPrice, accountBalanceAtEntry,
      positionSize, slPrice, tpPrice, actualExitPrice, rrr, pl,
      screenshot, notes, disciplineRating, emotionalState, session,
      reasonForEntry, reasonForExit, accountId
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const insertMany = db.transaction((items: Omit<JournalEntry, 'id'>[]) => {
    for (const item of items) {
      const id = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${items.indexOf(item)}`;
      insert.run(
        id,
        item.date.toISOString(),
        item.time,
        item.direction,
        item.market,
        item.entryPrice,
        item.accountBalanceAtEntry,
        item.positionSize,
        item.slPrice,
        item.tpPrice,
        item.actualExitPrice,
        item.rrr,
        item.pl,
        item.screenshot,
        item.notes,
        item.disciplineRating,
        item.emotionalState,
        item.session,
        item.reasonForEntry,
        item.reasonForExit,
        accountId
      );
    }
  });

  insertMany(entries);
}

export default db;
