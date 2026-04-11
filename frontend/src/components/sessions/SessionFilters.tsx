import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface SessionFiltersProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "status", label: "By status" },
];

export function SessionFilters({
  onSearchChange,
  onStatusChange,
  onSortChange,
}: SessionFiltersProps) {
  return (
    <div className="flex gap-4 mb-4">
      <Input
        type="text"
        placeholder="Search sessions..."
        className="max-w-sm"
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
        <SelectTrigger className="min-w-[140px]" aria-label="Status">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => onSortChange(v)}>
        <SelectTrigger className="min-w-[140px]" aria-label="Sort">
          <SelectValue placeholder="Newest first" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
