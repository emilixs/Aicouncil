import { useState } from "react";
import { SessionResponse } from "@/types";
import { deleteSession } from "@/lib/api/sessions";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionResponse | null;
  onSuccess: () => void;
}

export function DeleteSessionDialog({
  open,
  onOpenChange,
  session,
  onSuccess,
}: DeleteSessionDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!session) return;

    setIsDeleting(true);
    try {
      await deleteSession(session.id);
      toast({
        title: "Success",
        description: "Session deleted successfully",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete session",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const truncated = session?.problemStatement
    ? session.problemStatement.length > 80
      ? session.problemStatement.substring(0, 80) + "..."
      : session.problemStatement
    : "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete session?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the session "{truncated}" and all its messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
