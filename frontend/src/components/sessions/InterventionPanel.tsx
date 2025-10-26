import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Send, Wifi, WifiOff } from "lucide-react";

interface InterventionPanelProps {
  onSendIntervention: (content: string) => Promise<void>;
  disabled: boolean;
  isConnected: boolean;
}

export function InterventionPanel({
  onSendIntervention,
  disabled,
  isConnected,
}: InterventionPanelProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!content.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      await onSendIntervention(content);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send intervention");
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = !content.trim() || disabled || !isConnected || isSending;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">User Intervention</CardTitle>
        <CardDescription>
          Send a message to guide the discussion or provide additional context
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!isConnected && (
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              WebSocket disconnected. Reconnecting...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Textarea
          placeholder="Type your intervention message here..."
          className="min-h-[100px] resize-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!isConnected || disabled}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{content.length}/1000 characters</span>
          <div className="flex items-center gap-1">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 text-green-500" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-red-500" />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSend}
          disabled={isDisabled}
          className="w-full"
        >
          {isSending ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Intervention
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

