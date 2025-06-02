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
import { format } from 'date-fns';
import Image from 'next/image';
import { TrendingUp, TrendingDown, Ban } from 'lucide-react';

interface JournalTableProps {
  entries: JournalEntry[];
}

const DirectionIcon = ({ direction }: { direction: JournalEntry['direction'] }) => {
  if (direction === 'Long') return <TrendingUp className="h-5 w-5 text-positive" />;
  if (direction === 'Short') return <TrendingDown className="h-5 w-5 text-negative" />;
  return <Ban className="h-5 w-5 text-muted-foreground" />;
};


export function JournalTable({ entries }: JournalTableProps) {
  if (entries.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No journal entries yet. Add one using the form above!</p>;
  }

  return (
    <ScrollArea className="whitespace-nowrap rounded-md border border-border shadow-lg">
      <Table className="min-w-full bg-card">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-headline text-foreground">Date</TableHead>
            <TableHead className="font-headline text-foreground">Time</TableHead>
            <TableHead className="font-headline text-foreground">Direction</TableHead>
            <TableHead className="font-headline text-foreground">Market</TableHead>
            <TableHead className="font-headline text-foreground text-right">Entry Price</TableHead>
            <TableHead className="font-headline text-foreground text-right">SL Price</TableHead>
            <TableHead className="font-headline text-foreground text-right">TP Price</TableHead>
            <TableHead className="font-headline text-foreground text-right">Exit Price</TableHead>
            <TableHead className="font-headline text-foreground text-right">Pos. Size</TableHead>
            <TableHead className="font-headline text-foreground text-right">RRR</TableHead>
            <TableHead className="font-headline text-foreground text-right">P/L ($)</TableHead>
            <TableHead className="font-headline text-foreground text-right">Balance ($)</TableHead>
            <TableHead className="font-headline text-foreground">Screenshot</TableHead>
            <TableHead className="font-headline text-foreground">Notes</TableHead>
            <TableHead className="font-headline text-foreground text-center">Discipline</TableHead>
            <TableHead className="font-headline text-foreground">Emotion</TableHead>
            <TableHead className="font-headline text-foreground">Session</TableHead>
            <TableHead className="font-headline text-foreground">Reason (Entry)</TableHead>
            <TableHead className="font-headline text-foreground">Reason (Exit/NoTrade)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} className="hover:bg-muted/80">
              <TableCell>{format(new Date(entry.date), 'yyyy-MM-dd')}</TableCell>
              <TableCell>{entry.time}</TableCell>
              <TableCell>
                <Badge variant={entry.direction === 'No Trade' ? 'outline' : entry.direction === 'Long' ? 'default' : 'destructive'} 
                       className={cn(
                         entry.direction === 'Long' && 'bg-positive/20 text-positive border-positive/50',
                         entry.direction === 'Short' && 'bg-negative/20 text-negative border-negative/50',
                         entry.direction === 'No Trade' && 'bg-muted text-muted-foreground'
                       )}
                >
                  <DirectionIcon direction={entry.direction} />
                  <span className="ml-2">{entry.direction}</span>
                </Badge>
              </TableCell>
              <TableCell>{entry.market}</TableCell>
              <TableCell className="text-right">{entry.entryPrice?.toFixed(4) ?? 'N/A'}</TableCell>
              <TableCell className="text-right">{entry.slPrice?.toFixed(4) ?? 'N/A'}</TableCell>
              <TableCell className="text-right">{entry.tpPrice?.toFixed(4) ?? 'N/A'}</TableCell>
              <TableCell className="text-right">{entry.actualExitPrice?.toFixed(4) ?? 'N/A'}</TableCell>
              <TableCell className="text-right">{entry.positionSize ?? 'N/A'}</TableCell>
              <TableCell className="text-right">{entry.rrr ?? 'N/A'}</TableCell>
              <TableCell className={cn(
                "text-right font-semibold",
                entry.pl !== undefined ? (entry.pl >= 0 ? 'text-positive' : 'text-negative') : ''
              )}>
                {entry.pl?.toFixed(2) ?? 'N/A'}
              </TableCell>
              <TableCell className="text-right">{entry.accountBalanceAtEntry.toFixed(2)}</TableCell>
              <TableCell>
                {entry.screenshot ? (
                  <a href={entry.screenshot} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View
                  </a>
                ) : (
                  'N/A'
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate" title={entry.notes}>{entry.notes ?? 'N/A'}</TableCell>
              <TableCell className="text-center">{entry.disciplineRating}/5</TableCell>
              <TableCell className="max-w-xs truncate" title={entry.emotionalState}>{entry.emotionalState ?? 'N/A'}</TableCell>
              <TableCell>{entry.session ?? 'N/A'}</TableCell>
              <TableCell className="max-w-xs truncate" title={entry.reasonForEntry}>{entry.reasonForEntry ?? 'N/A'}</TableCell>
              <TableCell className="max-w-xs truncate" title={entry.reasonForExit}>{entry.reasonForExit ?? 'N/A'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
