import { ExpertResponse } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpertForm } from "./ExpertForm";

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
  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expert ? "Edit Expert" : "Create Expert"}</DialogTitle>
          <DialogDescription>
            {expert
              ? "Update the expert's information below."
              : "Fill in the details to create a new expert."}
          </DialogDescription>
        </DialogHeader>
        <ExpertForm
          expert={expert}
          onSuccess={handleSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

