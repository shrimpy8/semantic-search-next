'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, BarChart3, Lightbulb, FlaskConical } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { HealthIndicator } from './health-indicator';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

function NavLink({ href, active, children, className }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-2 text-sm font-medium rounded-lg transition-all',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        className
      )}
    >
      {children}
    </Link>
  );
}

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
            <NavLink href="/" active={isActive('/') && !isActive('/collections')}>
              Search
            </NavLink>
            <NavLink href="/collections" active={isActive('/collections')}>
              Collections
            </NavLink>
            <NavLink href="/analytics" active={isActive('/analytics')} className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </NavLink>
            <NavLink href="/evals" active={isActive('/evals')} className="flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Evals
            </NavLink>
            <NavLink href="/how-it-works" active={isActive('/how-it-works')} className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              How it Works
            </NavLink>
            <NavLink href="/settings" active={isActive('/settings')}>
              Settings
            </NavLink>
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
