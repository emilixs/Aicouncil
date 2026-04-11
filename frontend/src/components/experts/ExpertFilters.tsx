import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface ExpertFiltersProps {
  onSearchChange: (value: string) => void;
  onDriverTypeChange: (value: string) => void;
}

const DRIVER_OPTIONS = [
  { value: "all", label: "All" },
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
      <Input
        type="text"
        placeholder="Search experts..."
        className="max-w-sm"
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select onValueChange={(v) => onDriverTypeChange(v === "all" ? "" : v)}>
        <SelectTrigger className="min-w-[120px]">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          {DRIVER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
