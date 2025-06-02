
import { format, parseISO } from 'date-fns';
import type { JournalEntry, JournalData, TradeDirection } from './types';

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
      date: entry.date instanceof Date ? format(entry.date, 'yyyy-MM-dd') : String(entry.date),
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
    const filenameSafeAccountName = accountName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `${filenameSafeAccountName}_journal_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
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

    let accountName = "Imported Account";
    let initialBalance = 0;
    const entries: Omit<JournalEntry, 'id'>[] = []; // For import, we omit ID as DB will generate it

    if (lines.length > 1 && colIndices.accountName !== undefined && colIndices.initialBalance !== undefined) {
        const firstDataRowValues = parseCSVRow(lines[1]);
        const parsedAccountName = firstDataRowValues[colIndices.accountName!];
        if (parsedAccountName) accountName = parsedAccountName;
        
        const parsedInitialBalance = parseFloat(firstDataRowValues[colIndices.initialBalance!]);
        if (!isNaN(parsedInitialBalance)) initialBalance = parsedInitialBalance;
    }
    
    const dataRows = lines.slice(1);

    for (const line of dataRows) {
      const values = parseCSVRow(line);
      if (values.length < headers.length) {
        console.warn(`Skipping malformed row: Expected at least ${headers.length} values, got ${values.length}. Row: ${line}`);
        continue;
      }

      const entry: Partial<Omit<JournalEntry, 'id'>> = {};

      (Object.keys(colIndices) as Array<keyof typeof colIndices>).forEach(key => {
        if (key === 'id') return; // Skip ID for new entries

        const index = colIndices[key]!;
        const value = values[index];

        if (value === '' || value === 'N/A' || value === undefined) {
          (entry as any)[key] = undefined;
          return;
        }
        
        switch (key) {
          case 'date': 
            const parsedDate = parseISO(value);
            if (!isNaN(parsedDate.getTime())) {
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
            (entry as any)[key] = parseFloat(value);
            break;
          case 'disciplineRating':
            const rating = parseInt(value, 10);
            if (rating >= 1 && rating <= 5) entry.disciplineRating = rating as 1 | 2 | 3 | 4 | 5;
            else entry.disciplineRating = 3;
            break;
          case 'rrr': entry.rrr = value; break;
          case 'screenshot':
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
