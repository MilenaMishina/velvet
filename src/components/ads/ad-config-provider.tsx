'use client';

import * as React from 'react';

import { DEFAULT_AD_CONFIG, type AdConfig } from '@/lib/ads';

/**
 * Carries the operator's ad switches from the server-rendered layout down to the
 * slots, which have to be client components: whether a zone filled is only knowable
 * in the browser, so that decision cannot be made on the server.
 */
const AdConfigContext = React.createContext<AdConfig>(DEFAULT_AD_CONFIG);

export function AdConfigProvider({ value, children }: { value: AdConfig; children: React.ReactNode }) {
  return <AdConfigContext.Provider value={value}>{children}</AdConfigContext.Provider>;
}

export function useAdConfig(): AdConfig {
  return React.useContext(AdConfigContext);
}
