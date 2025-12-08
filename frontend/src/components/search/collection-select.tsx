'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCollections } from '@/hooks';
import { Loader2 } from 'lucide-react';

interface CollectionSelectProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
}

export function CollectionSelect({
  value,
  onValueChange,
}: CollectionSelectProps) {
  const { data, isLoading } = useCollections();

  if (isLoading) {
    return (
      <div className="flex h-9 w-[180px] items-center justify-center rounded-md border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Select
      value={value ?? 'all'}
      onValueChange={(v) => onValueChange(v === 'all' ? undefined : v)}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All collections" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All collections</SelectItem>
        {data?.data.map((collection) => (
          <SelectItem key={collection.id} value={collection.id}>
            {collection.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
