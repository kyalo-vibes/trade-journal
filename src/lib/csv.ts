
import { format, parseISO, isValid } from 'date-fns';
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
    const entryDataForCSV: Record<string, any> = {
      accountName, 
      initialBalance, 
      ...entry,
      date: entry.date instanceof Date && isValid(entry.date) ? format(entry.date, 'yyyy-MM-dd') : String(entry.date),
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
    const filenameSafeAccountName = accountName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'journal';
    link.setAttribute('download', `${filenameSafeAccountName}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function parseCSVRow(rowString: string): string[] {
  const values = [];
  let currentVal = '';
  let inQuotes = false;
  for (let i = 0; i < rowString.length; i++) {
    const char = rowString[i];
    if (char === '"') {
      if (inQuotes && i + 1 < rowString.length && rowString[i+1] === '"') {
        currentVal += '"';
        i++; 
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
  values.push(currentVal); 
  return values.map(v => v.trim());
}


export function importJournalDataFromCSV(csvString: string): JournalData | null {
  try {
    const lines = csvString.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 1) return null; 

    const headerLine = lines[0];
    const headers = parseCSVRow(headerLine).map(h => h.replace(/^"|"$/g, '').trim() as keyof JournalEntry | 'accountName' | 'initialBalance');
    
    const colIndices: Partial<Record<keyof JournalEntry | 'accountName' | 'initialBalance', number>> = {};
    CSV_COLUMN_ORDER.forEach(colName => {
        const index = headers.indexOf(colName);
        if (index !== -1) {
            colIndices[colName] = index;
        }
    });

    // Default values, will be overridden by CSV if present
    let accountName = "Imported Account"; 
    let initialBalance = 0; 
    const importedEntries: Omit<JournalEntry, 'id'>[] = []; 

    // Account Name and Initial Balance are expected to be consistent or taken from the first data row
    if (lines.length > 1) {
        const firstDataRowValues = parseCSVRow(lines[1]);
        if (colIndices.accountName !== undefined && firstDataRowValues[colIndices.accountName!] !== undefined) {
            const parsedAccountName = firstDataRowValues[colIndices.accountName!];
            if (parsedAccountName) accountName = parsedAccountName;
        }
        if (colIndices.initialBalance !== undefined && firstDataRowValues[colIndices.initialBalance!] !== undefined) {
            const parsedInitialBalance = parseFloat(firstDataRowValues[colIndices.initialBalance!]);
            if (!isNaN(parsedInitialBalance)) initialBalance = parsedInitialBalance;
        }
    }
    
    const dataRows = lines.slice(1); 

    for (const line of dataRows) {
      const values = parseCSVRow(line);
      if (values.length < headers.length && values.every(v => v === '')) { // Skip completely empty parsed rows
          continue;
      }
      if (values.length < headers.length && values.length < CSV_COLUMN_ORDER.filter(c => colIndices[c] !== undefined).length / 2 ) { // Heuristic for malformed row
        console.warn(`Skipping malformed row: Expected at least ${headers.length} values, got ${values.length}. Row: ${line}`);
        continue;
      }

      const entry: Partial<JournalEntry> = {}; // ID will be handled later if needed

      (Object.keys(colIndices) as Array<keyof typeof colIndices>).forEach(key => {
        const index = colIndices[key]!;
        const value = values[index];

        if (value === '' || value === 'N/A' || value === undefined || value === null) {
          (entry as any)[key] = undefined;
          return;
        }
        
        switch (key) {
          case 'id': entry.id = value; break; // Keep ID if present
          case 'date': 
            const parsedDate = parseISO(value);
            if (isValid(parsedDate)) {
                 entry.date = parsedDate;
            } else {
                entry.date = new Date(); 
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
            const numVal = parseFloat(value);
            (entry as any)[key] = isNaN(numVal) ? undefined : numVal;
            break;
          case 'disciplineRating':
            const rating = parseInt(value, 10);
            if (rating >= 1 && rating <= 5) entry.disciplineRating = rating as 1 | 2 | 3 | 4 | 5;
            else entry.disciplineRating = 3; 
            break;
          case 'rrr': entry.rrr = value; break;
          case 'screenshot':
            entry.screenshot = value === 'has_screenshot_base64' ? 'Screenshot was present (re-upload from original if needed)' : (value || undefined);
            break;
          case 'notes': entry.notes = value; break;
          case 'emotionalState': entry.emotionalState = value; break;
          case 'session': entry.session = value; break;
          case 'reasonForEntry': entry.reasonForEntry = value; break;
          case 'reasonForExit': entry.reasonForExit = value; break;
          case 'accountName': break; 
          case 'initialBalance': break;
          default:
            break;
        }
      });
      
      if (entry.date && entry.time && entry.direction && entry.market && entry.accountBalanceAtEntry !== undefined && entry.disciplineRating) {
         // ID is handled by caller if needed (e.g. nanoid if entry.id is undefined)
         importedEntries.push(entry as Omit<JournalEntry, 'id'>); 
      } else {
        console.warn("Skipping row due to missing required fields or parse errors. Parsed data:", entry, "Original line:", line);
      }
    }
    
    if (importedEntries.length === 0 && dataRows.length > 0) {
        console.warn("CSV imported, but no valid journal entries parsed. Check CSV format and content.");
    }

    return { accountName, initialBalance, entries: importedEntries };

  } catch (error) {
    console.error("Error importing CSV:", error);
    return null;
  }
}
