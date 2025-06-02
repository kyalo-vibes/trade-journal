
import { format, parseISO, isValid } from 'date-fns';
import type { JournalEntry, JournalData, TradeDirection } from './types';
import { nanoid } from 'nanoid';

// Consistent column order for CSV reliability
const CSV_COLUMN_ORDER: (keyof JournalEntry | 'accountName' | 'initialBalance' | 'tradeNumber')[] = [
  'tradeNumber', 
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
  'pl', // This is Amount for Withdrawal/Deposit
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
  
  const rows = entries.map((entry, index) => {
    const entryDataForCSV: Record<string, any> = {
      tradeNumber: index + 1,
      accountName, 
      initialBalance, 
      ...entry,
      date: entry.date instanceof Date && isValid(entry.date) ? format(entry.date, 'yyyy-MM-dd') : String(entry.date),
      // Store the full Base64 data URI for the screenshot if it exists
      screenshot: entry.screenshot || '', 
    };
    
    if (entry.direction === 'Withdrawal' || entry.direction === 'Deposit') {
        entryDataForCSV.entryPrice = '';
        entryDataForCSV.positionSize = '';
        entryDataForCSV.slPrice = '';
        entryDataForCSV.tpPrice = '';
        entryDataForCSV.actualExitPrice = '';
        entryDataForCSV.rrr = '';
        entryDataForCSV.reasonForExit = '';
    }

    return CSV_COLUMN_ORDER.map(header => serializeCSVValue(entryDataForCSV[header])).join(',');
  });

  const csvContent = [headerString, ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filenameSafeAccountName = accountName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'journal';
    link.setAttribute('download', `${filenameSafeAccountName}_journal.csv`);
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
    const headers = parseCSVRow(headerLine).map(h => h.replace(/^"|"$/g, '').trim() as keyof JournalEntry | 'accountName' | 'initialBalance' | 'tradeNumber');
    
    const colIndices: Partial<Record<keyof JournalEntry | 'accountName' | 'initialBalance' | 'tradeNumber', number>> = {};
    CSV_COLUMN_ORDER.forEach(colName => {
        const index = headers.indexOf(colName);
        if (index !== -1) {
            colIndices[colName] = index;
        }
    });

    let accountName = "Imported Account"; 
    let initialBalance = 0; 
    const importedEntries: JournalEntry[] = []; 

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
      if (values.length < headers.length && values.every(v => v === '')) { 
          continue;
      }
      if (values.length < CSV_COLUMN_ORDER.filter(c => colIndices[c] !== undefined).length * 0.5 ) { 
        console.warn(`Skipping malformed row: Expected relevant columns, got too few. Row: ${line}`);
        continue;
      }

      const entry: Partial<JournalEntry> & { id?: string } = {}; // Allow id to be undefined initially

      (Object.keys(colIndices) as Array<keyof typeof colIndices>).forEach(key => {
        const index = colIndices[key]!;
        if (index === undefined || values[index] === undefined) return;
        
        const value = values[index];

        if (value === '' || value === 'N/A' || value === null) {
          (entry as any)[key] = undefined;
          return;
        }
        
        switch (key) {
          case 'id': entry.id = value; break;
          case 'date': 
            const parsedDate = parseISO(value);
            entry.date = isValid(parsedDate) ? parsedDate : new Date(); 
            if (!isValid(parsedDate)) console.warn(`Invalid date format for row: ${value}. Using current date.`);
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
            entry.disciplineRating = (rating >= 1 && rating <= 5) ? rating as 1 | 2 | 3 | 4 | 5 : 3; 
            break;
          case 'rrr': entry.rrr = value; break;
          case 'screenshot':
            // Directly use the value from CSV, assuming it's a Base64 string or empty
            entry.screenshot = value || undefined; 
            break;
          case 'notes': entry.notes = value; break;
          case 'emotionalState': entry.emotionalState = value; break;
          case 'session': entry.session = value; break;
          case 'reasonForEntry': entry.reasonForEntry = value; break;
          case 'reasonForExit': entry.reasonForExit = value; break;
          case 'accountName': break; 
          case 'initialBalance': break;
          case 'tradeNumber': break; 
          default:
            break;
        }
      });
      
      if (!entry.id) {
        entry.id = nanoid(); // Assign a new ID if one wasn't found in the CSV
      }

      if (entry.date && entry.time && entry.direction && entry.market && entry.accountBalanceAtEntry !== undefined && entry.disciplineRating !== undefined && entry.id) {
         if ((entry.direction === 'Withdrawal' || entry.direction === 'Deposit') && entry.pl === undefined) {
            console.warn("Skipping Withdrawal/Deposit row due to missing amount (P/L field). Parsed data:", entry, "Original line:", line);
         } else {
            importedEntries.push(entry as JournalEntry); 
         }
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

