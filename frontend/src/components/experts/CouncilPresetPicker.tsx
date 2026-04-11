import { COUNCIL_PRESETS, CouncilPreset } from '@/lib/constants/council-presets';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CouncilPresetPickerProps {
  onSelect: (preset: CouncilPreset) => void;
}

export function CouncilPresetPicker({ onSelect }: CouncilPresetPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {COUNCIL_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="text-left"
          onClick={() => onSelect(preset)}
          aria-label={`Use ${preset.name} preset`}
        >
          <Card className="h-full transition-colors hover:border-primary hover:bg-accent cursor-pointer">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{preset.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {preset.expertTemplateIds.length} experts
                </Badge>
              </div>
              <CardDescription className="text-xs">{preset.description}</CardDescription>
            </CardHeader>
          </Card>
        </button>
      ))}
    </div>
  );
}
