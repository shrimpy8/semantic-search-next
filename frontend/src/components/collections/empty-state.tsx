'use client';

import { FolderOpen, Sparkles, ArrowRight } from 'lucide-react';
import { CreateCollectionDialog } from './create-collection-dialog';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <FolderOpen className="h-10 w-10 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-2">Create your first collection</h2>
      <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
        Collections help you organize documents by topic. Upload PDFs and text files, then search across them with AI-powered semantic understanding.
      </p>

      <CreateCollectionDialog
        trigger={
          <Button size="lg" className="rounded-xl group">
            <Sparkles className="mr-2 h-4 w-4" />
            Create Collection
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        }
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-2xl">
        <StepCard number={1} title="Create" description="Name your collection and add an optional description" />
        <StepCard number={2} title="Upload" description="Add PDF or TXT files to your collection" />
        <StepCard number={3} title="Search" description="Find exactly what you need with AI" />
      </div>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold mb-3">
        {number}
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
