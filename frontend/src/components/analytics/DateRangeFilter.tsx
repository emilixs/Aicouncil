import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DateRangeFilter as DateRangeFilterType } from '@/types/analytics';
import { CalendarDays } from 'lucide-react';

interface DateRangeFilterProps {
  onFilter: (filter: DateRangeFilterType) => void;
}

export function DateRangeFilter({ onFilter }: DateRangeFilterProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleApply = () => {
    onFilter({
      from: from || undefined,
      to: to || undefined,
    });
  };

  const handleClear = () => {
    setFrom('');
    setTo('');
    onFilter({});
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarDays className="h-4 w-4 text-muted-foreground" />
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm"
        aria-label="From date"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="rounded-md border bg-background px-3 py-1.5 text-sm"
        aria-label="To date"
      />
      <Button variant="outline" size="sm" onClick={handleApply}>
        Apply
      </Button>
      {(from || to) && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear
        </Button>
      )}
    </div>
  );
}
