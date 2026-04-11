import { ReactNode } from "react";
import { Button } from "./button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
