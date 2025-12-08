'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, BarChart3 } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { HealthIndicator } from './health-indicator';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight hidden sm:inline-block">
              Semantic Search
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-all',
                isActive('/') && !isActive('/collections')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Search
            </Link>
            <Link
              href="/collections"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-all',
                isActive('/collections')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Collections
            </Link>
            <Link
              href="/analytics"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5',
                isActive('/analytics')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </Link>
            <Link
              href="/settings"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-all',
                isActive('/settings')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Settings
            </Link>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <HealthIndicator />
          <div className="h-4 w-px bg-border hidden sm:block" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
