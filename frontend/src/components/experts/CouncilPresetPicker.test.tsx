import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CouncilPresetPicker } from './CouncilPresetPicker';
import { COUNCIL_PRESETS } from '@/lib/constants/council-presets';

describe('CouncilPresetPicker', () => {
  it('should render a card for each council preset', () => {
    const onSelect = vi.fn();
    render(<CouncilPresetPicker onSelect={onSelect} />);

    for (const preset of COUNCIL_PRESETS) {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    }
  });

  it('should display the description for each preset', () => {
    const onSelect = vi.fn();
    render(<CouncilPresetPicker onSelect={onSelect} />);

    for (const preset of COUNCIL_PRESETS) {
      expect(screen.getByText(preset.description)).toBeInTheDocument();
    }
  });

  it('should call onSelect with the preset data when a card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CouncilPresetPicker onSelect={onSelect} />);

    const firstPreset = COUNCIL_PRESETS[0];
    const card = screen.getByText(firstPreset.name).closest('[role="button"], button, [data-testid]')
      || screen.getByText(firstPreset.name);

    await user.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: firstPreset.id,
        name: firstPreset.name,
        description: firstPreset.description,
        expertTemplateIds: firstPreset.expertTemplateIds,
      }),
    );
  });

  it('should call onSelect with the correct preset when different cards are clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CouncilPresetPicker onSelect={onSelect} />);

    const lastPreset = COUNCIL_PRESETS[COUNCIL_PRESETS.length - 1];
    const card = screen.getByText(lastPreset.name).closest('[role="button"], button, [data-testid]')
      || screen.getByText(lastPreset.name);

    await user.click(card);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: lastPreset.id,
        name: lastPreset.name,
      }),
    );
  });
});
