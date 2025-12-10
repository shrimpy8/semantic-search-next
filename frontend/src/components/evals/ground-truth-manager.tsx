'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useGroundTruths,
  useCreateGroundTruth,
  useUpdateGroundTruth,
  useDeleteGroundTruth,
} from '@/hooks';
import { useCollections } from '@/hooks';
import type { GroundTruth, GroundTruthCreate, GroundTruthUpdate } from '@/lib/api/evals';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GroundTruthManagerProps {
  selectedCollectionId?: string;
  onCollectionChange?: (collectionId: string | undefined) => void;
  className?: string;
}

export function GroundTruthManager({
  selectedCollectionId,
  onCollectionChange,
  className,
}: GroundTruthManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroundTruth, setEditingGroundTruth] = useState<GroundTruth | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: collections } = useCollections();
  const {
    data: groundTruths,
    isLoading,
  } = useGroundTruths({
    collection_id: selectedCollectionId,
    limit: 50,
  });

  // Mutations
  const createMutation = useCreateGroundTruth();
  const updateMutation = useUpdateGroundTruth();
  const deleteMutation = useDeleteGroundTruth();

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = () => {
    setEditingGroundTruth(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (groundTruth: GroundTruth) => {
    setEditingGroundTruth(groundTruth);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Ground truth deleted');
      setDeleteConfirmId(null);
    } catch {
      toast.error('Failed to delete ground truth');
    }
  };

  const handleSave = async (data: GroundTruthCreate | GroundTruthUpdate) => {
    try {
      if (editingGroundTruth) {
        await updateMutation.mutateAsync({
          id: editingGroundTruth.id,
          data: data as GroundTruthUpdate,
        });
        toast.success('Ground truth updated');
      } else {
        await createMutation.mutateAsync(data as GroundTruthCreate);
        toast.success('Ground truth created');
      }
      setIsDialogOpen(false);
      setEditingGroundTruth(null);
    } catch {
      toast.error(editingGroundTruth ? 'Failed to update' : 'Failed to create');
    }
  };

  return (
    <Card className={cn('rounded-2xl', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Ground Truth Dataset</CardTitle>
            <p className="text-sm text-muted-foreground">
              Expected Q&A pairs for evaluation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedCollectionId || 'all'}
            onValueChange={(v) => onCollectionChange?.(v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All collections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              {collections?.data?.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : !groundTruths?.data?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No ground truth entries yet.</p>
            <p className="text-sm mt-1">Add Q&A pairs to evaluate against.</p>
            <Button
              variant="outline"
              onClick={handleCreate}
              className="mt-4 rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add first entry
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {groundTruths.data.map((gt) => (
              <GroundTruthItem
                key={gt.id}
                groundTruth={gt}
                isExpanded={expandedIds.has(gt.id)}
                onToggle={() => toggleExpanded(gt.id)}
                onEdit={() => handleEdit(gt)}
                onDelete={() => setDeleteConfirmId(gt.id)}
                collectionName={
                  collections?.data?.find((c) => c.id === gt.collection_id)?.name
                }
              />
            ))}
            {groundTruths.has_more && (
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Load more...
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <GroundTruthDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingGroundTruth(null);
        }}
        onSave={handleSave}
        groundTruth={editingGroundTruth}
        collections={collections?.data || []}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Ground Truth</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ground truth entry? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="rounded-xl"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface GroundTruthItemProps {
  groundTruth: GroundTruth;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  collectionName?: string;
}

function GroundTruthItem({
  groundTruth,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  collectionName,
}: GroundTruthItemProps) {
  const truncatedQuery =
    groundTruth.query.length > 80
      ? groundTruth.query.slice(0, 80) + '...'
      : groundTruth.query;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-xl border bg-card">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 rounded-t-xl">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" title={groundTruth.query}>
                {truncatedQuery}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {collectionName && (
                  <Badge variant="secondary" className="text-xs rounded-md">
                    {collectionName}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(groundTruth.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-3 border-t">
            <div>
              <Label className="text-xs text-muted-foreground">Query</Label>
              <p className="text-sm mt-1 bg-muted/30 rounded-lg p-2">
                {groundTruth.query}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Expected Answer</Label>
              <p className="text-sm mt-1 bg-muted/30 rounded-lg p-2 max-h-32 overflow-y-auto">
                {groundTruth.expected_answer}
              </p>
            </div>
            {groundTruth.expected_sources && groundTruth.expected_sources.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Expected Sources</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {groundTruth.expected_sources.map((source, i) => (
                    <Badge key={i} variant="outline" className="text-xs rounded-md">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {groundTruth.notes && (
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <p className="text-sm mt-1 text-muted-foreground italic">
                  {groundTruth.notes}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface GroundTruthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: GroundTruthCreate | GroundTruthUpdate) => void;
  groundTruth: GroundTruth | null;
  collections: Array<{ id: string; name: string }>;
  isLoading: boolean;
}

function GroundTruthDialog({
  isOpen,
  onClose,
  onSave,
  groundTruth,
  collections,
  isLoading,
}: GroundTruthDialogProps) {
  const isEditing = !!groundTruth;
  const [formData, setFormData] = useState({
    collection_id: groundTruth?.collection_id || '',
    query: groundTruth?.query || '',
    expected_answer: groundTruth?.expected_answer || '',
    expected_sources: groundTruth?.expected_sources?.join(', ') || '',
    notes: groundTruth?.notes || '',
  });

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFormData({
        collection_id: groundTruth?.collection_id || '',
        query: groundTruth?.query || '',
        expected_answer: groundTruth?.expected_answer || '',
        expected_sources: groundTruth?.expected_sources?.join(', ') || '',
        notes: groundTruth?.notes || '',
      });
    } else {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const expectedSources = formData.expected_sources
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (isEditing) {
      const updateData: GroundTruthUpdate = {
        query: formData.query,
        expected_answer: formData.expected_answer,
        expected_sources: expectedSources.length > 0 ? expectedSources : undefined,
        notes: formData.notes || undefined,
      };
      onSave(updateData);
    } else {
      const createData: GroundTruthCreate = {
        collection_id: formData.collection_id,
        query: formData.query,
        expected_answer: formData.expected_answer,
        expected_sources: expectedSources.length > 0 ? expectedSources : undefined,
        notes: formData.notes || undefined,
      };
      onSave(createData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Ground Truth' : 'Add Ground Truth'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the expected Q&A pair for evaluation.'
              : 'Add an expected Q&A pair to evaluate generated answers against.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="collection">Collection *</Label>
              <Select
                value={formData.collection_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, collection_id: v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="query">Query *</Label>
            <Textarea
              id="query"
              value={formData.query}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, query: e.target.value }))
              }
              placeholder="What question should this answer?"
              className="rounded-xl min-h-[80px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_answer">Expected Answer *</Label>
            <Textarea
              id="expected_answer"
              value={formData.expected_answer}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, expected_answer: e.target.value }))
              }
              placeholder="The ideal/correct answer for this query"
              className="rounded-xl min-h-[120px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_sources">Expected Sources (optional)</Label>
            <Input
              id="expected_sources"
              value={formData.expected_sources}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, expected_sources: e.target.value }))
              }
              placeholder="doc1.pdf, doc2.txt (comma-separated)"
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Document names that should be retrieved for this query
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Why this is the expected answer..."
              className="rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.query ||
                !formData.expected_answer ||
                (!isEditing && !formData.collection_id)
              }
              className="rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
