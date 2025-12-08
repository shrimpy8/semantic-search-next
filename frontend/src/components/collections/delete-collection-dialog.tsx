'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteCollection } from '@/hooks';
import { type Collection } from '@/lib/api';

interface DeleteCollectionDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
}: DeleteCollectionDialogProps) {
  const deleteCollection = useDeleteCollection();

  const handleDelete = async () => {
    await deleteCollection.mutateAsync(collection.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Collection</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{collection.name}&quot;? This
            will permanently remove the collection and all{' '}
            {collection.document_count}{' '}
            {collection.document_count === 1 ? 'document' : 'documents'} within
            it. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteCollection.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCollection.isPending}
          >
            {deleteCollection.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
