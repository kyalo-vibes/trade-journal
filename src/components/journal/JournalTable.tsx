
"use client";

import React, { useState } from 'react';
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
import { TrendingUp, TrendingDown, Ban, Edit, Clock, Landmark, Image as ImageIcon, Download, ZoomIn, ZoomOut, MinusCircle, PlusCircle } from 'lucide-react';
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog"
import NextImage from 'next/image'; // Renamed to avoid conflict with Lucide icon

interface JournalTableProps {
  entries: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
}

const DirectionIcon = ({ direction }: { direction: JournalEntry['direction'] }) => {
  if (direction === 'Long') return <TrendingUp className="h-4 w-4 text-positive" />;
  if (direction === 'Short') return <TrendingDown className="h-4 w-4 text-negative" />;
  if (direction === 'Withdrawal') return <Landmark className="h-4 w-4 text-orange-500" />;
  if (direction === 'Deposit') return <Landmark className="h-4 w-4 text-sky-500" />;
  return <Ban className="h-4 w-4 text-muted-foreground" />;
};

const getExtensionFromMimeType = (dataUri: string): string => {
  const mimeTypeMatch = dataUri.match(/^data:(image\/[^;]+);base64,/);
  if (!mimeTypeMatch || !mimeTypeMatch[1]) return 'png'; // Default
  const parts = mimeTypeMatch[1].split('/');
  return parts[1] || 'png';
};


export function JournalTable({ entries, onEdit }: JournalTableProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleDownloadImage = () => {
    if (selectedImage) {
      const link = document.createElement('a');
      link.href = selectedImage;
      const extension = getExtensionFromMimeType(selectedImage);
      link.download = `screenshot.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 3)); // Max zoom 3x
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.2)); // Min zoom 0.2x
  
  const closeDialog = () => {
    setSelectedImage(null);
    setZoomLevel(1); // Reset zoom when dialog closes
  }


  if (entries.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No journal entries yet. Add one using the form or import a CSV!</p>;
  }

  return (
    <>
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
                  badgeVariant = 'secondary'; 
                  badgeClasses = 'bg-orange-500/20 text-orange-600 border-orange-500/50 hover:bg-orange-500/30';
              } else if (entry.direction === 'Deposit') {
                  badgeVariant = 'secondary'; 
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
                    <Button variant="ghost" size="sm" onClick={() => setSelectedImage(entry.screenshot!)} className="text-primary hover:underline flex items-center text-sm p-1 h-auto">
                        View <ImageIcon className="ml-1 h-3.5 w-3.5" />
                    </Button>
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

      <Dialog open={!!selectedImage} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] max-h-[90vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Screenshot Viewer</DialogTitle>
            <DialogDescription>
              Viewing attached document/image. Use controls to zoom or download.
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="flex-grow mt-4 overflow-auto rounded-md border bg-muted/30 flex items-center justify-center">
              <NextImage 
                src={selectedImage} 
                alt="Journal Entry Screenshot" 
                width={1200} 
                height={800} 
                style={{ 
                    objectFit: 'contain', 
                    transform: `scale(${zoomLevel})`, 
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out',
                    maxWidth: '100%',
                    maxHeight: '100%',
                 }}
                className="rounded-md"
                data-ai-hint="chart graph document"
              />
            </div>
          )}
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomLevel <= 0.2}>
                    <ZoomOut className="mr-1.5 h-4 w-4" /> Zoom Out
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomLevel >= 3}>
                    <ZoomIn className="mr-1.5 h-4 w-4" /> Zoom In
                </Button>
                 <Button type="button" variant="outline" size="sm" onClick={() => setZoomLevel(1)} disabled={zoomLevel === 1}>
                    Reset Zoom
                </Button>
            </div>
            <div className="flex gap-2">
                <Button type="button" variant="default" size="sm" onClick={handleDownloadImage} disabled={!selectedImage}>
                    <Download className="mr-1.5 h-4 w-4" /> Download
                </Button>
                <DialogClose asChild>
                <Button type="button" variant="secondary" size="sm">
                    Close
                </Button>
                </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

    