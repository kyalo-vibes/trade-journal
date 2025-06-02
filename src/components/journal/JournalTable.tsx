
"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { JournalEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Ban, ExternalLink, Edit, Clock, Hash, Briefcase, Landmark } from 'lucide-react';
import { cn } from "@/lib/utils"


interface JournalTableProps {
  entries: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
}

const DirectionIcon = ({ direction }: { direction: JournalEntry['direction'] }) => {
  if (direction === 'Long') return <TrendingUp className="h-4 w-4 text-positive" />;
  if (direction === 'Short') return <TrendingDown className="h-4 w-4 text-negative" />;
  if (direction === 'Withdrawal') return <Landmark className="h-4 w-4 text-orange-500" />; // Using Landmark for Withdrawal
  if (direction === 'Deposit') return <Landmark className="h-4 w-4 text-sky-500" />;    // Using Landmark for Deposit
  return <Ban className="h-4 w-4 text-muted-foreground" />;
};


export function JournalTable({ entries, onEdit }: JournalTableProps) {
  if (entries.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No journal entries yet. Add one using the form or import a CSV!</p>;
  }

  return (
    <ScrollArea className="whitespace-nowrap rounded-md border border-border shadow-lg bg-card">
      <Table className="min-w-full">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-headline text-foreground sticky left-0 bg-muted/50 z-10 w-[100px] px-2 py-3">Actions</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3 w-[80px]">#</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3">Date</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3">Time</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3">Type/Direction</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3">Market/Asset</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">Entry Price</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">SL Price</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">TP Price</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">Exit Price</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">Pos. Size</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">RRR</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">Amount/P&L ($)</TableHead>
            <TableHead className="font-headline text-foreground text-right px-3 py-3">Balance ($)</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3">Document</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3 min-w-[200px] max-w-[300px]">Notes</TableHead>
            <TableHead className="font-headline text-foreground text-center px-3 py-3">Discipline</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3 min-w-[150px] max-w-[250px]">Emotion</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3">Session</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3 min-w-[200px] max-w-[300px]">Reason</TableHead>
            <TableHead className="font-headline text-foreground px-3 py-3 min-w-[200px] max-w-[300px]">Reason (Exit)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => {
            const isTrade = entry.direction === "Long" || entry.direction === "Short";
            const isTransaction = entry.direction === "Withdrawal" || entry.direction === "Deposit";
            const isNoTrade = entry.direction === "No Trade";

            let badgeVariant: "default" | "destructive" | "outline" | "secondary" = "outline";
            let badgeClasses = "";
            if (entry.direction === 'Long') {
                badgeVariant = 'default';
                badgeClasses = 'bg-positive/20 text-positive border-positive/50 hover:bg-positive/30';
            } else if (entry.direction === 'Short') {
                badgeVariant = 'destructive';
                badgeClasses = 'bg-negative/20 text-negative border-negative/50 hover:bg-negative/30';
            } else if (entry.direction === 'Withdrawal') {
                badgeVariant = 'secondary'; // Or a custom variant
                badgeClasses = 'bg-orange-500/20 text-orange-600 border-orange-500/50 hover:bg-orange-500/30';
            } else if (entry.direction === 'Deposit') {
                badgeVariant = 'secondary'; // Or a custom variant
                badgeClasses = 'bg-sky-500/20 text-sky-600 border-sky-500/50 hover:bg-sky-500/30';
            } else if (entry.direction === 'No Trade') {
                badgeVariant = 'outline';
                badgeClasses = 'bg-muted text-muted-foreground border-muted-foreground/50 hover:bg-muted/80';
            }

            return (
            <TableRow key={entry.id} className="hover:bg-muted/80 group">
              <TableCell className="sticky left-0 bg-card group-hover:bg-muted/80 z-10 px-2 py-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(entry)} className="font-headline h-8">
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              </TableCell>
              <TableCell className="px-3 py-2 text-center">{index + 1}</TableCell>
              <TableCell className="px-3 py-2">{entry.date instanceof Date ? format(entry.date, 'yyyy-MM-dd') : String(entry.date)}</TableCell>
              <TableCell className="px-3 py-2">{entry.time}</TableCell>
              <TableCell className="px-3 py-2">
                <Badge 
                       variant={badgeVariant}
                       className={cn('flex items-center text-xs py-0.5 px-2', badgeClasses)}
                >
                  <DirectionIcon direction={entry.direction} />
                  <span className="ml-1.5">{entry.direction}</span>
                </Badge>
              </TableCell>
              <TableCell className="px-3 py-2">{entry.market}</TableCell>
              <TableCell className="text-right px-3 py-2">{isTrade ? entry.entryPrice?.toFixed(4) ?? 'N/A' : 'N/A'}</TableCell>
              <TableCell className="text-right px-3 py-2">{isTrade ? entry.slPrice?.toFixed(4) ?? 'N/A' : 'N/A'}</TableCell>
              <TableCell className="text-right px-3 py-2">{isTrade ? entry.tpPrice?.toFixed(4) ?? 'N/A' : 'N/A'}</TableCell>
              <TableCell className="text-right px-3 py-2">{isTrade ? entry.actualExitPrice?.toFixed(4) ?? <Clock className="h-4 w-4 inline-block text-muted-foreground" title="Ongoing trade"/> : 'N/A'}</TableCell>
              <TableCell className="text-right px-3 py-2">{isTrade ? entry.positionSize ?? 'N/A' : 'N/A'}</TableCell>
              <TableCell className="text-right px-3 py-2">{isTrade ? entry.rrr ?? 'N/A' : 'N/A'}</TableCell>
              <TableCell className={cn(
                "text-right font-semibold px-3 py-2",
                entry.pl !== undefined ? (entry.pl >= 0 ? 'text-positive' : 'text-negative') : '',
                isTransaction && entry.pl !== undefined ? (entry.pl > 0 ? 'text-sky-600' : 'text-orange-600') : ''
              )}>
                {entry.pl?.toFixed(2) ?? (isTrade ? <Clock className="h-4 w-4 inline-block text-muted-foreground" title="Ongoing trade"/> : "N/A") }
              </TableCell>
              <TableCell className="text-right px-3 py-2">{entry.accountBalanceAtEntry.toFixed(2)}</TableCell>
              <TableCell className="px-3 py-2">
                {entry.screenshot && entry.screenshot.startsWith('data:image') ? (
                  <a 
                    href={entry.screenshot} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline flex items-center text-sm"
                  >
                    View <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                ) : entry.screenshot ? (
                  <span className="text-muted-foreground italic text-xs">Ref: {entry.screenshot}</span>
                ) : (
                  'N/A'
                )}
              </TableCell>
              <TableCell className="px-3 py-2 min-w-[200px] max-w-[300px] whitespace-normal text-xs" title={entry.notes}>{entry.notes || 'N/A'}</TableCell>
              <TableCell className="text-center px-3 py-2">{isTrade || isNoTrade ? `${entry.disciplineRating}/5` : 'N/A'}</TableCell>
              <TableCell className="px-3 py-2 min-w-[150px] max-w-[250px] whitespace-normal text-xs" title={entry.emotionalState}>{entry.emotionalState || 'N/A'}</TableCell>
              <TableCell className="px-3 py-2">{entry.session ?? 'N/A'}</TableCell>
              <TableCell className="px-3 py-2 min-w-[200px] max-w-[300px] whitespace-normal text-xs" title={entry.reasonForEntry}>{entry.reasonForEntry || 'N/A'}</TableCell>
              <TableCell className="px-3 py-2 min-w-[200px] max-w-[300px] whitespace-normal text-xs" title={entry.reasonForExit}>{isTrade || isNoTrade ? entry.reasonForExit || 'N/A' : 'N/A'}</TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
      {entries.length > 0 && <ScrollBar orientation="vertical" />}
    </ScrollArea>
  );
}
