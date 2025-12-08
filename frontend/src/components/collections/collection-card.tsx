'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { FileText, MoreVertical, Pencil, Trash2, FolderOpen, Upload, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Collection } from '@/lib/api';
import { DeleteCollectionDialog } from './delete-collection-dialog';
import { EditCollectionDialog } from './edit-collection-dialog';

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  return (
    <>
      <Card className="group transition-all duration-200 hover:shadow-lg hover:border-primary/20 border-muted-foreground/10">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">
                <Link
                  href={`/collections/${collection.id}`}
                  className="hover:text-primary transition-colors"
                >
                  {collection.name}
                </Link>
              </CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {collection.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span>
                {collection.document_count}{' '}
                {collection.document_count === 1 ? 'document' : 'documents'}
              </span>
            </div>
            <span className="text-xs">
              {formatDistanceToNow(new Date(collection.updated_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Upload CTA */}
          <Link
            href={`/collections/${collection.id}`}
            className="flex items-center justify-between p-2 -mx-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group/upload"
          >
            <div className="flex items-center gap-2 text-sm">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {collection.document_count === 0 ? 'Add documents' : 'Manage & upload'}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover/upload:text-primary group-hover/upload:translate-x-0.5 transition-all" />
          </Link>
        </CardContent>
      </Card>

      <DeleteCollectionDialog
        collection={collection}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />

      <EditCollectionDialog
        collection={collection}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
}
