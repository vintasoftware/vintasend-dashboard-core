'use client';

/**
 * Named hooks for each endpoint.
 *
 * These are thin wrappers over the `openapi-react-query` client, which already
 * derives its query keys, inputs, and results from the generated schema. They
 * exist for discoverability and for the shared `client` override; anything they
 * do not cover is still reachable through `useVintaSendApi().useQuery(...)`.
 *
 * Query keys are `[method, path, init]`, so a mutation can invalidate a whole
 * endpoint with `queryClient.invalidateQueries({ queryKey: ['get', path] })` —
 * which is what `NOTIFICATION_LIST_PATHS` below is for.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { VintaSendClient, VintaSendQueryClient } from '../api/query.js';
import type { FilterCapabilities, NotificationListQuery } from '../api/types.js';
import { useVintaSendClient } from '../provider.js';

export type WithClient = {
  /** Overrides the client from context, for a component outside the provider. */
  client?: VintaSendClient;
};

/** The raw generated hooks, for endpoints these wrappers do not name. */
export function useVintaSendApi(options: WithClient = {}): VintaSendQueryClient {
  return useVintaSendClient(options.client).api;
}

/**
 * Every path that returns a page of notifications. A write to one notification
 * can change any of these lists, so they are invalidated together.
 */
export const NOTIFICATION_LIST_PATHS = [
  '/api/v1/notifications',
  '/api/v1/notifications/pending',
  '/api/v1/notifications/future',
  '/api/v1/notifications/one-off',
] as const;

/**
 * Query options passed straight through to TanStack Query. Typed loosely on
 * purpose: the exact option type depends on the endpoint's response, and the
 * generated client narrows it at the call site.
 */
type QueryOptions = Record<string, unknown>;

/** A page of notifications for a filter set. Pass `filters.query`. */
export function useNotificationsQuery(
  query: NotificationListQuery,
  options: WithClient & { query?: QueryOptions } = {},
) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/notifications',
    { params: { query } },
    options.query,
  );
}

/** Notifications awaiting send. */
export function usePendingNotifications(
  query: { page?: number; pageSize?: number } = {},
  options: WithClient & { query?: QueryOptions } = {},
) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/notifications/pending',
    { params: { query } },
    options.query,
  );
}

/** Notifications scheduled for the future. */
export function useFutureNotifications(
  query: { page?: number; pageSize?: number } = {},
  options: WithClient & { query?: QueryOptions } = {},
) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/notifications/future',
    { params: { query } },
    options.query,
  );
}

/** Notifications addressed to a raw email or phone rather than a user. */
export function useOneOffNotifications(
  query: { page?: number; pageSize?: number } = {},
  options: WithClient & { query?: QueryOptions } = {},
) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/notifications/one-off',
    { params: { query } },
    options.query,
  );
}

/**
 * One notification with its context payloads. Pass `null` to hold the query
 * until an id is picked — a detail panel that is not open yet, say.
 */
export function useNotification(
  id: string | null | undefined,
  options: WithClient & { query?: QueryOptions } = {},
) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/notifications/{id}',
    { params: { path: { id: id ?? '' } } },
    { enabled: Boolean(id), ...options.query },
  );
}

/**
 * The notification's templates, rendered at the commit it was sent from.
 * Fails with `PREVIEW_UNAVAILABLE` when no commit was recorded.
 */
export function useNotificationPreview(
  id: string | null | undefined,
  options: WithClient & { query?: QueryOptions } = {},
) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/notifications/{id}/preview',
    { params: { path: { id: id ?? '' } } },
    { enabled: Boolean(id), ...options.query },
  );
}

/**
 * What the configured backend can filter and sort by. Use it to hide
 * affordances the backend cannot honour; a missing key means "supported".
 *
 * Capabilities change only when the service is reconfigured, so this is cached
 * for an hour by default.
 */
export function useFilterCapabilities(options: WithClient & { query?: QueryOptions } = {}) {
  return useVintaSendApi(options).useQuery(
    'get',
    '/api/v1/capabilities',
    {},
    { staleTime: 60 * 60 * 1000, ...options.query },
  );
}

/** Liveness probe. Unauthenticated. */
export function useHealth(options: WithClient & { query?: QueryOptions } = {}) {
  return useVintaSendApi(options).useQuery('get', '/health', {}, options.query);
}

/**
 * Reads a capability the way the API documents it: absent means supported.
 * `capabilities` is the payload of `useFilterCapabilities`.
 */
export function supportsCapability(
  capabilities: FilterCapabilities | undefined,
  key: string,
): boolean {
  return capabilities?.[key] ?? true;
}

/**
 * Invalidates every notification list. Returned as a callback so mutations —
 * and your own imperative code — can refresh the table after a write.
 */
export function useInvalidateNotifications() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all(
      NOTIFICATION_LIST_PATHS.map((path) =>
        queryClient.invalidateQueries({ queryKey: ['get', path] }),
      ),
    );
  }, [queryClient]);
}
