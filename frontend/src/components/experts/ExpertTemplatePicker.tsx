import { EXPERT_TEMPLATES, ExpertTemplate } from '@/lib/constants/expert-templates';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ExpertTemplatePickerProps {
  onSelect: (template: ExpertTemplate) => void;
  onSkip?: () => void;
}

export function ExpertTemplatePicker({ onSelect, onSkip }: ExpertTemplatePickerProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXPERT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="text-left"
            onClick={() => onSelect(template)}
            aria-label={`Use ${template.name} template`}
          >
            <Card className="h-full transition-colors hover:border-primary hover:bg-accent cursor-pointer">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {template.driverType}
                  </Badge>
                </div>
                <CardDescription className="text-xs">{template.specialty}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
      {onSkip && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Start from scratch
          </Button>
        </div>
      )}
    </div>
  );
}
