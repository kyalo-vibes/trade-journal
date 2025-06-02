
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
import { TrendingUp, TrendingDown, Ban, ExternalLink, Edit } from 'lucide-react';
import { cn } from "@/lib/utils"


interface JournalTableProps {
  entries: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
}

const DirectionIcon = ({ direction }: { direction: JournalEntry['direction'] }) => {
  if (direction === 'Long') return <TrendingUp className="h-5 w-5 text-positive" />;
  if (direction === 'Short') return <TrendingDown className="h-5 w-5 text-negative" />;
  return <Ban className="h-5 w-5 text-muted-foreground" />;
};


export function JournalTable({ entries, onEdit }: JournalTableProps) {
  if (entries.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No journal entries yet. Add one using the form above!</p>;
  }

  return (
    <ScrollArea className="whitespace-nowrap rounded-md border border-border shadow-lg">
      <Table className="min-w-full bg-card">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-headline text-foreground w-[100px]">Actions</TableHead>
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
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => onEdit(entry)} className="font-headline">
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
              </TableCell>
              <TableCell>{entry.date instanceof Date ? format(entry.date, 'yyyy-MM-dd') : String(entry.date)}</TableCell>
              <TableCell>{entry.time}</TableCell>
              <TableCell>
                <Badge variant={entry.direction === 'No Trade' ? 'outline' : entry.direction === 'Long' ? 'default' : 'destructive'} 
                       className={cn(
                         'flex items-center',
                         entry.direction === 'Long' && 'bg-positive/20 text-positive border-positive/50 hover:bg-positive/30',
                         entry.direction === 'Short' && 'bg-negative/20 text-negative border-negative/50 hover:bg-negative/30',
                         entry.direction === 'No Trade' && 'bg-muted text-muted-foreground border-muted-foreground/50 hover:bg-muted/80'
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
                {entry.pl?.toFixed(2) ?? (entry.direction === "No Trade" ? "N/A" : <span className="italic text-xs text-muted-foreground">Ongoing</span>) }
              </TableCell>
              <TableCell className="text-right">{entry.accountBalanceAtEntry.toFixed(2)}</TableCell>
              <TableCell>
                {entry.screenshot && entry.screenshot.startsWith('data:image') ? (
                  <a 
                    href={entry.screenshot} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline flex items-center"
                  >
                    View <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                ) : entry.screenshot ? (
                  <span className="text-muted-foreground italic text-xs">Ref: {entry.screenshot}</span>
                ) : (
                  'N/A'
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate whitespace-normal" title={entry.notes}>{entry.notes ?? 'N/A'}</TableCell>
              <TableCell className="text-center">{entry.disciplineRating}/5</TableCell>
              <TableCell className="max-w-[150px] truncate whitespace-normal" title={entry.emotionalState}>{entry.emotionalState ?? 'N/A'}</TableCell>
              <TableCell>{entry.session ?? 'N/A'}</TableCell>
              <TableCell className="max-w-[200px] truncate whitespace-normal" title={entry.reasonForEntry}>{entry.reasonForEntry ?? 'N/A'}</TableCell>
              <TableCell className="max-w-[200px] truncate whitespace-normal" title={entry.reasonForExit}>{entry.reasonForExit ?? 'N/A'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
    