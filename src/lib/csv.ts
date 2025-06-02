import { format } from 'date-fns';
import type { JournalEntry, JournalData } from './types';

const CSV_HEADERS: (keyof JournalEntry | 'accountName' | 'initialBalance')[] = [
  'id', 'date', 'time', 'direction', 'market', 
  'entryPrice', 'accountBalanceAtEntry', 'positionSize', 'slPrice', 'tpPrice', 
  'actualExitPrice', 'rrr', 'pl', 'screenshot', 'notes', 
  'disciplineRating', 'emotionalState', 'session', 'reasonForEntry', 'reasonForExit'
];

// Extended headers for full data export including account info
const FULL_DATA_CSV_HEADERS: string[] = [
  'accountName', 'initialBalance', // These will be repeated for each entry row during export for simplicity or handled differently
  'id', 'date', 'time', 'direction', 'market', 
  'entryPrice', 'accountBalanceAtEntry', 'positionSize', 'slPrice', 'tpPrice', 
  'actualExitPrice', 'rrr', 'pl', 'screenshot', 'notes', 
  'disciplineRating', 'emotionalState', 'session', 'reasonForEntry', 'reasonForExit'
];


export function exportJournalDataToCSV(data: JournalData): void {
  const { accountName, initialBalance, entries } = data;

  const headerString = FULL_DATA_CSV_HEADERS.join(',');
  
  const rows = entries.map(entry => {
    const entryData = {
      accountName,
      initialBalance,
      ...entry,
      date: format(new Date(entry.date), 'yyyy-MM-dd'), // Format date for CSV
      // Screenshot is Base64, can be very long. Might want to export a link or omit. For now, include.
      screenshot: entry.screenshot ? 'has_screenshot' : '', // Indicate presence instead of full base64
    };

    return FULL_DATA_CSV_HEADERS.map(header => {
      const value = entryData[header as keyof typeof entryData];
      if (value === null || value === undefined) return '';
      // Escape commas and newlines in string values
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',');
  });

  const csvContent = [headerString, ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${accountName}_trading_journal_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function importJournalDataFromCSV(csvString: string): JournalData | null {
  try {
    const lines = csvString.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return null; // Must have header + at least one data row

    const headerLine = lines[0];
    // Basic CSV parsing for headers, doesn't handle quoted commas in headers itself
    const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());
    
    let accountName = "Imported Account";
    let initialBalance = 0;
    const entries: JournalEntry[] = [];

    const accountNameIndex = headers.indexOf('accountName');
    const initialBalanceIndex = headers.indexOf('initialBalance');

    if (lines.length > 1) {
        const firstDataRowValues = parseCSVRow(lines[1], headers.length);
        if (accountNameIndex !== -1 && firstDataRowValues[accountNameIndex]) {
            accountName = firstDataRowValues[accountNameIndex];
        }
        if (initialBalanceIndex !== -1 && firstDataRowValues[initialBalanceIndex]) {
            initialBalance = parseFloat(firstDataRowValues[initialBalanceIndex]) || 0;
        }
    }


    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i], headers.length);
      if (values.length !== headers.length) {
        console.warn(`Skipping malformed row ${i+1}: Expected ${headers.length} values, got ${values.length}`);
        continue;
      }

      const entry: Partial<JournalEntry & { accountName?: string; initialBalance?: number }> = {};
      headers.forEach((header, index) => {
        const key = header as keyof JournalEntry;
        const value = values[index];
        
        if (value === '' || value === 'N/A') {
          entry[key] = undefined;
          return;
        }

        switch (key) {
          case 'date':
            entry.date = new Date(value);
            break;
          case 'entryPrice':
          case 'accountBalanceAtEntry':
          case 'positionSize':
          case 'slPrice':
          case 'tpPrice':
          case 'actualExitPrice':
          case 'pl':
          case 'disciplineRating':
            entry[key] = parseFloat(value);
            break;
          case 'direction':
             entry.direction = value as JournalEntry['direction'];
             break;
          case 'screenshot':
            // During import, 'has_screenshot' indicates a screenshot existed.
            // We don't re-import the actual image data from this CSV field.
            // User would need to re-upload if editing.
            entry.screenshot = value === 'has_screenshot' ? 'Screenshot was present' : undefined;
            break;
          default:
            entry[key] = value;
        }
      });
      
      // Validate required fields for a JournalEntry
      if (entry.id && entry.date && entry.time && entry.direction && entry.market && entry.accountBalanceAtEntry !== undefined && entry.disciplineRating) {
         entries.push(entry as JournalEntry);
      } else {
        console.warn("Skipping row due to missing required fields:", entry);
      }
    }
    
    if (entries.length === 0 && lines.length > 1) {
        // if no entries parsed but there was data, it implies format issue or only account data
        console.warn("CSV imported, but no valid journal entries found. Check CSV format.");
    }

    return { accountName, initialBalance, entries };

  } catch (error) {
    console.error("Error importing CSV:", error);
    return null;
  }
}

// Basic CSV row parser that handles quoted fields containing commas
function parseCSVRow(rowString: string, expectedLength: number): string[] {
  const values = [];
  let currentVal = '';
  let inQuotes = false;
  for (let i = 0; i < rowString.length; i++) {
    const char = rowString[i];
    if (char === '"') {
      if (inQuotes && i + 1 < rowString.length && rowString[i+1] === '"') {
        // Escaped quote
        currentVal += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentVal.trim());
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  values.push(currentVal.trim()); // Add last value

  // Pad with empty strings if row is shorter than expected (e.g. trailing commas omitted)
  while(values.length < expectedLength) {
    values.push('');
  }
  // Truncate if row is longer (e.g. extra commas at end)
  if (values.length > expectedLength) {
    return values.slice(0, expectedLength);
  }
  return values;
}
