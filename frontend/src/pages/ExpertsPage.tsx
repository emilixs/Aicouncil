import { useState, useEffect } from "react";
import { ExpertResponse } from "@/types";
import { getExperts } from "@/lib/api/experts";
import { ExpertTable } from "@/components/experts/ExpertTable";
import { ExpertFormDialog } from "@/components/experts/ExpertFormDialog";
import { DeleteExpertDialog } from "@/components/experts/DeleteExpertDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw } from "lucide-react";

export default function ExpertsPage() {
  const [experts, setExperts] = useState<ExpertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpert, setSelectedExpert] = useState<ExpertResponse | null>(null);
  const { toast } = useToast();

  const fetchExperts = async () => {
    setLoading(true);
    try {
      const data = await getExperts();
      setExperts(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch experts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperts();
  }, []);

  const handleEdit = (expert: ExpertResponse) => {
    setSelectedExpert(expert);
    setEditDialogOpen(true);
  };

  const handleDelete = (expert: ExpertResponse) => {
    setSelectedExpert(expert);
    setDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    fetchExperts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Expert Management</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchExperts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Expert
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading experts...</p>
        </div>
      ) : (
        <ExpertTable
          data={experts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <ExpertFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleSuccess}
      />

      <ExpertFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        expert={selectedExpert || undefined}
        onSuccess={handleSuccess}
      />

      <DeleteExpertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        expert={selectedExpert}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

