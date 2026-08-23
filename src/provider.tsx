'use client';

/**
 * Context that carries the client to the hooks.
 *
 * This deliberately does not create a `QueryClientProvider`: the app owns its
 * TanStack Query configuration, and nesting a second query client here would
 * silently split its cache. Render `VintaSendProvider` inside your own
 * `QueryClientProvider`.
 */

import { createContext, createElement, type ReactNode, useContext } from 'react';
import type { VintaSendClient } from './api/query.js';

const VintaSendClientContext = createContext<VintaSendClient | null>(null);

export type VintaSendProviderProps = {
  client: VintaSendClient;
  children: ReactNode;
};

export function VintaSendProvider({ client, children }: VintaSendProviderProps) {
  return createElement(VintaSendClientContext.Provider, { value: client }, children);
}

/**
 * The client from context. Every hook in this package calls this, and each of
 * them also accepts a `client` option that takes precedence — which is what
 * lets a component be used outside the provider, or against a second API.
 */
export function useVintaSendClient(override?: VintaSendClient): VintaSendClient {
  const fromContext = useContext(VintaSendClientContext);
  const client = override ?? fromContext;

  if (!client) {
    throw new Error(
      'No VintaSend client found. Wrap your app in <VintaSendProvider client={createVintaSendClient(...)}> ' +
        'or pass a `client` option to the hook.',
    );
  }

  return client;
}
