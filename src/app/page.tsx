
"use client";

import React, { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import type { JournalEntry, JournalData } from '@/lib/types';
import { JournalEntryForm } from '@/components/journal/JournalEntryForm';
import { JournalTable } from '@/components/journal/JournalTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportJournalDataToCSV, importJournalDataFromCSV } from '@/lib/csv';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, UploadCloud, DollarSign, ListChecks, Loader2, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { nanoid } from 'nanoid';

const calculateRRR = (direction?: JournalEntry['direction'], entryPrice?: number, slPrice?: number, tpPrice?: number): string => {
  if (!direction || direction === 'No Trade' || entryPrice === undefined || slPrice === undefined || tpPrice === undefined) return "N/A";
  
  const entry = Number(entryPrice);
  const sl = Number(slPrice);
  const tp = Number(tpPrice);

  if (isNaN(entry) || isNaN(sl) || isNaN(tp)) return "N/A";

  let risk: number, reward: number;

  if (direction === "Long") {
    if (entry <= sl || tp <= entry) return "Invalid";
    risk = entry - sl;
    reward = tp - entry;
  } else if (direction === "Short") {
    if (entry >= sl || tp >= entry) return "Invalid";
    risk = sl - entry;
    reward = entry - tp;
  } else {
    return "N/A";
  }

  if (risk <= 0) return "Invalid Risk";
  return (reward / risk).toFixed(2) + ":1";
};


export default function TradingJournalPage() {
  const [accountName, setAccountName] = useState<string>('Demo Account');
  const [initialBalance, setInitialBalance] = useState<number>(10000);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(initialBalance);
  const [accountBalanceForNewEntry, setAccountBalanceForNewEntry] = useState<number>(initialBalance);
  
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const journalFormRef = useRef<{ resetForm: () => void }>(null);


  useEffect(() => {
    const totalPL = journalEntries.reduce((sum, entry) => sum + (entry.pl || 0), 0);
    const newCurrentBalance = initialBalance + totalPL;
    setCurrentBalance(newCurrentBalance);

    if (journalEntries.length > 0) {
        const lastEntryWithPL = [...journalEntries].reverse().find(entry => entry.pl !== undefined);
        if (lastEntryWithPL) {
            setAccountBalanceForNewEntry(lastEntryWithPL.accountBalanceAtEntry + (lastEntryWithPL.pl || 0));
        } else {
            // If no entries have P/L, use the initial balance plus P/L of all entries (which would be 0 if no P/L)
            // Or more simply, the current balance, which already accounts for this.
            setAccountBalanceForNewEntry(newCurrentBalance);
        }
    } else {
        setAccountBalanceForNewEntry(initialBalance);
    }
  }, [initialBalance, journalEntries]);


  const handleAccountNameChange = (newName: string) => {
    setAccountName(newName); 
  };

  const handleInitialBalanceChange = (newBalance: number) => {
    setInitialBalance(newBalance);
  };

  const handleSaveEntry = useCallback((entryData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'> | JournalEntry) => {
    startTransition(() => {
      if ('id' in entryData) { // Editing existing entry
        const rrr = calculateRRR(entryData.direction, entryData.entryPrice, entryData.slPrice, entryData.tpPrice);
        const updatedEntry = { ...entryData, rrr };
        setJournalEntries(prevEntries => prevEntries.map(e => e.id === updatedEntry.id ? updatedEntry : e));
        toast({ title: "Entry Updated", description: `Trade for ${updatedEntry.market} has been updated.` });
        setEditingEntry(null); // Clear editing state
      } else { // Adding new entry
        const rrr = calculateRRR(entryData.direction, entryData.entryPrice, entryData.slPrice, entryData.tpPrice);
        const entryToAdd: JournalEntry = {
          id: nanoid(),
          ...entryData,
          accountBalanceAtEntry: accountBalanceForNewEntry, // Use calculated balance for new entries
          rrr: rrr,
        };
        setJournalEntries(prevEntries => [...prevEntries, entryToAdd]);
        toast({ title: "Entry Added", description: `Trade for ${entryData.market} logged.` });
      }
      journalFormRef.current?.resetForm();
    });
  }, [accountBalanceForNewEntry, toast, journalEntries]);

  const handleSetEditingEntry = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    window.scrollTo({ top: journalFormRef.current ? (journalFormRef.current as any).offsetTop - 20 : 0, behavior: 'smooth' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
    journalFormRef.current?.resetForm();
  }, []);


  const handleExportCSV = () => {
    if (journalEntries.length === 0 && accountName === 'Demo Account' && initialBalance === 10000) {
      toast({ title: "Export Skipped", description: "No custom data to export.", variant: "default" });
      return;
    }
    setIsProcessingFile(true);
    startTransition(() => {
      try {
        exportJournalDataToCSV({ accountName, initialBalance, entries: journalEntries });
        toast({ title: "Export Successful", description: "Journal data exported to CSV." });
      } catch (error) {
        console.error("Error exporting CSV:", error);
        toast({ title: "Export Failed", description: "Could not generate CSV file.", variant: "destructive" });
      } finally {
        setIsProcessingFile(false);
      }
    });
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsProcessingFile(true);
      startTransition(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const csvString = e.target?.result as string;
            const importedData = importJournalDataFromCSV(csvString);
            
            if (importedData) {
              setAccountName(importedData.accountName);
              setInitialBalance(importedData.initialBalance);
              const entriesWithIds = importedData.entries.map(entry => ({
                ...entry,
                id: entry.id || nanoid(), 
              }));
              setJournalEntries(entriesWithIds as JournalEntry[]);
              toast({ title: "Import Successful", description: "Journal data loaded from CSV." });
              setEditingEntry(null); // Clear any editing state
              journalFormRef.current?.resetForm();
            } else {
              toast({ title: "Import Failed", description: "Could not parse CSV file. Please check format.", variant: "destructive" });
            }
          } catch (error) {
            console.error("Error processing imported CSV:", error);
            toast({ title: "Import Error", description: "An error occurred while processing the CSV.", variant: "destructive" });
          } finally {
            setIsProcessingFile(false);
          }
        };
        reader.onerror = () => {
            toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
            setIsProcessingFile(false);
        }
        reader.readAsText(file);
      });
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
  };

  if (isProcessingFile && !isPending) { 
    return (
      <div className="container mx-auto p-4 md:p-8 font-body flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Processing file...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 font-body">
       {(isPending || isProcessingFile) && (
        <div className="fixed top-4 right-4 z-50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-2">My Trading Journal</h1>
          <p className="text-muted-foreground text-lg">Track your trades locally. Import/Export via CSV.</p>
        </div>
      </header>

      <Card className="mb-8 bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center"><DollarSign className="mr-2 h-6 w-6 text-primary" />Account Overview</CardTitle>
          <CardDescription>Account details are loaded from/saved to CSV. Edits are in-memory until next export.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                <Label htmlFor="accountName" className="font-headline text-sm">Account Name</Label>
                <Input
                    id="accountName"
                    type="text"
                    value={accountName}
                    onChange={(e) => handleAccountNameChange(e.target.value)} 
                    className="mt-1 bg-muted border-border focus:ring-primary font-headline text-lg"
                    disabled={isPending || isProcessingFile}
                />
                </div>
                <div>
                <Label htmlFor="initialBalance" className="font-headline text-sm">Initial Balance ($)</Label>
                <Input
                    id="initialBalance"
                    type="number"
                    value={initialBalance}
                    onChange={(e) => handleInitialBalanceChange(parseFloat(e.target.value) || 0)}
                    className="mt-1 bg-muted border-border focus:ring-primary text-lg"
                    disabled={isPending || isProcessingFile}
                />
                </div>
                <div>
                <Label className="font-headline text-sm block">Current Balance ($)</Label>
                <p className="text-3xl font-bold font-headline mt-1 text-primary">
                    {currentBalance.toFixed(2)}
                </p>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Separator className="my-12" />

      <section className="mb-12" ref={journalFormRef as any}>
        <JournalEntryForm 
          onSave={handleSaveEntry} 
          accountBalanceAtFormInit={editingEntry ? editingEntry.accountBalanceAtEntry : accountBalanceForNewEntry} 
          disabled={isPending || isProcessingFile}
          entryToEdit={editingEntry}
          onCancelEdit={handleCancelEdit}
        />
      </section>
      
      <Separator className="my-12" />

      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="font-headline text-3xl text-primary flex items-center"><ListChecks className="mr-3 h-7 w-7" />Journal Entries</h2>
          <div className="flex space-x-3">
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="font-headline" disabled={isPending || isProcessingFile}>
              <UploadCloud className="mr-2 h-5 w-5" /> Import CSV to Load
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
            <Button onClick={handleExportCSV} variant="default" className="font-headline bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isPending || isProcessingFile}>
              <Download className="mr-2 h-5 w-5" /> Export to CSV to Save
            </Button>
          </div>
        </div>
        <JournalTable entries={journalEntries} onEdit={handleSetEditingEntry} />
      </section>

      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Trade Insights. Data is managed via CSV files.</p>
      </footer>
    </div>
  );
}
    