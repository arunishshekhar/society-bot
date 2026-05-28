'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { reprocessLostFoundAction } from '../actions/admin';
import { toast } from 'sonner';

export function ReprocessButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await reprocessLostFoundAction();
        const msg = `✅ Reprocessed ${res.foundProcessed} found + ${res.lostProcessed} lost items. Check bot logs for notifications sent.`;
        setResult(msg);
        toast.success('Reprocess complete', { description: msg });
      } catch (err) {
        toast.error('Reprocess failed', { description: String(err) });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isPending}
        className="gap-2"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Reprocessing…
          </>
        ) : (
          <>🔄 Reprocess Matches</>
        )}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground max-w-xs text-right">{result}</p>
      )}
    </div>
  );
}
