import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expertFormSchema, ExpertFormValues } from "@/lib/validations/expert";
import { MODEL_OPTIONS, DEFAULT_CONFIG } from "@/lib/constants/models";
import { createExpert, updateExpert } from "@/lib/api/experts";
import { ExpertResponse, DriverType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface ExpertFormProps {
  expert?: ExpertResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExpertForm({ expert, onSuccess, onCancel }: ExpertFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExpertFormValues>({
    resolver: zodResolver(expertFormSchema),
    defaultValues: expert
      ? {
          name: expert.name,
          specialty: expert.specialty,
          systemPrompt: expert.systemPrompt,
          driverType: expert.driverType,
          config: expert.config,
        }
      : {
          name: "",
          specialty: "",
          systemPrompt: "",
          driverType: DriverType.OPENAI,
          config: DEFAULT_CONFIG[DriverType.OPENAI],
        },
  });

  const watchedDriverType = form.watch("driverType");

  const onSubmit = async (values: ExpertFormValues) => {
    setIsSubmitting(true);
    try {
      if (expert) {
        await updateExpert(expert.id, values);
        toast({
          title: "Success",
          description: "Expert updated successfully",
        });
      } else {
        await createExpert(values);
        toast({
          title: "Success",
          description: "Expert created successfully",
        });
      }
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Expert name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="specialty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specialty</FormLabel>
              <FormControl>
                <Input placeholder="Expert specialty" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="systemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Prompt</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter the system prompt for this expert"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="driverType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Driver Type</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  const newDriverType = value as DriverType;
                  form.setValue("config", DEFAULT_CONFIG[newDriverType]);
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={DriverType.OPENAI}>OpenAI</SelectItem>
                  <SelectItem value={DriverType.ANTHROPIC}>Anthropic</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MODEL_OPTIONS[watchedDriverType].map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.temperature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temperature</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.maxTokens"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Tokens</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.topP"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Top P</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : expert ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

