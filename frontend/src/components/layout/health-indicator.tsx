'use client';

import { useHealthCheck } from '@/hooks';
import { cn } from '@/lib/utils';

export function HealthIndicator() {
  const { data, isLoading, isError } = useHealthCheck();

  const getStatus = () => {
    if (isLoading) return 'loading';
    if (isError) return 'error';
    if (data?.status === 'healthy') return 'healthy';
    return 'error';
  };

  const status = getStatus();

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'loading' && 'bg-yellow-500 animate-pulse',
          status === 'healthy' && 'bg-green-500',
          status === 'error' && 'bg-red-500'
        )}
      />
      <span className="hidden sm:inline">
        {status === 'loading' && 'Connecting...'}
        {status === 'healthy' && 'API Connected'}
        {status === 'error' && 'API Offline'}
      </span>
    </div>
  );
}
