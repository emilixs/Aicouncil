import { COUNCIL_PRESETS, CouncilPreset } from '@/lib/constants/council-presets';

interface CouncilPresetPickerProps {
  onSelect: (preset: CouncilPreset) => void;
}

export function CouncilPresetPicker({ onSelect }: CouncilPresetPickerProps) {
  return (
    <div>
      {COUNCIL_PRESETS.map((preset) => (
        <div
          key={preset.id}
          role="button"
          onClick={() => onSelect(preset)}
        >
          <div>{preset.name}</div>
          <div>{preset.description}</div>
        </div>
      ))}
    </div>
  );
}
