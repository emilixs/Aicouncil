import { useState, useRef, useEffect } from "react";

interface ExpertFiltersProps {
  onSearchChange: (value: string) => void;
  onDriverTypeChange: (value: string) => void;
}

interface SelectOption {
  value: string;
  label: string;
}

const DRIVER_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "OPENAI", label: "Openai" },
  { value: "ANTHROPIC", label: "Anthropic" },
  { value: "GROK", label: "Grok" },
];

function CustomSelect({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (value: string) => void;
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
    <div ref={ref} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        className="flex h-10 min-w-[120px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {selected.label}
      </div>
      {open && (
        <div role="listbox" className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
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

export function ExpertFilters({
  onSearchChange,
  onDriverTypeChange,
}: ExpertFiltersProps) {
  return (
    <div className="flex gap-4 mb-4">
      <input
        type="text"
        placeholder="Search experts..."
        className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <CustomSelect options={DRIVER_OPTIONS} onChange={onDriverTypeChange} />
    </div>
  );
}
