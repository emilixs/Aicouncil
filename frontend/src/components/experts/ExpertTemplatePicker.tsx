import { EXPERT_TEMPLATES, ExpertTemplate } from '@/lib/constants/expert-templates';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ExpertTemplatePickerProps {
  onSelect: (template: ExpertTemplate) => void;
}

export function ExpertTemplatePicker({ onSelect }: ExpertTemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {EXPERT_TEMPLATES.map((template) => (
        <Card
          key={template.id}
          className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <button
            type="button"
            className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Select ${template.name} template`}
            onClick={() => onSelect(template)}
          >
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
              <CardDescription>{template.specialty}</CardDescription>
            </CardHeader>
          </button>
        </Card>
      ))}
    </div>
  );
}
