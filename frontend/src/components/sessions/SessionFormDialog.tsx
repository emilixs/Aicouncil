import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionForm } from "./SessionForm";

interface SessionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (sessionId: string) => void;
}

export function SessionFormDialog({ open, onOpenChange, onSuccess }: SessionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Discussion Session</DialogTitle>
          <DialogDescription>
            Set up a new discussion session with selected experts to discuss your problem statement.
          </DialogDescription>
        </DialogHeader>
        <SessionForm
          onSuccess={(sessionId) => {
            onOpenChange(false);
            onSuccess(sessionId);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

