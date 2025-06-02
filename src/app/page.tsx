
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
import { Download, UploadCloud, DollarSign, ListChecks, Loader2, TrendingUp, TrendingDown, Percent, Hash, Landmark } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';

const calculateRRR = (direction?: JournalEntry['direction'], entryPrice?: number, slPrice?: number, tpPrice?: number): string => {
  if (!direction || !['Long', 'Short'].includes(direction) || entryPrice === undefined || slPrice === undefined || tpPrice === undefined) return "N/A";
  
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
  const [accountName, setAccountName] = useState<string>('Default Account');
  const [initialBalance, setInitialBalance] = useState<number>(10000);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  
  const [currentBalance, setCurrentBalance] = useState<number>(initialBalance);
  const [accountBalanceForNewEntry, setAccountBalanceForNewEntry] = useState<number>(initialBalance);
  
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Stats
  const [tradePL, setTradePL] = useState<number>(0); // P/L from Long/Short trades only
  const [netAccountMovement, setNetAccountMovement] = useState<number>(0); // Total change including deposits/withdrawals
  const [numberOfActualTrades, setNumberOfActualTrades] = useState<number>(0);
  const [accountPercentageChange, setAccountPercentageChange] = useState<number>(0); // Based on netAccountMovement
  const [winRate, setWinRate] = useState<number>(0);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const journalFormComponentRef = useRef<{ resetForm: () => void }>(null);
  const formSectionRef = useRef<HTMLElement>(null);

  const areAccountDetailsLocked = journalEntries.length > 0;

  useEffect(() => {
    const calculatedTradePL = journalEntries
      .filter(entry => entry.direction === 'Long' || entry.direction === 'Short')
      .reduce((sum, entry) => sum + (entry.pl || 0), 0);
    setTradePL(calculatedTradePL);

    const calculatedNetAccountMovement = journalEntries.reduce((sum, entry) => sum + (entry.pl || 0), 0);
    setNetAccountMovement(calculatedNetAccountMovement);

    const newCurrentBalance = initialBalance + calculatedNetAccountMovement;
    setCurrentBalance(newCurrentBalance);
    setAccountBalanceForNewEntry(newCurrentBalance);

    const actualTrades = journalEntries.filter(entry => entry.direction === 'Long' || entry.direction === 'Short');
    setNumberOfActualTrades(actualTrades.length);

    if (initialBalance > 0 && initialBalance !== 0) {
      setAccountPercentageChange((calculatedNetAccountMovement / initialBalance) * 100);
    } else if (calculatedNetAccountMovement > 0) {
      setAccountPercentageChange(100); 
    } else {
      setAccountPercentageChange(0);
    }

    if (actualTrades.length > 0) {
      const winningTrades = actualTrades.filter(entry => (entry.pl || 0) > 0).length;
      setWinRate((winningTrades / actualTrades.length) * 100);
    } else {
      setWinRate(0);
    }

  }, [initialBalance, journalEntries]);


  const handleAccountNameChange = (newName: string) => {
    if (!areAccountDetailsLocked) {
      setAccountName(newName); 
    }
  };

  const handleInitialBalanceChange = (newBalance: number) => {
     if (!areAccountDetailsLocked) {
      setInitialBalance(newBalance);
    }
  };

  const handleSaveEntry = useCallback((entryData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'> | JournalEntry) => {
    startTransition(() => {
      let newEntries;
      if ('id' in entryData && entryData.id) { 
        const rrr = calculateRRR(entryData.direction, entryData.entryPrice, entryData.slPrice, entryData.tpPrice);
        const updatedEntry = { ...entryData, rrr };
        newEntries = journalEntries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
        toast({ title: "Entry Updated", description: `${updatedEntry.market} entry has been updated.` });
        setEditingEntry(null); 
      } else { 
        const rrr = calculateRRR(entryData.direction, entryData.entryPrice, entryData.slPrice, entryData.tpPrice);
        const newEntry: JournalEntry = {
          id: nanoid(), 
          ...entryData,
          date: entryData.date instanceof Date ? entryData.date : new Date(entryData.date), // Ensure it's a Date object
          accountBalanceAtEntry: accountBalanceForNewEntry,
          rrr: rrr,
        } as JournalEntry; 
        newEntries = [...journalEntries, newEntry];
        toast({ title: "Entry Added", description: `${newEntry.market} entry logged.` });
      }
      // Sort entries by date and then by time
      newEntries.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        const dateComparison = dateA.getTime() - dateB.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.time.localeCompare(b.time);
      });
      setJournalEntries(newEntries);
      journalFormComponentRef.current?.resetForm();
    });
  }, [accountBalanceForNewEntry, toast, journalEntries]); 

  const handleSetEditingEntry = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    if (formSectionRef.current) {
      window.scrollTo({ top: formSectionRef.current.offsetTop - 20, behavior: 'smooth' });
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEntry(null);
    journalFormComponentRef.current?.resetForm();
  }, []);


  const handleExportCSV = () => {
    if (journalEntries.length === 0 && accountName === 'Default Account' && initialBalance === 10000) {
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
              const entriesWithIdsAndDateObjects = importedData.entries.map(entry => ({
                ...entry,
                id: entry.id || nanoid(), 
                date: entry.date instanceof Date ? entry.date : new Date(entry.date) // Ensure date is a Date object
              })).sort((a,b) => {
                const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                const dateB = b.date instanceof Date ? b.date : new Date(b.date);
                const dateComparison = dateA.getTime() - dateB.getTime();
                if (dateComparison !== 0) return dateComparison;
                return a.time.localeCompare(b.time);
              });
              setJournalEntries(entriesWithIdsAndDateObjects as JournalEntry[]);
              toast({ title: "Import Successful", description: "Journal data loaded from CSV." });
              setEditingEntry(null); 
              journalFormComponentRef.current?.resetForm();
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
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-2">Trade Insights</h1>
          <p className="text-muted-foreground text-lg">Your Local Trading Journal. Data managed via CSV files.</p>
        </div>
      </header>

      <Card className="mb-8 bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center"><DollarSign className="mr-2 h-6 w-6 text-primary" />Account Overview</CardTitle>
          <CardDescription>Manage your account details. {areAccountDetailsLocked ? "Account Name and Initial Balance are locked after the first entry." : "Changes are saved when you export to CSV."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div>
                  <Label htmlFor="accountName" className="font-headline text-sm">Account Name</Label>
                  <Input
                      id="accountName"
                      type="text"
                      value={accountName}
                      onChange={(e) => handleAccountNameChange(e.target.value)} 
                      className="mt-1 bg-muted border-border focus:ring-primary font-headline text-lg"
                      disabled={isPending || isProcessingFile || areAccountDetailsLocked}
                      title={areAccountDetailsLocked ? "Account Name is locked after entries are added." : "Enter account name"}
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
                      disabled={isPending || isProcessingFile || areAccountDetailsLocked}
                      title={areAccountDetailsLocked ? "Initial Balance is locked after entries are added." : "Enter initial account balance"}
                  />
                </div>
                <div>
                  <Label className="font-headline text-sm block">Current Balance ($)</Label>
                  <p className="text-3xl font-bold font-headline mt-1 text-primary">
                      {currentBalance.toFixed(2)}
                  </p>
                </div>
            </div>
            <Separator className="my-4"/>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="bg-muted p-3 rounded-md">
                <Label className="font-headline text-xs text-muted-foreground flex items-center"><Hash className="mr-1 h-3 w-3"/>Total Actual Trades</Label>
                <p className="font-bold text-lg font-headline">{numberOfActualTrades}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <Label className="font-headline text-xs text-muted-foreground flex items-center">
                  {(tradePL >= 0) ? <TrendingUp className="mr-1 h-3 w-3 text-positive"/> : <TrendingDown className="mr-1 h-3 w-3 text-negative"/>}
                  Trade P/L ($)
                </Label>
                <p className={`font-bold text-lg font-headline ${tradePL >= 0 ? 'text-positive' : 'text-negative'}`}>{tradePL.toFixed(2)}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <Label className="font-headline text-xs text-muted-foreground flex items-center">
                  {(netAccountMovement >= 0) ? <Landmark className="mr-1 h-3 w-3 text-positive"/> : <Landmark className="mr-1 h-3 w-3 text-negative"/>}
                  Net Account Movement ($)
                </Label>
                <p className={`font-bold text-lg font-headline ${netAccountMovement >= 0 ? 'text-positive' : 'text-negative'}`}>{netAccountMovement.toFixed(2)}</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <Label className="font-headline text-xs text-muted-foreground flex items-center">
                 {(accountPercentageChange >= 0) ? <TrendingUp className="mr-1 h-3 w-3 text-positive"/> : <TrendingDown className="mr-1 h-3 w-3 text-negative"/>}
                  Account Change
                </Label>
                <p className={`font-bold text-lg font-headline ${accountPercentageChange >= 0 ? 'text-positive' : 'text-negative'}`}>{accountPercentageChange.toFixed(2)}%</p>
              </div>
              <div className="bg-muted p-3 rounded-md">
                <Label className="font-headline text-xs text-muted-foreground flex items-center">
                  {(winRate >= 0) ? <TrendingUp className="mr-1 h-3 w-3 text-positive"/> : <TrendingDown className="mr-1 h-3 w-3 text-negative"/>}
                  Win Rate
                  </Label>
                <p className={`font-bold text-lg font-headline ${winRate >= 0 ? 'text-positive' : 'text-negative'}`}>{winRate.toFixed(2)}%</p>
              </div>
            </div>
        </CardContent>
      </Card>
      
      <Separator className="my-12" />

      <section className="mb-12" ref={formSectionRef}>
        <JournalEntryForm 
          ref={journalFormComponentRef}
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
              <UploadCloud className="mr-2 h-5 w-5" /> Import CSV
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
            <Button onClick={handleExportCSV} variant="default" className="font-headline bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isPending || isProcessingFile}>
              <Download className="mr-2 h-5 w-5" /> Export to CSV
            </Button>
          </div>
        </div>
        <JournalTable entries={journalEntries} onEdit={handleSetEditingEntry} />
      </section>

      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Trade Insights. Data is managed locally via CSV files.</p>
      </footer>
    </div>
  );
}
