import { CustomSelect, SelectOption } from "@/components/ui/CustomSelect";

interface SessionFiltersProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
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
