
"use client";

import React, { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation'; // Keep for router.refresh if needed, but Firestore updates often handle UI changes
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

import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';


const ACCOUNT_ID = "default_account"; // This will be the document ID in Firestore 'accounts' collection

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
  const [isPending, startTransition] = useTransition();

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter(); // For manual refresh if absolutely needed

  // Fetch account data
  useEffect(() => {
    setIsLoadingAccount(true);
    const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
    const unsubscribe = onSnapshot(accountDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAccountName(data.name || 'Demo Account');
        setInitialBalance(data.initialBalance || 10000);
      } else {
        // Create default account if it doesn't exist
        setDoc(accountDocRef, { name: 'Demo Account', initialBalance: 10000 })
          .catch(error => console.error("Error creating default account:", error));
      }
      setIsLoadingAccount(false);
    }, (error) => {
      console.error("Error fetching account data:", error);
      toast({ title: "Error", description: "Could not load account data.", variant: "destructive" });
      setIsLoadingAccount(false);
    });
    return () => unsubscribe();
  }, [toast]);

  // Fetch journal entries
  useEffect(() => {
    setIsLoadingEntries(true);
    const entriesCollectionRef = collection(db, "accounts", ACCOUNT_ID, "entries");
    const q = query(entriesCollectionRef, orderBy("date", "asc"), orderBy("time", "asc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entries: JournalEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          ...data,
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
  }, [toast]);
  
  // Calculate current balance and balance for new entry
  useEffect(() => {
    const totalPL = journalEntries.reduce((sum, entry) => sum + (entry.pl || 0), 0);
    setCurrentBalance(initialBalance + totalPL);

    if (journalEntries.length > 0) {
        const lastEntry = journalEntries[journalEntries.length - 1];
        if (lastEntry && lastEntry.accountBalanceAtEntry !== undefined && lastEntry.pl !== undefined) {
            setAccountBalanceForNewEntry(lastEntry.accountBalanceAtEntry + (lastEntry.pl || 0));
        } else if (lastEntry && lastEntry.accountBalanceAtEntry !== undefined) {
            setAccountBalanceForNewEntry(lastEntry.accountBalanceAtEntry);
        } else {
            setAccountBalanceForNewEntry(initialBalance + totalPL);
        }
    } else {
        setAccountBalanceForNewEntry(initialBalance);
    }
  }, [initialBalance, journalEntries]);


  const handleAccountNameChange = async (newName: string) => {
    // Optimistic update of local state for responsiveness
    setAccountName(newName); 
    startTransition(async () => {
      const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
      try {
        await setDoc(accountDocRef, { name: newName, initialBalance }, { merge: true });
        // No need to refresh, onSnapshot will update if needed elsewhere
      } catch (error) {
        console.error("Error updating account name:", error);
        toast({ title: "Error", description: "Could not save account name.", variant: "destructive" });
        // Revert optimistic update could be done here by re-fetching, but onSnapshot might handle it
      }
    });
  };

  const handleInitialBalanceChange = async (newBalance: number) => {
    // Optimistic update
    setInitialBalance(newBalance);
    startTransition(async () => {
      const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
      try {
        await setDoc(accountDocRef, { name: accountName, initialBalance: newBalance }, { merge: true });
      } catch (error) {
        console.error("Error updating initial balance:", error);
        toast({ title: "Error", description: "Could not save initial balance.", variant: "destructive" });
      }
    });
  };

  const handleAddEntry = useCallback(async (newEntryData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'>) => {
    const rrr = calculateRRR(newEntryData.direction, newEntryData.entryPrice, newEntryData.slPrice, newEntryData.tpPrice);
    
    const entryToSave = {
      ...newEntryData,
      date: Timestamp.fromDate(newEntryData.date), // Convert JS Date to Firestore Timestamp
      accountBalanceAtEntry: accountBalanceForNewEntry,
      rrr: rrr,
    };

    startTransition(async () => {
      try {
        const entriesCollectionRef = collection(db, "accounts", ACCOUNT_ID, "entries");
        await addDoc(entriesCollectionRef, entryToSave);
        toast({ title: "Entry Added", description: `Trade for ${newEntryData.market} logged successfully.` });
        // No router.refresh() needed, onSnapshot handles updates
      } catch (error) {
        console.error("Error adding entry:", error);
        toast({ title: "Error", description: "Could not save entry.", variant: "destructive" });
      }
    });
  }, [accountBalanceForNewEntry, toast, accountName, initialBalance]); // Added accountName, initialBalance as they are part of the closure

  const handleExportCSV = async () => {
    if (journalEntries.length === 0) {
      toast({ title: "Export Failed", description: "No entries to export.", variant: "destructive" });
      return;
    }
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
              const accountDocRef = doc(db, "accounts", ACCOUNT_ID);
              await setDoc(accountDocRef, { name: importedData.accountName, initialBalance: importedData.initialBalance }, { merge: true });
              
              const entriesCollectionRef = collection(db, "accounts", ACCOUNT_ID, "entries");
              const batch = writeBatch(db);

              // Clear existing entries (optional: could merge or ask user)
              const existingEntriesSnapshot = await getDocs(entriesCollectionRef);
              existingEntriesSnapshot.forEach(doc => batch.delete(doc.ref));

              importedData.entries.forEach(entry => {
                const newEntryRef = doc(entriesCollectionRef); // Auto-generate ID
                const entryDataForFirestore = {
                  ...entry,
                  date: Timestamp.fromDate(entry.date), // Convert to Firestore Timestamp
                };
                delete (entryDataForFirestore as any).id; // Firestore generates ID
                batch.set(newEntryRef, entryDataForFirestore);
              });

              await batch.commit();
              toast({ title: "Import Successful", description: "Journal data imported." });
              // onSnapshot will update UI
            } catch (error) {
              console.error("Error importing data to Firestore:", error);
              toast({ title: "Import Failed", description: "Could not save imported data to Firestore.", variant: "destructive" });
            }
          });
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

  const refreshDataManually = () => {
    // This is less critical with onSnapshot but can be a failsafe or for user-initiated refresh.
    // You might not need this if onSnapshot is reliable.
    // For a true "re-fetch" you might re-trigger the useEffects, but that's complex.
    // router.refresh() might not work as expected without Server Components data fetching.
    // For now, this button can be a placebo or removed if onSnapshot is sufficient.
    toast({ title: "Data Synced", description: "Real-time updates are active."});
  }

  if (isLoadingAccount || isLoadingEntries) { 
    return (
      <div className="container mx-auto p-4 md:p-8 font-body flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading journal data from Firestore...</p>
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
         <Button onClick={refreshDataManually} variant="outline" size="icon" title="Refresh Data" disabled={isPending}>
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
                    onChange={(e) => setAccountName(e.target.value)} 
                    onBlur={(e) => handleAccountNameChange(e.target.value)} 
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
                    onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                    onBlur={(e) => handleInitialBalanceChange(parseFloat(e.target.value) || 0)}
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
