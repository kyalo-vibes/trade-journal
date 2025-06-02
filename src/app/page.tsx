
"use client";

import React, { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { JournalEntry, JournalData } from '@/lib/types';
import { JournalEntryForm } from '@/components/journal/JournalEntryForm';
import { JournalTable } from '@/components/journal/JournalTable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportJournalDataToCSV, importJournalDataFromCSV } from '@/lib/csv';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, UploadCloud, DollarSign, ListChecks, Loader2, RefreshCcw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// --- Server Actions ---
async function fetchAccountData(accountId: string): Promise<{ name: string; initialBalance: number } | null> {
  'use server';
  const { getAccount } = await import('@/lib/db');
  const account = getAccount(accountId);
  if (account) {
    return { name: account.name, initialBalance: account.initialBalance };
  }
  return null;
}

async function saveAccountDetails(accountId: string, name: string, initialBalance: number): Promise<void> {
  'use server';
  const { updateAccount } = await import('@/lib/db');
  updateAccount(accountId, name, initialBalance);
}

async function fetchJournalEntries(accountId: string): Promise<JournalEntry[]> {
  'use server';
  const { getJournalEntries } = await import('@/lib/db');
  return getJournalEntries(accountId);
}

async function addJournalEntryAction(entryData: Omit<JournalEntry, 'id'>, accountId: string): Promise<string> {
  'use server';
  const { addJournalEntry } = await import('@/lib/db');
  return addJournalEntry(entryData, accountId);
}

async function importJournalDataAction(data: JournalData, accountId: string): Promise<void> {
  'use server';
  const { updateAccount, clearJournalEntries, batchInsertJournalEntries } = await import('@/lib/db');
  updateAccount(accountId, data.accountName, data.initialBalance);
  clearJournalEntries(accountId);
  batchInsertJournalEntries(data.entries, accountId);
}
// --- End Server Actions ---


const ACCOUNT_ID = "default_account";

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
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const accData = await fetchAccountData(ACCOUNT_ID);
      if (accData) {
        setAccountName(accData.name);
        setInitialBalance(accData.initialBalance);
      }
      const entries = await fetchJournalEntries(ACCOUNT_ID);
      setJournalEntries(entries);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Could not load journal data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  useEffect(() => {
    const totalPL = journalEntries.reduce((sum, entry) => sum + (entry.pl || 0), 0);
    setCurrentBalance(initialBalance + totalPL);

    if (journalEntries.length > 0) {
        const lastEntry = journalEntries[journalEntries.length - 1]; // Entries are sorted by date
        if (lastEntry && lastEntry.accountBalanceAtEntry !== undefined && lastEntry.pl !== undefined) {
             // Calculate balance after the last trade
            setAccountBalanceForNewEntry(lastEntry.accountBalanceAtEntry + (lastEntry.pl || 0));
        } else if (lastEntry && lastEntry.accountBalanceAtEntry !== undefined) {
            // If P/L is missing on last trade, use its starting balance
            setAccountBalanceForNewEntry(lastEntry.accountBalanceAtEntry);
        } else {
             // Fallback if last entry has no balance info (should not happen with new structure)
            setAccountBalanceForNewEntry(initialBalance + totalPL);
        }
    } else {
        setAccountBalanceForNewEntry(initialBalance);
    }
  }, [initialBalance, journalEntries]);


  const handleAccountNameChange = async (newName: string) => {
    setAccountName(newName); // Optimistic update
    startTransition(async () => {
      try {
        await saveAccountDetails(ACCOUNT_ID, newName, initialBalance);
        // router.refresh(); // No need to refresh if only name changes and balance display is based on local state
      } catch (error) {
        console.error("Error updating account name:", error);
        toast({ title: "Error", description: "Could not save account name.", variant: "destructive" });
        loadData(); // Revert optimistic update on error
      }
    });
  };

  const handleInitialBalanceChange = async (newBalance: number) => {
    setInitialBalance(newBalance); // Optimistic update
    startTransition(async () => {
      try {
        await saveAccountDetails(ACCOUNT_ID, accountName, newBalance);
        // router.refresh(); // Let useEffect recalculate currentBalance
      } catch (error) {
        console.error("Error updating initial balance:", error);
        toast({ title: "Error", description: "Could not save initial balance.", variant: "destructive" });
        loadData(); // Revert optimistic update
      }
    });
  };

  const handleAddEntry = useCallback(async (newEntryData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'>) => {
    const rrr = calculateRRR(newEntryData.direction, newEntryData.entryPrice, newEntryData.slPrice, newEntryData.tpPrice);
    
    const entryToSave = {
      ...newEntryData,
      accountBalanceAtEntry: accountBalanceForNewEntry,
      rrr: rrr,
    };

    startTransition(async () => {
      try {
        await addJournalEntryAction(entryToSave, ACCOUNT_ID);
        toast({ title: "Entry Added", description: `Trade for ${newEntryData.market} logged successfully.` });
        router.refresh(); // Re-fetch entries and update balances
      } catch (error) {
        console.error("Error adding entry:", error);
        toast({ title: "Error", description: "Could not save entry.", variant: "destructive" });
      }
    });
  }, [accountBalanceForNewEntry, toast, router]);

  const handleExportCSV = async () => {
    if (journalEntries.length === 0) {
      toast({ title: "Export Failed", description: "No entries to export.", variant: "destructive" });
      return;
    }
    // Data for CSV export comes from current state, which should be up-to-date
    exportJournalDataToCSV({ accountName, initialBalance, entries: journalEntries });
    toast({ title: "Export Successful", description: "Journal data exported to CSV." });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvString = e.target?.result as string;
        const importedData = importJournalDataFromCSV(csvString);
        
        if (importedData) {
          startTransition(async () => {
            try {
              await importJournalDataAction(importedData, ACCOUNT_ID);
              toast({ title: "Import Successful", description: "Journal data imported." });
              router.refresh(); // Refresh all data
            } catch (error) {
              console.error("Error importing data:", error);
              toast({ title: "Import Failed", description: "Could not save imported data.", variant: "destructive" });
            }
          });
        } else {
          toast({ title: "Import Failed", description: "Could not parse CSV file. Please check format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
    }
  };

  if (isLoading && !isPending) { // Show main loader only on initial load
    return (
      <div className="container mx-auto p-4 md:p-8 font-body flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading journal data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 font-body">
       {isPending && (
        <div className="fixed top-4 right-4 z-50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-2">My Trading Journal</h1>
          <p className="text-muted-foreground text-lg">Track your trades, analyze performance, and gain insights.</p>
        </div>
        <Button onClick={() => router.refresh()} variant="outline" size="icon" title="Refresh Data" disabled={isPending}>
          <RefreshCcw className={`h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      <Card className="mb-8 bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center"><DollarSign className="mr-2 h-6 w-6 text-primary" />Account Overview</CardTitle>
          <CardDescription>Manage your account details and see your current financial status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                <Label htmlFor="accountName" className="font-headline text-sm">Account Name</Label>
                <Input
                    id="accountName"
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)} // Local state update
                    onBlur={(e) => handleAccountNameChange(e.target.value)} // Persist on blur
                    className="mt-1 bg-muted border-border focus:ring-primary font-headline text-lg"
                    disabled={isPending}
                />
                </div>
                <div>
                <Label htmlFor="initialBalance" className="font-headline text-sm">Initial Balance ($)</Label>
                <Input
                    id="initialBalance"
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)} // Local state update
                    onBlur={(e) => handleInitialBalanceChange(parseFloat(e.target.value) || 0)} // Persist on blur
                    className="mt-1 bg-muted border-border focus:ring-primary text-lg"
                    disabled={isPending}
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

      <section className="mb-12">
        <JournalEntryForm onSubmit={handleAddEntry} accountBalanceAtFormInit={accountBalanceForNewEntry} disabled={isPending} />
      </section>
      
      <Separator className="my-12" />

      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="font-headline text-3xl text-primary flex items-center"><ListChecks className="mr-3 h-7 w-7" />Journal Entries</h2>
          <div className="flex space-x-3">
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="font-headline" disabled={isPending}>
              <UploadCloud className="mr-2 h-5 w-5" /> Import CSV
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
            <Button onClick={handleExportCSV} variant="default" className="font-headline bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isPending || journalEntries.length === 0}>
              <Download className="mr-2 h-5 w-5" /> Export to CSV
            </Button>
          </div>
        </div>
        <JournalTable entries={journalEntries} />
      </section>

      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Trade Insights. Happy Trading!</p>
      </footer>
    </div>
  );
}
