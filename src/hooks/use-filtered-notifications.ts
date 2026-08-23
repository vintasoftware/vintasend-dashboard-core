'use client';

/**
 * The URL and the list endpoint, joined.
 *
 * This is the hook most dashboards want: filters read from the URL, fed to the
 * generated TanStack Query hook, with pagination helpers that know whether a
 * next page exists. Everything it returns is also available piecemeal from
 * `useNotificationFilters` and `useNotificationsQuery`, for a UI that needs to
 * arrange the two differently.
 *
 * ```tsx
 * const { notifications, filters, setFilter, nextPage, isLoading } =
 *   useFilteredNotifications({ router: useNextRouterAdapter() });
 * ```
 */

import { useCallback, useMemo } from 'react';
import type { Notification } from '../api/types.js';
import {
  type NotificationFiltersState,
  type UseNotificationFiltersOptions,
  useNotificationFilters,
} from '../filters/use-notification-filters.js';
import { useNotificationsQuery, type WithClient } from './queries.js';

export type UseFilteredNotificationsOptions = UseNotificationFiltersOptions &
  WithClient & {
    /** Options forwarded to the underlying TanStack query. */
    query?: Record<string, unknown>;
  };

export type UseFilteredNotificationsResult = NotificationFiltersState & {
  /** The current page's rows, or an empty array while loading or on error. */
  notifications: Notification[];

  /** True when the page came back full, so another page may exist. */
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: () => void;
  previousPage: () => void;

  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;

  /** The full query result, for anything the fields above do not expose. */
  result: ReturnType<typeof useNotificationsQuery>;
};

export function useFilteredNotifications(
  options: UseFilteredNotificationsOptions = {},
): UseFilteredNotificationsResult {
  const { client, query: queryOptions, ...filterOptions } = options;

  const filters = useNotificationFilters(filterOptions);

  const result = useNotificationsQuery(filters.query, {
    ...(client ? { client } : {}),
    ...(queryOptions ? { query: queryOptions } : {}),
  });

  const notifications = useMemo<Notification[]>(() => result.data?.data ?? [], [result.data]);

  // The API reports `hasMore` rather than a total count, because a backend is
  // not required to be able to count.
  const hasNextPage = result.data?.hasMore ?? false;
  const hasPreviousPage = filters.page > 1;

  const { page, setPage } = filters;

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(page + 1);
    }
  }, [hasNextPage, page, setPage]);

  const previousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page, setPage]);

  const refetch = useCallback(() => {
    void result.refetch();
  }, [result]);

  return {
    ...filters,
    notifications,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isError: result.isError,
    error: result.error,
    refetch,
    result,
  };
}
