'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, MoreVertical, Trash2, Loader2, AlertCircle, CheckCircle, Layers, Clock, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Document } from '@/lib/api';
import { DeleteDocumentDialog } from './delete-document-dialog';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  document: Document;
  collectionId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StatusBadge({ status, chunkCount }: { status: Document['status']; chunkCount?: number }) {
  // Show warning if ready but no chunks
  if (status === 'ready' && chunkCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
        <AlertCircle className="h-3 w-3" />
        Not Searchable
      </span>
    );
  }

  switch (status) {
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
          <CheckCircle className="h-3 w-3" />
          Ready
        </span>
      );
  }
}

export function DocumentCard({ document, collectionId }: DocumentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isPdf = document.filename.toLowerCase().endsWith('.pdf');
  const isNotSearchable = document.status === 'ready' && document.chunk_count === 0;

  return (
    <>
      <Card className={cn(
        "group transition-all duration-200 hover:shadow-lg border-muted-foreground/10",
        document.status === 'processing' && "border-amber-500/30",
        document.status === 'error' && "border-red-500/30",
        isNotSearchable && "border-amber-500/30"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* File icon */}
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              document.status === 'ready' && !isNotSearchable && "bg-primary/10 group-hover:bg-primary/15",
              document.status === 'processing' && "bg-amber-100 dark:bg-amber-900/30",
              document.status === 'error' && "bg-red-100 dark:bg-red-900/30",
              isNotSearchable && "bg-amber-100 dark:bg-amber-900/30"
            )}>
              <FileText className={cn(
                "h-5 w-5",
                document.status === 'ready' && !isNotSearchable && "text-primary",
                document.status === 'processing' && "text-amber-600 dark:text-amber-400",
                document.status === 'error' && "text-red-600 dark:text-red-400",
                isNotSearchable && "text-amber-600 dark:text-amber-400"
              )} />
            </div>

            {/* Title and status */}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base mb-1.5">
                <span className="truncate block">{document.filename}</span>
              </CardTitle>
              <StatusBadge status={document.status} chunkCount={document.chunk_count} />
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
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{formatFileSize(document.file_size)}</span>
            </div>
            {isPdf && document.page_count && (
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>{document.page_count} {document.page_count === 1 ? 'page' : 'pages'}</span>
              </div>
            )}
            <div className={cn(
              "flex items-center gap-1.5",
              document.status === 'ready' && document.chunk_count === 0 && "text-amber-600 dark:text-amber-400"
            )}>
              {document.status === 'ready' && document.chunk_count === 0 ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>No chunks (not searchable)</span>
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5" />
                  <span>{document.chunk_count} {document.chunk_count === 1 ? 'chunk' : 'chunks'}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {formatDistanceToNow(new Date(document.uploaded_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeleteDocumentDialog
        document={document}
        collectionId={collectionId}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}
