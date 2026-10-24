'use client';

import { MotionConfig } from 'framer-motion';
import * as React from 'react';

import { LibraryProvider } from '@/components/providers/library-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Client provider tree, mounted once by the root layout.
 *
 * `MotionConfig reducedMotion="user"` makes every Framer Motion animation in the
 * app honour `prefers-reduced-motion` without each component checking for itself.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LibraryProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={320} skipDelayDuration={180}>
            {children}
          </TooltipProvider>
        </MotionConfig>
      </LibraryProvider>
    </ThemeProvider>
  );
}
