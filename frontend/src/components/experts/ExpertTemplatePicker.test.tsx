import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpertTemplatePicker } from './ExpertTemplatePicker';
import { EXPERT_TEMPLATES } from '@/lib/constants/expert-templates';

describe('ExpertTemplatePicker', () => {
  it('should render a card for each expert template', () => {
    const onSelect = vi.fn();
    render(<ExpertTemplatePicker onSelect={onSelect} />);

    for (const template of EXPERT_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    }
  });

  it('should display the specialty for each template', () => {
    const onSelect = vi.fn();
    render(<ExpertTemplatePicker onSelect={onSelect} />);

    for (const template of EXPERT_TEMPLATES) {
      expect(screen.getByText(template.specialty)).toBeInTheDocument();
    }
  });

  it('should call onSelect with the template data when a card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ExpertTemplatePicker onSelect={onSelect} />);

    const firstTemplate = EXPERT_TEMPLATES[0];
    const card = screen.getByText(firstTemplate.name).closest('[role="button"], button, [data-testid]')
      || screen.getByText(firstTemplate.name);

    await user.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: firstTemplate.id,
        name: firstTemplate.name,
        specialty: firstTemplate.specialty,
        systemPrompt: firstTemplate.systemPrompt,
        driverType: firstTemplate.driverType,
        config: firstTemplate.config,
      }),
    );
  });

  it('should call onSelect with the correct template when different cards are clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ExpertTemplatePicker onSelect={onSelect} />);

    const lastTemplate = EXPERT_TEMPLATES[EXPERT_TEMPLATES.length - 1];
    const card = screen.getByText(lastTemplate.name).closest('[role="button"], button, [data-testid]')
      || screen.getByText(lastTemplate.name);

    await user.click(card);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: lastTemplate.id,
        name: lastTemplate.name,
      }),
    );
  });
});
