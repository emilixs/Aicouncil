import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sessionFormSchema, SessionFormValues } from "@/lib/validations/session";
import { createSession } from "@/lib/api/sessions";
import { getExperts } from "@/lib/api/experts";
import { ExpertResponse } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface SessionFormProps {
  onSuccess: (sessionId: string) => void;
  onCancel: () => void;
}

export function SessionForm({ onSuccess, onCancel }: SessionFormProps) {
  const { toast } = useToast();
  const [experts, setExperts] = useState<ExpertResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    mode: "onChange",
    defaultValues: {
      problemStatement: "",
      expertIds: [],
      maxMessages: 30,
    },
  });

  // Fetch experts on mount
  useEffect(() => {
    const fetchExperts = async () => {
      try {
        const data = await getExperts();
        setExperts(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load experts",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchExperts();
  }, [toast]);

  const onSubmit = async (values: SessionFormValues) => {
    try {
      const response = await createSession({
        problemStatement: values.problemStatement,
        expertIds: values.expertIds,
        maxMessages: values.maxMessages,
      });
      toast({
        title: "Success",
        description: "Session created successfully",
      });
      onSuccess(response.id);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const problemStatementValue = form.watch("problemStatement");
  const selectedExpertIds = form.watch("expertIds");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Problem Statement */}
        <FormField
          control={form.control}
          name="problemStatement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Problem Statement</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the problem or topic for discussion..."
                  className="min-h-[120px] resize-none"
                  {...field}
                />
              </FormControl>
              <div className="text-xs text-muted-foreground">
                {problemStatementValue.length}/2000 characters
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Expert Selection */}
        <FormField
          control={form.control}
          name="expertIds"
          render={() => (
            <FormItem>
              <FormLabel>Select Experts (2-10)</FormLabel>
              <div className="rounded-md border">
                <ScrollArea className="h-[300px]">
                  <div className="p-4 space-y-3">
                    {loading ? (
                      <div className="text-sm text-muted-foreground">Loading experts...</div>
                    ) : experts.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No experts available</div>
                    ) : (
                      experts.map((expert) => (
                        <div key={expert.id}>
                          <FormField
                            control={form.control}
                            name="expertIds"
                            render={({ field }) => (
                              <FormItem className="flex items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(expert.id) || false}
                                    onCheckedChange={(checked) => {
                                      const newValue = checked
                                        ? [...(field.value || []), expert.id]
                                        : field.value?.filter((id) => id !== expert.id) || [];
                                      field.onChange(newValue);
                                    }}
                                  />
                                </FormControl>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{expert.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {expert.specialty}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {expert.driverType}
                                    </Badge>
                                  </div>
                                </div>
                              </FormItem>
                            )}
                          />
                          <Separator className="mt-3" />
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedExpertIds.length} expert(s) selected
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Max Messages */}
        <FormField
          control={form.control}
          name="maxMessages"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maximum Messages</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="5"
                  max="200"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Let zod handle coercion and validation
                    field.onChange(value === "" ? undefined : value);
                  }}
                  value={field.value ?? ""}
                />
              </FormControl>
              <div className="text-xs text-muted-foreground">
                Discussion will end after {field.value || 30} messages or consensus is reached
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isValid}>
            {form.formState.isSubmitting ? "Creating..." : "Create Session"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

