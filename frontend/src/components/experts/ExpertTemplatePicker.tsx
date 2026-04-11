import { EXPERT_TEMPLATES, ExpertTemplate } from '@/lib/constants/expert-templates';

interface ExpertTemplatePickerProps {
  onSelect: (template: ExpertTemplate) => void;
}

export function ExpertTemplatePicker({ onSelect }: ExpertTemplatePickerProps) {
  return (
    <div>
      {EXPERT_TEMPLATES.map((template) => (
        <div
          key={template.id}
          role="button"
          onClick={() => onSelect(template)}
        >
          <div>{template.name}</div>
          <div>{template.specialty}</div>
        </div>
      ))}
    </div>
  );
}
