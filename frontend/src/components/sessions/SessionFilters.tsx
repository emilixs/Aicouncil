import { useState, useRef, useEffect } from "react";

interface SessionFiltersProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

interface SelectOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "status", label: "By status" },
];

function CustomSelect({
  options,
  onChange,
  label,
}: {
  options: SelectOption[];
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(options[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        tabIndex={0}
        className="flex h-10 min-w-[140px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {selected.label}
      </div>
      {open && (
        <div role="listbox" className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === selected.value}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
              onClick={() => {
                setSelected(opt);
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionFilters({
  onSearchChange,
  onStatusChange,
  onSortChange,
}: SessionFiltersProps) {
  return (
    <div className="flex gap-4 mb-4">
      <input
        type="text"
        placeholder="Search sessions..."
        className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <CustomSelect options={STATUS_OPTIONS} onChange={onStatusChange} label="Status" />
      <CustomSelect options={SORT_OPTIONS} onChange={onSortChange} label="Sort" />
    </div>
  );
}
