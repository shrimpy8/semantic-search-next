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
import { useDeleteDocument } from '@/hooks';
import { type Document } from '@/lib/api';

interface DeleteDocumentDialogProps {
  document: Document;
  collectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDocumentDialog({
  document,
  collectionId,
  open,
  onOpenChange,
}: DeleteDocumentDialogProps) {
  const deleteDocument = useDeleteDocument(collectionId);

  const handleDelete = async () => {
    await deleteDocument.mutateAsync(document.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{document.filename}&quot;?
            This will permanently remove the document and all its indexed
            chunks. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteDocument.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteDocument.isPending}
          >
            {deleteDocument.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
