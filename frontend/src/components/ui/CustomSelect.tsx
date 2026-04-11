import { useState, useRef, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
}

export function CustomSelect({ options, onChange, label }: CustomSelectProps) {
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
        {...(label ? { "aria-label": label } : {})}
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
