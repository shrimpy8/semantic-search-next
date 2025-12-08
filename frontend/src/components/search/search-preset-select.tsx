'use client';

import { useState, useMemo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { type RetrievalPreset } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Settings2, Target, Scale, Radar, SlidersHorizontal, Sparkles, Hash, RefreshCw } from 'lucide-react';

// Preset configurations matching backend PRESET_CONFIGS
const PRESET_PARAMS: Record<Exclude<RetrievalPreset, 'custom'>, { alpha: number; topKMultiplier: number; useReranker: boolean; method: string }> = {
  high_precision: {
    alpha: 0.85,
    topKMultiplier: 1.0,
    useReranker: true,
    method: 'Semantic-heavy',
  },
  balanced: {
    alpha: 0.5,
    topKMultiplier: 1.0,
    useReranker: true,
    method: 'Hybrid 50/50',
  },
  high_recall: {
    alpha: 0.3,
    topKMultiplier: 2.0,
    useReranker: true,
    method: 'Keyword-heavy',
  },
};

interface SearchPresetSelectProps {
  value: RetrievalPreset;
  onValueChange: (value: RetrievalPreset) => void;
  topK?: number;
  onTopKChange?: (value: number) => void;
  alpha?: number;
  onAlphaChange?: (value: number) => void;
  useReranker?: boolean;
  onUseRerankerChange?: (value: boolean) => void;
}

const presets: {
  value: RetrievalPreset;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Best for general use',
    icon: Scale,
  },
  {
    value: 'high_precision',
    label: 'High Precision',
    description: 'Fewer, more accurate results',
    icon: Target,
  },
  {
    value: 'high_recall',
    label: 'High Recall',
    description: 'More results, wider net',
    icon: Radar,
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Fine-tune parameters',
    icon: SlidersHorizontal,
  },
];

export function SearchPresetSelect({
  value,
  onValueChange,
  topK = 10,
  onTopKChange,
  alpha = 0.5,
  onAlphaChange,
  useReranker = true,
  onUseRerankerChange,
}: SearchPresetSelectProps) {
  const [localTopK, setLocalTopK] = useState(topK);
  const [localAlpha, setLocalAlpha] = useState(alpha);
  const [localUseReranker, setLocalUseReranker] = useState(useReranker);

  const handleTopKChange = (values: number[]) => {
    const newValue = values[0];
    setLocalTopK(newValue);
    onTopKChange?.(newValue);
  };

  const handleAlphaChange = (values: number[]) => {
    const newValue = values[0];
    setLocalAlpha(newValue);
    onAlphaChange?.(newValue);
  };

  const handleUseRerankerChange = (checked: boolean) => {
    setLocalUseReranker(checked);
    onUseRerankerChange?.(checked);
  };

  // Compute active parameters based on current selection
  const activeParams = useMemo(() => {
    if (value === 'custom') {
      return {
        alpha: localAlpha,
        useReranker: localUseReranker,
        method: localAlpha >= 0.7 ? 'Semantic-heavy' : localAlpha <= 0.3 ? 'Keyword-heavy' : 'Hybrid',
        topK: localTopK,
      };
    }
    const preset = PRESET_PARAMS[value];
    return {
      alpha: preset.alpha,
      useReranker: preset.useReranker,
      method: preset.method,
      topK: Math.round(topK * preset.topKMultiplier),
    };
  }, [value, localAlpha, localUseReranker, localTopK, topK]);

  return (
    <div className="w-full space-y-4">
      {/* Label with Active Parameters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          <span>Retrieval Mode</span>
        </div>

        {/* Active Parameters Display */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs font-normal gap-1 px-2 py-0.5">
            <Sparkles className="h-3 w-3" />
            <span>Alpha: {(activeParams.alpha * 100).toFixed(0)}%</span>
          </Badge>
          <Badge variant="secondary" className="text-xs font-normal gap-1 px-2 py-0.5">
            <Hash className="h-3 w-3" />
            <span>{activeParams.method}</span>
          </Badge>
          <Badge
            variant={activeParams.useReranker ? "default" : "outline"}
            className={cn(
              "text-xs font-normal gap-1 px-2 py-0.5",
              activeParams.useReranker && "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
            )}
          >
            <RefreshCw className="h-3 w-3" />
            <span>Rerank {activeParams.useReranker ? 'On' : 'Off'}</span>
          </Badge>
        </div>
      </div>

      {/* Radio Group */}
      <RadioGroup
        value={value}
        onValueChange={(val) => onValueChange(val as RetrievalPreset)}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {presets.map((preset) => {
          const Icon = preset.icon;
          const isSelected = value === preset.value;

          return (
            <Label
              key={preset.value}
              htmlFor={preset.value}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 cursor-pointer transition-all',
                'hover:bg-muted/50 hover:border-primary/30',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/20'
              )}
            >
              <RadioGroupItem
                value={preset.value}
                id={preset.value}
                className="sr-only"
              />
              <Icon className={cn(
                'h-5 w-5 transition-colors',
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isSelected && 'text-primary'
              )}>
                {preset.label}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {preset.description}
              </span>
            </Label>
          );
        })}
      </RadioGroup>

      {/* Custom Options Panel */}
      {value === 'custom' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-5">
          {/* Alpha Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="alpha" className="text-sm font-medium">
                Search Balance (Alpha)
              </Label>
              <span className="text-sm font-semibold text-primary tabular-nums">
                {(localAlpha * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              id="alpha"
              min={0}
              max={1}
              step={0.05}
              value={[localAlpha]}
              onValueChange={handleAlphaChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Keyword-based</span>
              <span>Semantic</span>
            </div>
          </div>

          {/* Top K Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-k" className="text-sm font-medium">
                Results to Retrieve (Top K)
              </Label>
              <span className="text-sm font-semibold text-primary tabular-nums">
                {localTopK}
              </span>
            </div>
            <Slider
              id="top-k"
              min={1}
              max={50}
              step={1}
              value={[localTopK]}
              onValueChange={handleTopKChange}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Number of document chunks to retrieve.
            </p>
          </div>

          {/* Reranking Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <Label htmlFor="reranker" className="text-sm font-medium">
                Enable Reranking
              </Label>
              <p className="text-xs text-muted-foreground">
                Improve result quality with AI reranking
              </p>
            </div>
            <Switch
              id="reranker"
              checked={localUseReranker}
              onCheckedChange={handleUseRerankerChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
