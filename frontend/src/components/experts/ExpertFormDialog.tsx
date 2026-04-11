import { useState } from "react";
import { ExpertResponse } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpertForm } from "./ExpertForm";
import { ExpertTemplatePicker } from "./ExpertTemplatePicker";
import { ExpertTemplate } from "@/lib/constants/expert-templates";

interface ExpertFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expert?: ExpertResponse;
  onSuccess: () => void;
}

export function ExpertFormDialog({
  open,
  onOpenChange,
  expert,
  onSuccess,
}: ExpertFormDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ExpertTemplate | null>(null);
  const isCreating = !expert;

  const handleSuccess = () => {
    handleOpenChange(false);
    onSuccess();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedTemplate(null);
    }
    onOpenChange(open);
  };

  const handleTemplateSelect = (template: ExpertTemplate) => {
    setSelectedTemplate(template);
  };

  const handleBackToTemplates = () => {
    setSelectedTemplate(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expert ? "Edit Expert" : "Create Expert"}</DialogTitle>
          <DialogDescription>
            {expert
              ? "Update the expert's information below."
              : selectedTemplate
                ? "Customize the template settings below."
                : "Choose a template to get started, or start from scratch."}
          </DialogDescription>
        </DialogHeader>
        {isCreating && !selectedTemplate ? (
          <ExpertTemplatePicker
            onSelect={handleTemplateSelect}
            onSkip={() => setSelectedTemplate({ id: 'scratch', name: '', specialty: '', systemPrompt: '', driverType: 'OPENAI' as any, config: { model: '' } })}
          />
        ) : (
          <ExpertForm
            expert={expert}
            template={isCreating && selectedTemplate?.id !== 'scratch' ? selectedTemplate : undefined}
            onSuccess={handleSuccess}
            onCancel={() => isCreating && !expert ? handleBackToTemplates() : handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

