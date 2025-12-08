'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Pencil, FileText, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCollection, useDocuments } from '@/hooks';
import { EditCollectionDialog } from '@/components/collections';
import {
  DocumentCard,
  UploadDropzone,
  DocumentEmptyState,
  DocumentListSkeleton,
} from '@/components/documents';
import { Skeleton } from '@/components/ui/skeleton';

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { id } = use(params);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const {
    data: collection,
    isLoading: isLoadingCollection,
    isError: isCollectionError,
    error: collectionError,
  } = useCollection(id);
  const {
    data: documentsData,
    isLoading: isLoadingDocuments,
    isError: isDocumentsError,
    error: documentsError,
    refetch: refetchDocuments,
  } = useDocuments(id);

  if (isCollectionError) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-destructive/10 p-4 mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Collection not found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {collectionError instanceof Error
              ? collectionError.message
              : 'The collection you are looking for does not exist.'}
          </p>
          <Button asChild className="rounded-xl">
            <Link href="/collections">Back to Collections</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Navigation */}
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link href="/collections" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Collections
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="space-y-1">
          {isLoadingCollection ? (
            <>
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-5 w-96" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">
                {collection?.name}
              </h1>
              <p className="text-muted-foreground">
                {collection?.description || 'No description'}
              </p>
            </>
          )}
        </div>

        {!isLoadingCollection && collection && (
          <Button
            variant="outline"
            onClick={() => setShowEditDialog(true)}
            className="shrink-0 rounded-xl"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      {/* Stats */}
      {!isLoadingCollection && collection && (
        <div className="flex flex-wrap gap-6 mb-8">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold">{collection.document_count}</span>
              <span className="text-muted-foreground ml-1">
                {collection.document_count === 1 ? 'document' : 'documents'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold">{collection.chunk_count}</span>
              <span className="text-muted-foreground ml-1">
                {collection.chunk_count === 1 ? 'chunk' : 'chunks'}
              </span>
            </div>
          </div>
        </div>
      )}

      <Separator className="my-8" />

      {/* Upload Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>
        <UploadDropzone collectionId={id} />
      </div>

      <Separator className="my-8" />

      {/* Documents List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Documents
            {documentsData && documentsData.total > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({documentsData.total})
              </span>
            )}
          </h2>
        </div>

        {isLoadingDocuments && <DocumentListSkeleton />}

        {isDocumentsError && (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed">
            <div className="rounded-xl bg-destructive/10 p-3 mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="font-semibold mb-2">Failed to load documents</h3>
            <p className="text-muted-foreground mb-4 text-sm max-w-sm">
              {documentsError instanceof Error
                ? documentsError.message
                : 'An unexpected error occurred'}
            </p>
            <Button size="sm" onClick={() => refetchDocuments()} className="rounded-xl">
              Try again
            </Button>
          </div>
        )}

        {documentsData && documentsData.data.length === 0 && (
          <DocumentEmptyState />
        )}

        {documentsData && documentsData.data.length > 0 && (
          <div className="-mx-1 px-1">
            <div className="grid gap-3">
              {documentsData.data.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  collectionId={id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {collection && (
        <EditCollectionDialog
          collection={collection}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}
    </div>
  );
}
