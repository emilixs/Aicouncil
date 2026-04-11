import { CustomSelect, SelectOption } from "@/components/ui/CustomSelect";

interface ExpertFiltersProps {
  onSearchChange: (value: string) => void;
  onDriverTypeChange: (value: string) => void;
}

const DRIVER_OPTIONS: SelectOption[] = [
  { value: "", label: "All" },
  { value: "OPENAI", label: "Openai" },
  { value: "ANTHROPIC", label: "Anthropic" },
  { value: "GROK", label: "Grok" },
];

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
