"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { JournalEntryForm } from '@/components/journal/JournalEntryForm';
import { JournalTable } from '@/components/journal/JournalTable';
import type { JournalEntry, JournalData } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportJournalDataToCSV, importJournalDataFromCSV } from '@/lib/csv';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, UploadCloud, DollarSign, Edit3, ListChecks } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedData = localStorage.getItem('tradingJournalData');
    if (storedData) {
      try {
        const parsedData: JournalData = JSON.parse(storedData);
        // Ensure dates are Date objects
        parsedData.entries = parsedData.entries.map(entry => ({
          ...entry,
          date: new Date(entry.date) 
        }));
        setAccountName(parsedData.accountName);
        setInitialBalance(parsedData.initialBalance);
        setJournalEntries(parsedData.entries);
      } catch (error) {
        console.error("Failed to parse stored journal data:", error);
        localStorage.removeItem('tradingJournalData'); // Clear corrupted data
      }
    }
  }, []);
  
  useEffect(() => {
    const dataToStore: JournalData = { accountName, initialBalance, entries: journalEntries };
    localStorage.setItem('tradingJournalData', JSON.stringify(dataToStore));
  }, [accountName, initialBalance, journalEntries]);


  useEffect(() => {
    const totalPL = journalEntries.reduce((sum, entry) => sum + (entry.pl || 0), 0);
    setCurrentBalance(initialBalance + totalPL);

    if (journalEntries.length > 0) {
        const lastEntry = journalEntries[journalEntries.length - 1];
        setAccountBalanceForNewEntry(lastEntry.accountBalanceAtEntry + (lastEntry.pl || 0));
    } else {
        setAccountBalanceForNewEntry(initialBalance);
    }
  }, [initialBalance, journalEntries]);

  const handleAddEntry = useCallback((newEntryData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'>) => {
    const rrr = calculateRRR(newEntryData.direction, newEntryData.entryPrice, newEntryData.slPrice, newEntryData.tpPrice);
    
    const entryWithFullDetails: JournalEntry = {
      ...newEntryData,
      id: crypto.randomUUID(),
      accountBalanceAtEntry: accountBalanceForNewEntry,
      rrr: rrr,
    };
    setJournalEntries(prevEntries => [...prevEntries, entryWithFullDetails]);
    toast({ title: "Entry Added", description: `Trade for ${newEntryData.market} logged successfully.` });
  }, [accountBalanceForNewEntry, toast]);

  const handleExportCSV = () => {
    if (journalEntries.length === 0) {
      toast({ title: "Export Failed", description: "No entries to export.", variant: "destructive" });
      return;
    }
    exportJournalDataToCSV({ accountName, initialBalance, entries: journalEntries });
    toast({ title: "Export Successful", description: "Journal data exported to CSV." });
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvString = e.target?.result as string;
        const importedData = importJournalDataFromCSV(csvString);
        if (importedData) {
          // Ensure dates are Date objects after import
          importedData.entries = importedData.entries.map(entry => ({
            ...entry,
            date: new Date(entry.date) 
          }));
          setAccountName(importedData.accountName);
          setInitialBalance(importedData.initialBalance);
          setJournalEntries(importedData.entries);
          toast({ title: "Import Successful", description: "Journal data imported from CSV." });
        } else {
          toast({ title: "Import Failed", description: "Could not parse CSV file. Please check format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
    // Reset file input to allow importing the same file again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 font-body">
      <header className="mb-8">
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-2">My Trading Journal</h1>
        <p className="text-muted-foreground text-lg">Track your trades, analyze performance, and gain insights.</p>
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
                    onChange={(e) => setAccountName(e.target.value)}
                    className="mt-1 bg-muted border-border focus:ring-primary font-headline text-lg"
                />
                </div>
                <div>
                <Label htmlFor="initialBalance" className="font-headline text-sm">Initial Balance ($)</Label>
                <Input
                    id="initialBalance"
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                    className="mt-1 bg-muted border-border focus:ring-primary text-lg"
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
        <JournalEntryForm onSubmit={handleAddEntry} accountBalanceAtFormInit={accountBalanceForNewEntry} />
      </section>
      
      <Separator className="my-12" />

      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="font-headline text-3xl text-primary flex items-center"><ListChecks className="mr-3 h-7 w-7" />Journal Entries</h2>
          <div className="flex space-x-3">
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="font-headline">
              <UploadCloud className="mr-2 h-5 w-5" /> Import CSV
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
            <Button onClick={handleExportCSV} variant="default" className="font-headline bg-primary hover:bg-primary/90 text-primary-foreground">
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
