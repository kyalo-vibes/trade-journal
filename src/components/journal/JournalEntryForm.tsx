
"use client";

import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import type { JournalEntry, TradeDirection } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit3, XCircle } from 'lucide-react';
import { format } from 'date-fns';


const entrySchema = z.object({
  date: z.date({ required_error: 'Date is required.' }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM).'),
  direction: z.enum(['Long', 'Short', 'No Trade'], { required_error: 'Direction is required.' }),
  market: z.string().min(1, 'Market is required.'),
  entryPrice: z.coerce.number().optional(),
  positionSize: z.coerce.number().optional(),
  slPrice: z.coerce.number().optional(),
  tpPrice: z.coerce.number().optional(),
  actualExitPrice: z.coerce.number().optional(),
  pl: z.coerce.number().optional(),
  screenshot: z.any().optional(),
  notes: z.string().optional(),
  disciplineRating: z.coerce.number().min(1).max(5),
  emotionalState: z.string().optional(),
  session: z.string().optional(),
  reasonForEntry: z.string().optional(),
  reasonForExit: z.string().optional(),
  id: z.string().optional(),
  accountBalanceAtEntry: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
  if (data.direction && data.direction !== 'No Trade') {
    if (data.entryPrice === undefined || data.entryPrice === null || isNaN(data.entryPrice)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Entry Price is required for trades.', path: ['entryPrice'] });
    }
    if (data.slPrice === undefined || data.slPrice === null || isNaN(data.slPrice)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Stop Loss is required for trades.', path: ['slPrice'] });
    }
     if (data.tpPrice === undefined || data.tpPrice === null || isNaN(data.tpPrice)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Take Profit is required for trades.', path: ['tpPrice'] });
    }
    if (data.positionSize === undefined || data.positionSize === null || isNaN(data.positionSize) || data.positionSize <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Position Size must be a positive number for trades.', path: ['positionSize'] });
    }
  }
});

type JournalEntryFormData = z.infer<typeof entrySchema>;

interface JournalEntryFormProps {
  onSave: (data: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'> | JournalEntry) => void;
  accountBalanceAtFormInit: number;
  disabled?: boolean;
  entryToEdit?: JournalEntry | null;
  onCancelEdit?: () => void;
}

const calculateRRR = (direction?: TradeDirection, entryPrice?: number, slPrice?: number, tpPrice?: number): string => {
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
  } else { return "N/A"; }
  if (risk <= 0) return "Invalid Risk";
  return (reward / risk).toFixed(2) + ":1";
};

const getDefaultTime = () => {
    const now = new Date();
    return format(now, 'HH:mm');
};

const marketOptions = [
  'SPX500', 'NASDAQ100', 'DOW30', 
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 
  'BTCUSD', 'ETHUSD', 'SOLUSD', 
  'AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOGL',
  'Gold (XAUUSD)', 'Crude Oil (WTI)', 'Natural Gas',
  'Other Forex', 'Other Crypto', 'Other Stock', 'Other Commodity', 'Other Index'
];


export const JournalEntryForm = forwardRef(({ onSave, accountBalanceAtFormInit, disabled, entryToEdit, onCancelEdit }, ref) => {
  const { control, handleSubmit, watch, reset, setValue, formState: { errors, isDirty } } = useForm<JournalEntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: new Date(),
      time: getDefaultTime(),
      direction: undefined,
      market: '',
      entryPrice: undefined,
      positionSize: undefined,
      slPrice: undefined,
      tpPrice: undefined,
      actualExitPrice: undefined,
      pl: undefined,
      notes: '',
      disciplineRating: 3,
      emotionalState: '',
      session: '',
      reasonForEntry: '',
      reasonForExit: '',
      screenshot: undefined,
    },
  });

  const direction = watch('direction');
  const entryPrice = watch('entryPrice');
  const slPrice = watch('slPrice');
  const tpPrice = watch('tpPrice');
  const actualExitPrice = watch('actualExitPrice');
  const positionSize = watch('positionSize');

  const [rrr, setRrr] = useState<string>("N/A");
  const [estimatedPl, setEstimatedPl] = useState<string>("Estimated P/L: N/A");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  
  const isEditing = !!entryToEdit;

  useImperativeHandle(ref, () => ({
    resetForm: () => {
      reset({
        date: new Date(),
        time: getDefaultTime(),
        direction: undefined,
        market: '',
        entryPrice: undefined,
        positionSize: undefined,
        slPrice: undefined,
        tpPrice: undefined,
        actualExitPrice: undefined,
        pl: undefined,
        notes: '',
        disciplineRating: 3,
        emotionalState: '',
        session: '',
        reasonForEntry: '',
        reasonForExit: '',
        screenshot: undefined,
        // id and accountBalanceAtEntry are not part of form defaults managed by RHF for new entries
      });
      setScreenshotPreview(null);
      setScreenshotName(null);
    }
  }));

  useEffect(() => {
    if (entryToEdit) {
      const defaultTime = entryToEdit.time || getDefaultTime();
      reset({
        ...entryToEdit,
        date: entryToEdit.date ? new Date(entryToEdit.date) : new Date(),
        time: defaultTime,
        entryPrice: entryToEdit.entryPrice ?? undefined,
        positionSize: entryToEdit.positionSize ?? undefined,
        slPrice: entryToEdit.slPrice ?? undefined,
        tpPrice: entryToEdit.tpPrice ?? undefined,
        actualExitPrice: entryToEdit.actualExitPrice ?? undefined,
        pl: entryToEdit.pl ?? undefined,
        accountBalanceAtEntry: entryToEdit.accountBalanceAtEntry, // This is from the entry, not form init
      });
      if (typeof entryToEdit.screenshot === 'string' && entryToEdit.screenshot.startsWith('data:image')) {
        setScreenshotPreview(entryToEdit.screenshot);
        setScreenshotName("Existing screenshot");
      } else {
        setScreenshotPreview(null);
        setScreenshotName(null);
      }
    } else {
      reset({ 
        date: new Date(),
        time: getDefaultTime(),
        direction: undefined,
        market: '',
        entryPrice: undefined,
        positionSize: undefined,
        slPrice: undefined,
        tpPrice: undefined,
        actualExitPrice: undefined,
        pl: undefined,
        notes: '',
        disciplineRating: 3,
        emotionalState: '',
        session: '',
        reasonForEntry: '',
        reasonForExit: '',
        screenshot: undefined,
      });
      setScreenshotPreview(null);
      setScreenshotName(null);
    }
  }, [entryToEdit, reset]);


  useEffect(() => {
    setRrr(calculateRRR(direction, entryPrice, slPrice, tpPrice));
  }, [direction, entryPrice, slPrice, tpPrice]);

  useEffect(() => {
    if (direction && direction !== 'No Trade' && actualExitPrice !== undefined && entryPrice !== undefined && positionSize !== undefined && !isNaN(actualExitPrice) && !isNaN(entryPrice) && !isNaN(positionSize)) {
        const plPoints = direction === 'Long' ? actualExitPrice - entryPrice : entryPrice - actualExitPrice;
        // P/L calculation should reflect the actual currency value if possible, or points value if currency per point is not available
        // For now, if 'pl' field is filled, it's the source of truth. If not, this is an estimate.
        setEstimatedPl(`Points value: ${(plPoints * positionSize).toFixed(2)}. Use P/L field for actual currency value.`);
    } else {
        setEstimatedPl("Estimated P/L: N/A");
    }
  }, [direction, actualExitPrice, entryPrice, positionSize]);

  const isTrade = direction !== 'No Trade';

  const handleFormSubmit = async (data: JournalEntryFormData) => {
    let screenshotData: string | undefined = undefined;
    if (data.screenshot && data.screenshot instanceof FileList && data.screenshot.length > 0) {
      const file = data.screenshot[0];
      screenshotData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } else if (typeof data.screenshot === 'string') { 
        screenshotData = data.screenshot;
    }
    
    const submissionData: Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'> | JournalEntry = {
      ...data,
      date: data.date, 
      pl: data.pl ?? undefined,
      entryPrice: data.entryPrice ?? undefined,
      positionSize: data.positionSize ?? undefined,
      slPrice: data.slPrice ?? undefined,
      tpPrice: data.tpPrice ?? undefined,
      actualExitPrice: data.actualExitPrice ?? undefined,
      screenshot: screenshotData,
    };

    if (isEditing && entryToEdit) {
      onSave({ 
        ...entryToEdit, 
        ...submissionData,
        accountBalanceAtEntry: entryToEdit.accountBalanceAtEntry, // Ensure this is preserved from original
      } as JournalEntry);
    } else {
      // For new entries, id and accountBalanceAtEntry will be set by parent
      const { id, accountBalanceAtEntry, ...newEntryData } = submissionData as JournalEntry; // Cast to access props
      onSave(newEntryData as Omit<JournalEntry, 'id' | 'accountBalanceAtEntry' | 'rrr'>);
    }
  };

  const handleScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue('screenshot', event.target.files, { shouldDirty: true }); 
      setScreenshotName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setValue('screenshot', undefined, { shouldDirty: true });
      setScreenshotPreview(null);
      setScreenshotName(null);
    }
  };
  
  const commonInputClass = "bg-muted border-border focus:ring-primary";
  const commonLabelClass = "mb-1 text-sm font-medium";

  const numericFieldProps = (field: any) => ({ // field can be from Controller render props
    ...field,
    value: field.value === undefined || field.value === null || isNaN(field.value) ? '' : String(field.value),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Allow empty string for clearing, otherwise parse as float
      field.onChange(val === '' ? undefined : parseFloat(val));
    },
  });

  return (
    <Card className="bg-card border-border shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">{isEditing ? "Edit Journal Entry" : "Add New Entry"}</CardTitle>
        {isEditing && entryToEdit && <CardDescription>Editing trade for {entryToEdit.market} on {format(new Date(entryToEdit.date), "PPP")}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <fieldset disabled={disabled} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="date" className={commonLabelClass}>Date</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} className={commonInputClass} />}
                />
                {errors.date && <p className="text-destructive text-xs mt-1">{errors.date.message}</p>}
              </div>

              <div>
                <Label htmlFor="time" className={commonLabelClass}>{isTrade ? 'Time Entered' : 'Time Analyzed'}</Label>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => <Input type="time" id="time" {...field} className={commonInputClass} />}
                />
                {errors.time && <p className="text-destructive text-xs mt-1">{errors.time.message}</p>}
              </div>

              <div>
                <Label htmlFor="direction" className={commonLabelClass}>Direction</Label>
                <Controller
                  name="direction"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <SelectTrigger id="direction" className={commonInputClass}>
                        <SelectValue placeholder="Select direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Long">Long</SelectItem>
                        <SelectItem value="Short">Short</SelectItem>
                        <SelectItem value="No Trade">No Trade</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.direction && <p className="text-destructive text-xs mt-1">{errors.direction.message}</p>}
              </div>

              <div>
                <Label htmlFor="market" className={commonLabelClass}>Market</Label>
                <Controller
                  name="market"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <SelectTrigger id="market" className={commonInputClass}>
                        <SelectValue placeholder="Select market/asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.market && <p className="text-destructive text-xs mt-1">{errors.market.message}</p>}
              </div>


              <div>
                  <Label className={commonLabelClass}>Account Balance (at entry)</Label>
                  <Input value={isEditing && entryToEdit ? entryToEdit.accountBalanceAtEntry.toFixed(2) : accountBalanceAtFormInit.toFixed(2)} readOnly disabled className={`${commonInputClass} opacity-70 cursor-not-allowed`} />
              </div>

              {isTrade && (
                <>
                  <div>
                    <Label htmlFor="entryPrice" className={commonLabelClass}>Entry Price</Label>
                    <Controller
                      name="entryPrice"
                      control={control}
                      render={({ field }) => <Input type="number" step="any" id="entryPrice" {...numericFieldProps(field)} className={commonInputClass} />}
                    />
                    {errors.entryPrice && <p className="text-destructive text-xs mt-1">{errors.entryPrice.message}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="positionSize" className={commonLabelClass}>Position Size / Volume / Lot</Label>
                    <Controller
                      name="positionSize"
                      control={control}
                      render={({ field }) => <Input type="number" step="any" id="positionSize" {...numericFieldProps(field)} className={commonInputClass} />}
                    />
                    {errors.positionSize && <p className="text-destructive text-xs mt-1">{errors.positionSize.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="slPrice" className={commonLabelClass}>Stop Loss (SL) Price</Label>
                    <Controller
                      name="slPrice"
                      control={control}
                      render={({ field }) => <Input type="number" step="any" id="slPrice" {...numericFieldProps(field)} className={commonInputClass} />}
                    />
                    {errors.slPrice && <p className="text-destructive text-xs mt-1">{errors.slPrice.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="tpPrice" className={commonLabelClass}>Take Profit (TP) Price</Label>
                    <Controller
                      name="tpPrice"
                      control={control}
                      render={({ field }) => <Input type="number" step="any" id="tpPrice" {...numericFieldProps(field)} className={commonInputClass} />}
                    />
                    {errors.tpPrice && <p className="text-destructive text-xs mt-1">{errors.tpPrice.message}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="actualExitPrice" className={commonLabelClass}>Actual Exit Price (if closed)</Label>
                    <Controller
                      name="actualExitPrice"
                      control={control}
                      render={({ field }) => <Input type="number" step="any" id="actualExitPrice" {...numericFieldProps(field)} className={commonInputClass} placeholder="Leave blank if ongoing" />}
                    />
                    {errors.actualExitPrice && <p className="text-destructive text-xs mt-1">{errors.actualExitPrice.message}</p>}
                  </div>

                  <div>
                      <Label className={commonLabelClass}>Risk:Reward Ratio (RRR)</Label>
                      <Input value={rrr} readOnly disabled className={`${commonInputClass} opacity-70 cursor-not-allowed`} />
                  </div>
                  
                  <div>
                    <Label htmlFor="pl" className={commonLabelClass}>Closed Position P/L (Currency)</Label>
                    <Controller
                      name="pl"
                      control={control}
                      render={({ field }) => <Input type="number" step="any" id="pl" {...numericFieldProps(field)} placeholder="e.g., 150.50 or -50.25" className={commonInputClass} />}
                    />
                    {errors.pl && <p className="text-destructive text-xs mt-1">{errors.pl.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{estimatedPl}</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="screenshot" className={commonLabelClass}>{isTrade ? 'Trade Screenshot' : 'Analysis Screenshot'}</Label>
                <Controller
                    name="screenshot"
                    control={control}
                    render={({ field: { onChange, value, ...restField }}) => (
                        <Input 
                        type="file" 
                        id="screenshot" 
                        accept="image/jpeg, image/png, image/gif, image/webp" 
                        onChange={handleScreenshotChange}
                        className={`${commonInputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90`}
                        {...restField}
                        />
                    )}
                />
                {screenshotPreview && (
                  <div className="mt-2">
                    <img src={screenshotPreview} alt="Screenshot preview" className="max-h-48 rounded-md border border-border" data-ai-hint="chart graph" />
                    <p className="text-xs text-muted-foreground mt-1">{screenshotName || "Screenshot preview"}</p>
                  </div>
                )}
                {errors.screenshot && <p className="text-destructive text-xs mt-1">{errors.screenshot.message?.toString()}</p>}
              </div>

              <div>
                <Label htmlFor="disciplineRating" className={commonLabelClass}>Discipline Rating (1-5)</Label>
                <Controller
                  name="disciplineRating"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()} defaultValue={field.value?.toString()}>
                      <SelectTrigger id="disciplineRating" className={commonInputClass}>
                        <SelectValue placeholder="Rate discipline" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(rate => (
                          <SelectItem key={rate} value={rate.toString()}>{rate} ({
                            ["Very Poor", "Poor", "Average", "Good", "Excellent"][rate-1]
                          })</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.disciplineRating && <p className="text-destructive text-xs mt-1">{errors.disciplineRating.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className={commonLabelClass}>Trade Notes / Reflection</Label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => <Textarea id="notes" {...field} value={field.value ?? ''} rows={4} placeholder="Your thoughts, observations, lessons learned..." className={commonInputClass} />}
              />
              {errors.notes && <p className="text-destructive text-xs mt-1">{errors.notes.message}</p>}
            </div>
            
            <Card className="bg-muted/50 border-border p-4 md:p-6">
               <h3 className="text-lg font-headline mb-4">Additional Details</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                      <Label htmlFor="session" className={commonLabelClass}>Session (e.g., London, NY)</Label>
                      <Controller name="session" control={control} render={({ field }) => <Input id="session" {...field} value={field.value ?? ''} className={commonInputClass} placeholder="e.g., New York Open" />} />
                       {errors.session && <p className="text-destructive text-xs mt-1">{errors.session.message}</p>}
                  </div>
                   <div>
                      <Label htmlFor="emotionalState" className={commonLabelClass}>Emotional State of Mind</Label>
                      <Controller name="emotionalState" control={control} render={({ field }) => <Input id="emotionalState" {...field} value={field.value ?? ''} className={commonInputClass} placeholder="e.g., Calm, Anxious, FOMO" />} />
                      {errors.emotionalState && <p className="text-destructive text-xs mt-1">{errors.emotionalState.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                      <Label htmlFor="reasonForEntry" className={commonLabelClass}>{isTrade ? 'Reason for Entry' : 'Reason for Analysis'}</Label>
                      <Controller name="reasonForEntry" control={control} render={({ field }) => <Textarea id="reasonForEntry" {...field} value={field.value ?? ''} rows={2} className={commonInputClass} placeholder="e.g., Break of structure, News catalyst" />} />
                      {errors.reasonForEntry && <p className="text-destructive text-xs mt-1">{errors.reasonForEntry.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                      <Label htmlFor="reasonForExit" className={commonLabelClass}>{isTrade ? 'Reason for Exit / No Trade' : 'Reason for No Trade Decision'}</Label>
                      <Controller name="reasonForExit" control={control} render={({ field }) => <Textarea id="reasonForExit" {...field} value={field.value ?? ''} rows={2} className={commonInputClass} placeholder="e.g., Target hit, SL hit, Invalidated setup" />} />
                      {errors.reasonForExit && <p className="text-destructive text-xs mt-1">{errors.reasonForExit.message}</p>}
                  </div>
               </div>
            </Card>
          </fieldset>
          <div className="flex space-x-3 pt-2">
            <Button type="submit" size="lg" className="font-headline" disabled={disabled || (!isDirty && isEditing)}>
              {isEditing ? <><Edit3 className="mr-2 h-5 w-5" /> Update Entry</> : <><PlusCircle className="mr-2 h-5 w-5" /> Add Entry</>}
            </Button>
            {isEditing && onCancelEdit && (
              <Button type="button" variant="outline" size="lg" onClick={onCancelEdit} className="font-headline" disabled={disabled}>
                <XCircle className="mr-2 h-5 w-5" /> Cancel Edit
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
});

JournalEntryForm.displayName = "JournalEntryForm";
    
