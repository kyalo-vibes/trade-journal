
import { format, parseISO } from 'date-fns';
import type { JournalEntry, JournalData, TradeDirection } from './types';

// Headers for CSV export and import.
// Note: 'accountName' and 'initialBalance' are part of JournalData, not JournalEntry.
// They will be included in each row for export to simplify having one CSV structure.
// During import, the first row's accountName and initialBalance will be used for the account.
const CSV_COLUMN_ORDER: (keyof JournalEntry | 'accountName' | 'initialBalance')[] = [
  'accountName', 
  'initialBalance',
  'id', // Firestore ID will be included on export, ignored on import (new IDs generated)
  'date', 
  'time', 
  'direction', 
  'market', 
  'entryPrice', 
  'accountBalanceAtEntry', 
  'positionSize', 
  'slPrice', 
  'tpPrice', 
  'actualExitPrice', 
  'rrr', 
  'pl', 
  'screenshot', // Will store "has_screenshot" or similar; actual image data not in CSV
  'notes', 
  'disciplineRating', 
  'emotionalState', 
  'session', 
  'reasonForEntry', 
  'reasonForExit'
];

// Helper to serialize a value for CSV, handling quotes and commas.
const serializeCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // If the value contains a comma, newline, or double quote, enclose it in double quotes.
  // Also, double up any existing double quotes within the value.
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export function exportJournalDataToCSV(data: JournalData): void {
  const { accountName, initialBalance, entries } = data;

  const headerString = CSV_COLUMN_ORDER.join(',');
  
  const rows = entries.map(entry => {
    const entryDataForCSV: Record<string, any> = {
      accountName, // Add accountName to each row
      initialBalance, // Add initialBalance to each row
      ...entry,
      date: entry.date instanceof Date ? format(entry.date, 'yyyy-MM-dd') : String(entry.date),
      screenshot: entry.screenshot && entry.screenshot.startsWith('data:image') ? 'has_screenshot' : '', // Indicate presence
    };

    return CSV_COLUMN_ORDER.map(header => serializeCSVValue(entryDataForCSV[header])).join(',');
  });

  const csvContent = [headerString, ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filenameSafeAccountName = accountName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `${filenameSafeAccountName}_journal_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Basic CSV row parser that handles quoted fields containing commas and escaped quotes
function parseCSVRow(rowString: string): string[] {
  const values = [];
  let currentVal = '';
  let inQuotes = false;
  for (let i = 0; i < rowString.length; i++) {
    const char = rowString[i];
    if (char === '"') {
      if (inQuotes && i + 1 < rowString.length && rowString[i+1] === '"') {
        // Escaped quote " "
        currentVal += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentVal);
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  values.push(currentVal); // Add last value
  return values.map(v => v.trim());
}


export function importJournalDataFromCSV(csvString: string): JournalData | null {
  try {
    const lines = csvString.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 1) return null; // Must have at least a header row

    const headerLine = lines[0];
    const headers = parseCSVRow(headerLine).map(h => h.replace(/^"|"$/g, '').trim() as keyof JournalEntry | 'accountName' | 'initialBalance');
    
    // Determine column indices
    const colIndices: Partial<Record<keyof JournalEntry | 'accountName' | 'initialBalance', number>> = {};
    CSV_COLUMN_ORDER.forEach(colName => {
        const index = headers.indexOf(colName);
        if (index !== -1) {
            colIndices[colName] = index;
        }
    });


    let accountName = "Imported Account";
    let initialBalance = 0;
    const entries: JournalEntry[] = [];

    // Attempt to get accountName and initialBalance from the first data row if present
    if (lines.length > 1 && colIndices.accountName !== undefined && colIndices.initialBalance !== undefined) {
        const firstDataRowValues = parseCSVRow(lines[1]);
        accountName = firstDataRowValues[colIndices.accountName!] || accountName;
        initialBalance = parseFloat(firstDataRowValues[colIndices.initialBalance!]) || initialBalance;
    }
    
    const dataRows = lines.slice(1); // All lines except the header

    for (const line of dataRows) {
      const values = parseCSVRow(line);
      if (values.length < headers.length) { // Allow more values, but not less
        console.warn(`Skipping malformed row: Expected at least ${headers.length} values, got ${values.length}. Row: ${line}`);
        continue;
      }

      const entry: Partial<JournalEntry> = {};

      // Use colIndices to map values to entry properties
      (Object.keys(colIndices) as Array<keyof typeof colIndices>).forEach(key => {
        const index = colIndices[key]!;
        const value = values[index];

        if (value === '' || value === 'N/A' || value === undefined) {
          (entry as any)[key] = undefined;
          return;
        }
        
        // Type conversions
        switch (key) {
          case 'id': entry.id = value; break; // Will be overridden by Firestore, but good to parse
          case 'date': 
            const parsedDate = parseISO(value); // date-fns parseISO for yyyy-MM-dd
            if (!isNaN(parsedDate.getTime())) {
                 entry.date = parsedDate;
            } else {
                entry.date = new Date(); // fallback, or handle error
                console.warn(`Invalid date format for row: ${value}. Using current date.`);
            }
            break;
          case 'time': entry.time = value; break;
          case 'direction': entry.direction = value as TradeDirection; break;
          case 'market': entry.market = value; break;
          case 'entryPrice': 
          case 'accountBalanceAtEntry': 
          case 'positionSize': 
          case 'slPrice': 
          case 'tpPrice': 
          case 'actualExitPrice': 
          case 'pl':
            (entry as any)[key] = parseFloat(value);
            break;
          case 'disciplineRating':
            const rating = parseInt(value, 10);
            if (rating >= 1 && rating <= 5) entry.disciplineRating = rating as 1 | 2 | 3 | 4 | 5;
            else entry.disciplineRating = 3; // fallback
            break;
          case 'rrr': entry.rrr = value; break;
          case 'screenshot':
            entry.screenshot = value === 'has_screenshot' ? 'Screenshot was present (re-upload if needed)' : undefined;
            break;
          case 'notes': entry.notes = value; break;
          case 'emotionalState': entry.emotionalState = value; break;
          case 'session': entry.session = value; break;
          case 'reasonForEntry': entry.reasonForEntry = value; break;
          case 'reasonForExit': entry.reasonForExit = value; break;
          default:
            // For 'accountName' and 'initialBalance', they are handled above.
            // Any other unknown keys from CSV_COLUMN_ORDER can be ignored for the entry object.
            break;
        }
      });
      
      // Basic validation for a journal entry
      if (entry.date && entry.time && entry.direction && entry.market && entry.accountBalanceAtEntry !== undefined && entry.disciplineRating) {
         // Firestore will generate an ID, so we don't strictly need one from CSV for new entries.
         // If an ID was parsed, it might be used for update logic if desired, but here we assume new entries.
         if (!entry.id) entry.id = `csv_import_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
         entries.push(entry as JournalEntry);
      } else {
        console.warn("Skipping row due to missing required fields or parse errors. Parsed data:", entry, "Original line:", line);
      }
    }
    
    if (entries.length === 0 && dataRows.length > 0) {
        console.warn("CSV imported, but no valid journal entries parsed. Check CSV format and content.");
    }

    return { accountName, initialBalance, entries };

  } catch (error) {
    console.error("Error importing CSV:", error);
    return null;
  }
}

