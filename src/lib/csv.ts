
import { format, parseISO } from 'date-fns';
import type { JournalEntry, JournalData, TradeDirection } from './types';

// Consistent column order for CSV reliability
const CSV_COLUMN_ORDER: (keyof JournalEntry | 'accountName' | 'initialBalance')[] = [
  'accountName', 
  'initialBalance',
  'id', 
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
  'screenshot', 
  'notes', 
  'disciplineRating', 
  'emotionalState', 
  'session', 
  'reasonForEntry', 
  'reasonForExit'
];

const serializeCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export function exportJournalDataToCSV(data: JournalData): void {
  const { accountName, initialBalance, entries } = data;

  const headerString = CSV_COLUMN_ORDER.join(',');
  
  const rows = entries.map(entry => {
    // Ensure data for CSV export uses consistent fields, even if some are redundant per row
    const entryDataForCSV: Record<string, any> = {
      accountName, // Include accountName for each row for potential re-import context
      initialBalance, // Include initialBalance for context
      ...entry,
      date: entry.date instanceof Date ? format(entry.date, 'yyyy-MM-dd') : String(entry.date), // Format date
      screenshot: entry.screenshot && entry.screenshot.startsWith('data:image') ? 'has_screenshot_base64' : (entry.screenshot || ''),
    };
    return CSV_COLUMN_ORDER.map(header => serializeCSVValue(entryDataForCSV[header])).join(',');
  });

  const csvContent = [headerString, ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    // Make filename more robust and descriptive
    const filenameSafeAccountName = accountName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `${filenameSafeAccountName}_journal_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Helper to parse a CSV row, handling quoted fields
function parseCSVRow(rowString: string): string[] {
  const values = [];
  let currentVal = '';
  let inQuotes = false;
  for (let i = 0; i < rowString.length; i++) {
    const char = rowString[i];
    if (char === '"') {
      // Check for escaped quote
      if (inQuotes && i + 1 < rowString.length && rowString[i+1] === '"') {
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
  values.push(currentVal); // Add the last value
  return values.map(v => v.trim());
}


export function importJournalDataFromCSV(csvString: string): JournalData | null {
  try {
    const lines = csvString.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 1) return null; // Need at least a header

    const headerLine = lines[0];
    // Trim quotes from headers if present, e.g. "Header Name" -> Header Name
    const headers = parseCSVRow(headerLine).map(h => h.replace(/^"|"$/g, '').trim() as keyof JournalEntry | 'accountName' | 'initialBalance');
    
    // Create a map of expected column names to their index in the CSV
    const colIndices: Partial<Record<keyof JournalEntry | 'accountName' | 'initialBalance', number>> = {};
    CSV_COLUMN_ORDER.forEach(colName => {
        const index = headers.indexOf(colName);
        if (index !== -1) {
            colIndices[colName] = index;
        }
    });

    let accountName = "Imported Account"; // Default
    let initialBalance = 0; // Default
    const entries: Omit<JournalEntry, 'id'>[] = []; // For import, we omit ID as Firestore will generate it

    // Try to get accountName and initialBalance from the first data row if available
    // This assumes these values are consistent across the CSV or primarily taken from the first entry.
    if (lines.length > 1 && colIndices.accountName !== undefined && colIndices.initialBalance !== undefined) {
        const firstDataRowValues = parseCSVRow(lines[1]);
        const parsedAccountName = firstDataRowValues[colIndices.accountName!];
        if (parsedAccountName) accountName = parsedAccountName;
        
        const parsedInitialBalance = parseFloat(firstDataRowValues[colIndices.initialBalance!]);
        if (!isNaN(parsedInitialBalance)) initialBalance = parsedInitialBalance;
    }
    
    const dataRows = lines.slice(1); // Skip header for entry processing

    for (const line of dataRows) {
      const values = parseCSVRow(line);
      // Ensure row has enough columns based on headers
      if (values.length < headers.length) {
        console.warn(`Skipping malformed row: Expected at least ${headers.length} values, got ${values.length}. Row: ${line}`);
        continue;
      }

      const entry: Partial<Omit<JournalEntry, 'id'>> = {};

      // Iterate over the KNOWN column order to populate the entry object
      (Object.keys(colIndices) as Array<keyof typeof colIndices>).forEach(key => {
        if (key === 'id') return; // Skip ID for new entries

        const index = colIndices[key]!; // We know this index exists from the setup
        const value = values[index];

        // Handle undefined or empty strings as 'undefined' for optional fields
        if (value === '' || value === 'N/A' || value === undefined) {
          (entry as any)[key] = undefined;
          return;
        }
        
        switch (key) {
          case 'date': 
            // Attempt to parse date; default to now if invalid, with a warning
            const parsedDate = parseISO(value); // date-fns function
            if (!isNaN(parsedDate.getTime())) {
                 entry.date = parsedDate;
            } else {
                entry.date = new Date(); // Fallback
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
            else entry.disciplineRating = 3; // Default if invalid
            break;
          case 'rrr': entry.rrr = value; break;
          case 'screenshot':
            // If it says 'has_screenshot_base64', it means there was one, but we don't re-import the base64.
            // User would need to re-upload. Otherwise, it's a URL or path.
            entry.screenshot = value === 'has_screenshot_base64' ? 'Screenshot was present (re-upload if needed from original source)' : (value || undefined);
            break;
          case 'notes': entry.notes = value; break;
          case 'emotionalState': entry.emotionalState = value; break;
          case 'session': entry.session = value; break;
          case 'reasonForEntry': entry.reasonForEntry = value; break;
          case 'reasonForExit': entry.reasonForExit = value; break;
          // 'accountName' and 'initialBalance' are handled for the JournalData object, not individual entries
          case 'accountName': break;
          case 'initialBalance': break;
          default:
            // This ensures type safety if a key is in JournalEntry but not explicitly handled above.
            // It might be an error or an oversight.
            // (entry as any)[key] = value; 
            break;
        }
      });
      
      // Basic validation for essential fields before adding to the list
      if (entry.date && entry.time && entry.direction && entry.market && entry.accountBalanceAtEntry !== undefined && entry.disciplineRating) {
         entries.push(entry as Omit<JournalEntry, 'id'>);
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
