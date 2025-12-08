'use client';

import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unverified';

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  coveragePercent?: number;
  verifiedClaims?: number;
  totalClaims?: number;
  className?: string;
}

const confidenceConfig = {
  high: {
    icon: CheckCircle2,
    label: 'Verified',
    bgColor: 'bg-emerald-100 dark:bg-emerald-950/50',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    iconColor: 'text-emerald-500',
    description: 'All claims are supported by your documents',
  },
  medium: {
    icon: AlertCircle,
    label: 'Mostly Verified',
    bgColor: 'bg-blue-100 dark:bg-blue-950/50',
    textColor: 'text-blue-700 dark:text-blue-400',
    iconColor: 'text-blue-500',
    description: 'Most claims are supported by your documents',
  },
  low: {
    icon: AlertTriangle,
    label: 'Low Confidence',
    bgColor: 'bg-amber-100 dark:bg-amber-950/50',
    textColor: 'text-amber-700 dark:text-amber-400',
    iconColor: 'text-amber-500',
    description: 'Some claims could not be verified',
  },
  unverified: {
    icon: HelpCircle,
    label: 'Unverified',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    textColor: 'text-gray-700 dark:text-gray-400',
    iconColor: 'text-gray-500',
    description: 'Unable to verify claims against documents',
  },
};

export function ConfidenceBadge({
  confidence,
  coveragePercent,
  verifiedClaims,
  totalClaims,
  className,
}: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence];
  const Icon = config.icon;

  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      <p className="font-medium">{config.description}</p>
      {coveragePercent !== undefined && totalClaims !== undefined && totalClaims > 0 && (
        <p className="text-xs text-muted-foreground">
          {verifiedClaims} of {totalClaims} claims verified ({coveragePercent}%)
        </p>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              config.bgColor,
              config.textColor,
              className
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
