'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdateCollection } from '@/hooks';
import { type Collection } from '@/lib/api';

interface EditCollectionDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCollectionDialog({
  collection,
  open,
  onOpenChange,
}: EditCollectionDialogProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || '');
  const [isTrusted, setIsTrusted] = useState(collection.is_trusted ?? false);
  const updateCollection = useUpdateCollection(collection.id);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(collection.name);
      setDescription(collection.description || '');
      setIsTrusted(collection.is_trusted ?? false);
    }
  }, [open, collection.name, collection.description, collection.is_trusted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await updateCollection.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      is_trusted: isTrusted,
    });

    onOpenChange(false);
  };

  const hasChanges =
    name.trim() !== collection.name ||
    (description.trim() || '') !== (collection.description || '') ||
    isTrusted !== (collection.is_trusted ?? false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
            <DialogDescription>
              Update your collection&apos;s name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="Enter collection name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input
                id="edit-description"
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 min-h-[44px]">
              <div>
                <Label htmlFor="edit-trusted">Trusted Source</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mark this collection as from a verified, trusted source
                </p>
              </div>
              <Switch
                id="edit-trusted"
                checked={isTrusted}
                onCheckedChange={setIsTrusted}
                disabled={updateCollection.isPending}
                aria-label="Toggle trusted source status"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCollection.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !hasChanges || updateCollection.isPending}
            >
              {updateCollection.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
