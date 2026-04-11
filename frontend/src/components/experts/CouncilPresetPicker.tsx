import { COUNCIL_PRESETS, CouncilPreset } from '@/lib/constants/council-presets';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface CouncilPresetPickerProps {
  onSelect: (preset: CouncilPreset) => void;
}

export function CouncilPresetPicker({ onSelect }: CouncilPresetPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {COUNCIL_PRESETS.map((preset) => (
        <Card
          key={preset.id}
          className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <button
            type="button"
            className="w-full text-left"
            aria-label={`Select ${preset.name} preset`}
            onClick={() => onSelect(preset)}
          >
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium">{preset.name}</CardTitle>
              <CardDescription>{preset.description}</CardDescription>
            </CardHeader>
          </button>
        </Card>
      ))}
    </div>
  );
}
