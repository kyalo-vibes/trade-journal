
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { JournalEntryForm } from '@/components/journal/JournalEntryForm';
import { JournalTable } from '@/components/journal/JournalTable';
import type { JournalEntry, JournalData } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportJournalDataToCSV, importJournalDataFromCSV } from '@/lib/csv';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, UploadCloud, DollarSign, ListChecks, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const ACCOUNT_ID = "default_account"; // Using a fixed account ID for now

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
  
  const [isLoadingAccount, setIsLoadingAccount] = useState<boolean>(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState<boolean>(true);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch and subscribe to account details
  useEffect(() => {
    if (!db) return;
    setIsLoadingAccount(true);
    const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
    const unsubscribe = onSnapshot(accountDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAccountName(data.name || 'Demo Account');
        setInitialBalance(data.initialBalance || 10000);
      } else {
        // Account doesn't exist, create it with default values
        setDoc(accountDocRef, { name: 'Demo Account', initialBalance: 10000 })
          .then(() => console.log("Default account created"))
          .catch(error => console.error("Error creating default account:", error));
      }
      setIsLoadingAccount(false);
    }, (error) => {
      console.error("Error fetching account details:", error);
      toast({ title: "Error", description: "Could not load account details.", variant: "destructive" });
      setIsLoadingAccount(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch and subscribe to journal entries
  useEffect(() => {
    if (!db) return;
    setIsLoadingEntries(true);
    const entriesColRef = collection(db, "accounts", ACCOUNT_ID, "entries");
    const q = query(entriesColRef, orderBy("date", "asc")); // Order by date

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entries: JournalEntry[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        entries.push({
          ...data,
          id: docSnap.id,
          date: (data.date as Timestamp).toDate(), // Convert Firestore Timestamp to JS Date
        } as JournalEntry);
      });
      setJournalEntries(entries);
      setIsLoadingEntries(false);
    }, (error) => {
      console.error("Error fetching journal entries:", error);
      toast({ title: "Error", description: "Could not load journal entries.", variant: "destructive" });
      setIsLoadingEntries(false);
    });
    return () => unsubscribe();
  }, []);

  // Update account details in Firestore when local state changes
  const handleAccountNameChange = async (newName: string) => {
    setAccountName(newName);
    if (!db) return;
    const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
    try {
      await setDoc(accountDocRef, { name: newName }, { merge: true });
    } catch (error) {
      console.error("Error updating account name:", error);
      toast({ title: "Error", description: "Could not save account name.", variant: "destructive" });
    }
  };

  const handleInitialBalanceChange = async (newBalance: number) => {
    setInitialBalance(newBalance);
    if (!db) return;
    const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
    try {
      await setDoc(accountDocRef, { initialBalance: newBalance }, { merge: true });
    } catch (error) {
      console.error("Error updating initial balance:", error);
      toast({ title: "Error", description: "Could not save initial balance.", variant: "destructive" });
    }
  };
  
  useEffect(() => {
    const totalPL = journalEntries.reduce((sum, entry) => sum + (entry.pl || 0), 0);
    setCurrentBalance(initialBalance + totalPL);

    if (journalEntries.length > 0) {
        const lastEntryWithBalance = [...journalEntries].reverse().find(entry => entry.accountBalanceAtEntry !== undefined && entry.pl !== undefined);
        if (lastEntryWithBalance) {
            setAccountBalanceForNewEntry(lastEntryWithBalance.accountBalanceAtEntry + (lastEntryWithBalance.pl || 0));
        } else {
            setAccountBalanceForNewEntry(initialBalance);
        }
    } else {
        setAccountBalanceForNewEntry(initialBalance);
    }
  }, [initialBalance, journalEntries]);

  const handleAddEntry = useCallback(async (newEntryData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'>) => {
    if (!db) {
      toast({ title: "Error", description: "Database not connected.", variant: "destructive" });
      return;
    }
    const rrr = calculateRRR(newEntryData.direction, newEntryData.entryPrice, newEntryData.slPrice, newEntryData.tpPrice);
    
    const entryToSave = {
      ...newEntryData,
      accountBalanceAtEntry: accountBalanceForNewEntry,
      rrr: rrr,
      date: Timestamp.fromDate(newEntryData.date), // Convert JS Date to Firestore Timestamp for saving
    };

    try {
      const entriesColRef = collection(db, "accounts", ACCOUNT_ID, "entries");
      await addDoc(entriesColRef, entryToSave);
      toast({ title: "Entry Added", description: `Trade for ${newEntryData.market} logged successfully.` });
    } catch (error) {
      console.error("Error adding entry to Firestore:", error);
      toast({ title: "Error", description: "Could not save entry.", variant: "destructive" });
    }
  }, [accountBalanceForNewEntry, toast]);

  const handleExportCSV = () => {
    if (journalEntries.length === 0) {
      toast({ title: "Export Failed", description: "No entries to export.", variant: "destructive" });
      return;
    }
    // Ensure date is JS Date for CSV export, though it's already converted from Firestore
    const entriesForExport = journalEntries.map(e => ({...e, date: new Date(e.date)}));
    exportJournalDataToCSV({ accountName, initialBalance, entries: entriesForExport });
    toast({ title: "Export Successful", description: "Journal data exported to CSV." });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && db) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvString = e.target?.result as string;
        const importedData = importJournalDataFromCSV(csvString);
        
        if (importedData) {
          setIsLoadingAccount(true);
          setIsLoadingEntries(true);
          const batch = writeBatch(db);
          const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
          
          // Update account details
          batch.set(accountDocRef, { 
            name: importedData.accountName, 
            initialBalance: importedData.initialBalance 
          }, { merge: true });

          // Clear existing entries before importing new ones for simplicity
          // More complex merging could be implemented if needed
          const entriesColRef = collection(db, "accounts", ACCOUNT_ID, "entries");
          const existingEntriesSnapshot = await getDocs(entriesColRef);
          existingEntriesSnapshot.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
          
          // Add imported entries
          importedData.entries.forEach(entry => {
            const { id, ...entryData } = entry; // Firestore will generate new IDs
            const newEntryRef = doc(collection(db, "accounts", ACCOUNT_ID, "entries"));
            batch.set(newEntryRef, {
              ...entryData,
              date: Timestamp.fromDate(new Date(entry.date)), // Ensure date is Firestore Timestamp
            });
          });

          try {
            await batch.commit();
            setAccountName(importedData.accountName); // Update local state after successful Firestore update
            setInitialBalance(importedData.initialBalance);
            // Entries will be updated by onSnapshot listener
            toast({ title: "Import Successful", description: "Journal data imported and saved to Firestore." });
          } catch (error) {
            console.error("Error importing data to Firestore:", error);
            toast({ title: "Import Failed", description: "Could not save imported data to Firestore.", variant: "destructive" });
          } finally {
            setIsLoadingAccount(false); // Let onSnapshot handle final state
            setIsLoadingEntries(false);
          }
        } else {
          toast({ title: "Import Failed", description: "Could not parse CSV file. Please check format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  if (isLoadingAccount || isLoadingEntries) {
    return (
      <div className="container mx-auto p-4 md:p-8 font-body flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading journal data...</p>
      </div>
    );
  }

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
                    onChange={(e) => handleAccountNameChange(e.target.value)}
                    className="mt-1 bg-muted border-border focus:ring-primary font-headline text-lg"
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
