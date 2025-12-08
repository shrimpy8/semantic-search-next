'use client';

import { useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface ZoneConfig {
  min: number;
  max: number;
  color: 'green' | 'yellow' | 'red';
  label: string;
}

interface RulerConfig {
  /** Interval for small tick marks */
  smallInterval: number;
  /** Interval for large tick marks (should be multiple of smallInterval) */
  largeInterval: number;
  /** Show labels at large tick marks */
  showLabels?: boolean;
  /** Specific values to label (if not set, labels all large intervals) */
  labelValues?: number[];
}

interface ColorZoneSliderProps {
  id: string;
  label: string;
  description?: string;
  /** Optional JSX description node for rich formatting (takes precedence over description) */
  descriptionNode?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  zones: ZoneConfig[];
  unit?: string;
  showWarning?: boolean;
  /** Show ruler markings below the slider */
  showRuler?: boolean;
  /** Ruler configuration for tick intervals */
  rulerConfig?: RulerConfig;
}

export function ColorZoneSlider({
  id,
  label,
  description,
  descriptionNode,
  value,
  onChange,
  min,
  max,
  step = 1,
  zones,
  unit = '',
  showWarning = true,
  showRuler = false,
  rulerConfig,
}: ColorZoneSliderProps) {
  const currentZone = useMemo(() => {
    return zones.find((zone) => value >= zone.min && value <= zone.max) ?? zones[0];
  }, [value, zones]);

  const zoneColors = {
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-600 dark:text-green-400',
      slider: '[&_[role=slider]]:bg-green-500 [&_[role=slider]]:border-green-600',
      track: '[&_.relative]:bg-green-500/20 [&_[data-orientation=horizontal]>span:first-child]:bg-green-500',
      icon: CheckCircle,
    },
    yellow: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-600 dark:text-yellow-400',
      slider: '[&_[role=slider]]:bg-yellow-500 [&_[role=slider]]:border-yellow-600',
      track: '[&_.relative]:bg-yellow-500/20 [&_[data-orientation=horizontal]>span:first-child]:bg-yellow-500',
      icon: AlertTriangle,
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-600 dark:text-red-400',
      slider: '[&_[role=slider]]:bg-red-500 [&_[role=slider]]:border-red-600',
      track: '[&_.relative]:bg-red-500/20 [&_[data-orientation=horizontal]>span:first-child]:bg-red-500',
      icon: AlertCircle,
    },
  };

  const colors = zoneColors[currentZone.color];
  const Icon = colors.icon;

  // Calculate zone positions for gradient background
  const zoneGradient = useMemo(() => {
    const totalRange = max - min;
    const stops = zones.map((zone) => {
      const startPercent = ((zone.min - min) / totalRange) * 100;
      const endPercent = ((zone.max - min) / totalRange) * 100;
      const colorMap = {
        green: 'rgb(34, 197, 94, 0.3)',
        yellow: 'rgb(234, 179, 8, 0.3)',
        red: 'rgb(239, 68, 68, 0.3)',
      };
      return `${colorMap[zone.color]} ${startPercent}%, ${colorMap[zone.color]} ${endPercent}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [zones, min, max]);

  // Generate ruler tick marks
  const rulerTicks = useMemo(() => {
    if (!showRuler || !rulerConfig) return [];

    const { smallInterval, largeInterval, showLabels = true, labelValues } = rulerConfig;
    const ticks: Array<{ value: number; isLarge: boolean; showLabel: boolean; percent: number }> = [];
    const totalRange = max - min;

    for (let i = min; i <= max; i += smallInterval) {
      const isLarge = i % largeInterval === 0;
      const percent = ((i - min) / totalRange) * 100;
      const showLabel = isLarge && showLabels && (
        !labelValues || labelValues.includes(i)
      );
      ticks.push({ value: i, isLarge, showLabel, percent });
    }

    return ticks;
  }, [showRuler, rulerConfig, min, max]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <div className={cn('flex items-center gap-1.5 text-sm font-semibold tabular-nums', colors.text)}>
          <Icon className="h-4 w-4" />
          <span>
            {value}
            {unit}
          </span>
        </div>
      </div>

      {/* Slider with gradient background */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full h-2 top-1/2 -translate-y-1/2 opacity-50"
          style={{ background: zoneGradient }}
        />
        <Slider
          id={id}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          className={cn('relative z-10', colors.slider, colors.track)}
        />
      </div>

      {/* Ruler markings */}
      {showRuler && rulerTicks.length > 0 && (
        <div className="relative h-6 mt-1">
          {/* Tick marks */}
          <div className="absolute inset-x-0 top-0 h-4">
            {rulerTicks.map((tick) => (
              <div
                key={tick.value}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${tick.percent}%`, transform: 'translateX(-50%)' }}
              >
                {/* Tick line */}
                <div
                  className={cn(
                    'w-px bg-muted-foreground/40',
                    tick.isLarge ? 'h-3' : 'h-1.5'
                  )}
                />
              </div>
            ))}
          </div>
          {/* Labels for large ticks */}
          <div className="absolute inset-x-0 top-3 h-3">
            {rulerTicks
              .filter((tick) => tick.showLabel)
              .map((tick) => (
                <span
                  key={tick.value}
                  className="absolute text-[9px] text-muted-foreground/70 tabular-nums"
                  style={{
                    left: `${tick.percent}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {tick.value}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Zone labels - positioned at zone end boundaries */}
      <div className="relative h-4 text-[10px] text-muted-foreground">
        {zones.map((zone, i) => {
          const totalRange = max - min;
          // Position label at the end of each zone (except the last one which goes at the end)
          const position = ((zone.max - min) / totalRange) * 100;
          return (
            <span
              key={i}
              className={cn(
                'absolute transition-colors whitespace-nowrap',
                currentZone === zone && colors.text
              )}
              style={{
                left: `${position}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {zone.label}
            </span>
          );
        })}
      </div>

      {/* Warning/Info message */}
      {showWarning && currentZone.color !== 'green' && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg p-2.5 text-xs',
            colors.bg,
            colors.border,
            'border'
          )}
        >
          <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', colors.text)} />
          <div className={colors.text}>
            {currentZone.color === 'yellow' && (
              <span>
                <strong>Caution:</strong> {description || 'Value is outside the recommended range.'}
              </span>
            )}
            {currentZone.color === 'red' && (
              <span>
                <strong>Warning:</strong> {description || 'Value may cause performance issues.'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Green zone info */}
      {showWarning && currentZone.color === 'green' && (descriptionNode || description) && (
        <p className="text-xs text-muted-foreground">{descriptionNode || description}</p>
      )}
    </div>
  );
}
