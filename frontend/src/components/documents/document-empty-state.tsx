'use client';

import { FileText, Upload, ArrowUp, Sparkles } from 'lucide-react';

export function DocumentEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-muted-foreground/20">
      {/* Arrow pointing up to dropzone */}
      <div className="flex items-center gap-1 text-primary mb-4 animate-bounce">
        <ArrowUp className="h-5 w-5" />
        <span className="text-sm font-medium">Drop files above</span>
      </div>

      {/* Glowing icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <FileText className="h-8 w-8 text-primary" />
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
      <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
        Upload PDF or TXT files to this collection. Your documents will be automatically
        processed and indexed for semantic search.
      </p>

      {/* Features */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5 text-primary" />
          <span>Drag & drop</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>PDF & TXT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Auto-indexed</span>
        </div>
      </div>
    </div>
  );
}
