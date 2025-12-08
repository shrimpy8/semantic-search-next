/**
 * Debug logging utility for frontend.
 *
 * Enable debug mode by setting NEXT_PUBLIC_DEBUG=true in .env.local
 *
 * Usage:
 *   import { debug } from '@/lib/debug';
 *   debug.log('API', 'Fetching data', { endpoint, params });
 *   debug.error('Search', 'Failed to search', error);
 *   debug.warn('Settings', 'Using default value');
 *   debug.group('API Request', () => {
 *     debug.log('Request', url);
 *     debug.log('Response', data);
 *   });
 */

const IS_DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

// Color codes for different log categories
const COLORS: Record<string, string> = {
  API: '#3b82f6',      // blue
  Search: '#10b981',   // green
  Settings: '#f59e0b', // amber
  Store: '#8b5cf6',    // purple
  Hook: '#ec4899',     // pink
  Component: '#06b6d4', // cyan
  Error: '#ef4444',    // red
  Warn: '#f97316',     // orange
};

function getColor(category: string): string {
  return COLORS[category] || '#6b7280'; // gray default
}

function formatArgs(category: string, message: string, ...args: unknown[]): unknown[] {
  if (typeof window === 'undefined') {
    // Server-side (Node.js) - no colors
    return [`[${category}] ${message}`, ...args];
  }

  // Browser - use colors
  return [
    `%c[${category}]%c ${message}`,
    `color: ${getColor(category)}; font-weight: bold;`,
    'color: inherit;',
    ...args,
  ];
}

export const debug = {
  /**
   * Check if debug mode is enabled
   */
  get enabled(): boolean {
    return IS_DEBUG;
  },

  /**
   * Log a debug message with category
   */
  log(category: string, message: string, ...args: unknown[]): void {
    if (!IS_DEBUG) return;
    console.log(...formatArgs(category, message, ...args));
  },

  /**
   * Log a warning message
   */
  warn(category: string, message: string, ...args: unknown[]): void {
    if (!IS_DEBUG) return;
    console.warn(...formatArgs(category, message, ...args));
  },

  /**
   * Log an error message (always logs, even in production)
   */
  error(category: string, message: string, ...args: unknown[]): void {
    // Errors always log
    console.error(...formatArgs(category, message, ...args));
  },

  /**
   * Group related logs together
   */
  group(label: string, fn: () => void): void {
    if (!IS_DEBUG) return;
    console.group(label);
    fn();
    console.groupEnd();
  },

  /**
   * Log a table (useful for arrays/objects)
   */
  table(category: string, data: unknown): void {
    if (!IS_DEBUG) return;
    console.log(`%c[${category}]`, `color: ${getColor(category)}; font-weight: bold;`);
    console.table(data);
  },

  /**
   * Time an operation
   */
  time(label: string): void {
    if (!IS_DEBUG) return;
    console.time(label);
  },

  timeEnd(label: string): void {
    if (!IS_DEBUG) return;
    console.timeEnd(label);
  },
};

// Log debug mode status on initialization (client-side only)
if (typeof window !== 'undefined' && IS_DEBUG) {
  console.log(
    '%c[Debug Mode Enabled]%c Frontend debug logging is active. Set NEXT_PUBLIC_DEBUG=false to disable.',
    'color: #10b981; font-weight: bold; font-size: 14px;',
    'color: #6b7280;'
  );
}
