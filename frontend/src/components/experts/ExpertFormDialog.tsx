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
import { Button } from "@/components/ui/button";

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
  const [showForm, setShowForm] = useState(false);
  const isCreating = !expert;

  const handleSuccess = () => {
    handleOpenChange(false);
    onSuccess();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedTemplate(null);
      setShowForm(false);
    }
    onOpenChange(nextOpen);
  };

  const handleTemplateSelect = (template: ExpertTemplate) => {
    setSelectedTemplate(template);
    setShowForm(true);
  };

  const handleStartBlank = () => {
    setSelectedTemplate(null);
    setShowForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expert
              ? "Edit Expert"
              : showForm
                ? "Create Expert"
                : "Choose a Template"}
          </DialogTitle>
          <DialogDescription>
            {expert
              ? "Update the expert's information below."
              : showForm
                ? "Fill in the details to create a new expert."
                : "Start from a template or create a blank expert."}
          </DialogDescription>
        </DialogHeader>
        {isCreating && !showForm ? (
          <div className="space-y-4">
            <ExpertTemplatePicker onSelect={handleTemplateSelect} />
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleStartBlank}>
                Start from scratch
              </Button>
            </div>
          </div>
        ) : (
          <ExpertForm
            expert={expert}
            initialValues={
              selectedTemplate
                ? {
                    name: selectedTemplate.name,
                    specialty: selectedTemplate.specialty,
                    systemPrompt: selectedTemplate.systemPrompt,
                    driverType: selectedTemplate.driverType,
                    config: selectedTemplate.config,
                  }
                : undefined
            }
            onSuccess={handleSuccess}
            onCancel={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
