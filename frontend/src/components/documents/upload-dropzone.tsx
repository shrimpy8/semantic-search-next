'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadDocument } from '@/hooks';
import { cn } from '@/lib/utils';

interface UploadDropzoneProps {
  collectionId: string;
}

interface QueuedFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function UploadDropzone({ collectionId }: UploadDropzoneProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const uploadDocument = useUploadDocument(collectionId);

  const processQueue = useCallback(
    async (files: File[]) => {
      const newQueue: QueuedFile[] = files.map((file) => ({
        file,
        status: 'pending',
      }));
      setQueue((prev) => [...prev, ...newQueue]);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setQueue((prev) =>
          prev.map((q) =>
            q.file === file ? { ...q, status: 'uploading' } : q
          )
        );

        try {
          await uploadDocument.mutateAsync(file);
          setQueue((prev) =>
            prev.map((q) => (q.file === file ? { ...q, status: 'done' } : q))
          );
        } catch (err) {
          setQueue((prev) =>
            prev.map((q) =>
              q.file === file
                ? {
                    ...q,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : q
            )
          );
        }
      }

      // Clear completed files after a delay
      setTimeout(() => {
        setQueue((prev) => prev.filter((q) => q.status !== 'done'));
      }, 3000);
    },
    [uploadDocument]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      processQueue(acceptedFiles);
    },
    [processQueue]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const removeFromQueue = (file: File) => {
    setQueue((prev) => prev.filter((q) => q.file !== file));
  };

  const completedCount = queue.filter((q) => q.status === 'done').length;
  const hasUploading = queue.some((q) => q.status === 'uploading');

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30'
        )}
      >
        <input {...getInputProps()} />
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-4 transition-colors',
          isDragActive ? 'bg-primary/10' : 'bg-muted'
        )}>
          {isDragActive ? (
            <FileUp className="h-7 w-7 text-primary animate-bounce" />
          ) : (
            <Upload className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        {isDragActive ? (
          <p className="text-base font-medium text-primary">Drop files to upload</p>
        ) : (
          <div className="space-y-1">
            <p className="text-base font-medium">
              Drop files here or{' '}
              <span className="text-primary">browse</span>
            </p>
            <p className="text-sm text-muted-foreground">
              PDF and TXT files supported
            </p>
          </div>
        )}
      </div>

      {/* Upload Queue */}
      {queue.length > 0 && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Progress summary */}
          {hasUploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Uploading {queue.filter(q => q.status === 'uploading' || q.status === 'pending').length} file(s)...</span>
            </div>
          )}
          {completedCount > 0 && !hasUploading && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 px-1">
              <CheckCircle className="h-4 w-4" />
              <span>{completedCount} file(s) uploaded successfully</span>
            </div>
          )}

          {/* File list */}
          <div className="rounded-xl border divide-y overflow-hidden">
            {queue.map((item, index) => (
              <div
                key={`${item.file.name}-${index}`}
                className={cn(
                  'flex items-center gap-3 p-3 transition-colors',
                  item.status === 'done' && 'bg-green-50/50 dark:bg-green-950/20',
                  item.status === 'error' && 'bg-red-50/50 dark:bg-red-950/20'
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  item.status === 'done' && 'bg-green-100 dark:bg-green-900/30',
                  item.status === 'error' && 'bg-red-100 dark:bg-red-900/30',
                  (item.status === 'pending' || item.status === 'uploading') && 'bg-muted'
                )}>
                  {item.status === 'done' ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : item.status === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.status === 'error' ? (
                      <span className="text-red-600 dark:text-red-400">{item.error}</span>
                    ) : item.status === 'done' ? (
                      'Uploaded successfully'
                    ) : item.status === 'uploading' ? (
                      'Uploading...'
                    ) : (
                      formatFileSize(item.file.size)
                    )}
                  </p>
                </div>
                {item.status === 'uploading' && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                )}
                {(item.status === 'pending' || item.status === 'error') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeFromQueue(item.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
