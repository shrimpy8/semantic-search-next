'use client';

import { useSetupValidation } from '@/hooks';
import { AlertCircle, AlertTriangle, CheckCircle, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function SetupStatusBanner() {
  const { data: validation, isLoading, isError } = useSetupValidation();

  // Don't show anything while loading or if there's an error fetching
  if (isLoading || isError) {
    return null;
  }

  // Don't show if everything is ready with no warnings
  const warningCount = validation?.checks.filter(c => c.status === 'warning').length ?? 0;

  if (validation?.ready && warningCount === 0) {
    return null;
  }

  // Show error state (critical issues)
  if (!validation?.ready) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-destructive">Setup Required</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {validation?.summary ?? 'Configuration is incomplete'}
            </p>
            <div className="mt-3 space-y-1.5">
              {validation?.checks
                .filter(c => c.status === 'error')
                .map((check, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{check.name}:</span>{' '}
                      <span className="text-muted-foreground">{check.message}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1 text-sm font-medium text-destructive hover:underline shrink-0"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Show warning state (non-critical issues)
  if (warningCount > 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-amber-700 dark:text-amber-300">Configuration Warnings</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {validation?.summary}
            </p>
            <div className="mt-3 space-y-1.5">
              {validation?.checks
                .filter(c => c.status === 'warning')
                .map((check, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{check.name}:</span>{' '}
                      <span className="text-muted-foreground">{check.message}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline shrink-0"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

// Compact version for inline use
export function SetupStatusIndicator({ className }: { className?: string }) {
  const { data: validation, isLoading } = useSetupValidation();

  if (isLoading) {
    return null;
  }

  const warningCount = validation?.checks.filter(c => c.status === 'warning').length ?? 0;
  const errorCount = validation?.checks.filter(c => c.status === 'error').length ?? 0;

  if (validation?.ready && warningCount === 0) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400", className)}>
        <CheckCircle className="h-3.5 w-3.5" />
        <span>Ready</span>
      </div>
    );
  }

  if (!validation?.ready) {
    return (
      <Link
        href="/settings"
        className={cn(
          "flex items-center gap-1.5 text-xs text-destructive hover:underline",
          className
        )}
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{errorCount} issue{errorCount !== 1 ? 's' : ''}</span>
      </Link>
    );
  }

  if (warningCount > 0) {
    return (
      <Link
        href="/settings"
        className={cn(
          "flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline",
          className
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
      </Link>
    );
  }

  return null;
}
