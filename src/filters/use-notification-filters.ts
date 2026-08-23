'use client';

/**
 * Notification filters, held in the URL.
 *
 * The URL is the single source of truth: there is no local mirror of the filter
 * state to fall out of sync with it, so a filtered view is shareable, survives
 * a reload, and the back button steps through it. Every setter writes to the
 * router and the next render reads the result back.
 */

import { useCallback, useMemo } from 'react';
import type {
  NotificationFilters,
  NotificationListQuery,
  NotificationOrderByField,
  NotificationOrderDirection,
} from '../api/types.js';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './keys.js';
import {
  applyNotificationFilters,
  hasActiveFilters as computeHasActiveFilters,
  parseNotificationFilters,
  parseNotificationPagination,
  pruneFilters,
} from './parse.js';
import { type RouterAdapter, useHistoryRouterAdapter } from './router.js';

export type UseNotificationFiltersOptions = {
  /**
   * Where the filters live. Defaults to the History API adapter; a Next app
   * should pass `useNextRouterAdapter()` from `vintasend-dashboard-core/next`.
   */
  router?: RouterAdapter;

  /**
   * Applied when the URL does not set a filter. A dashboard scoped to one
   * tenant, for example, can pin `{ tenant }` here rather than requiring it in
   * every link. `clearFilters` returns to these, not to nothing.
   */
  defaultFilters?: NotificationFilters;

  /** Page size when the URL does not carry one. */
  defaultPageSize?: number;

  /**
   * Whether a change adds a history entry. Filters default to `'replace'`, so
   * typing in a text filter does not fill the back stack.
   */
  navigationMode?: 'replace' | 'push';
};

export type NotificationFiltersState = {
  /** Current filters: the URL's values over `defaultFilters`. */
  filters: NotificationFilters;
  page: number;
  pageSize: number;

  /** Filters and pagination together, ready to hand to the list endpoint. */
  query: NotificationListQuery;

  /** True when a narrowing filter is set. Ordering alone does not count. */
  hasActiveFilters: boolean;

  /** The full query string, including parameters this hook does not own. */
  searchParams: URLSearchParams;

  /** Replaces every filter. Accepts an updater, like `useState`. */
  setFilters: (
    next: NotificationFilters | ((previous: NotificationFilters) => NotificationFilters),
  ) => void;

  /** Sets or clears one filter, leaving the rest alone. */
  setFilter: <K extends keyof NotificationFilters>(
    key: K,
    value: NotificationFilters[K] | undefined,
  ) => void;

  /** Merges a partial update; `undefined` clears a key. */
  patchFilters: (patch: Partial<NotificationFilters>) => void;

  /** Returns to `defaultFilters`, keeping the current ordering and page size. */
  clearFilters: () => void;

  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;

  /** Sets ordering, or clears it when called with no field. */
  setSort: (field?: NotificationOrderByField, direction?: NotificationOrderDirection) => void;
};

function clampPageSize(pageSize: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(pageSize)));
}

export function useNotificationFilters(
  options: UseNotificationFiltersOptions = {},
): NotificationFiltersState {
  const { defaultFilters, defaultPageSize, navigationMode = 'replace' } = options;

  // Called unconditionally to respect the rules of hooks; ignored when the
  // caller supplied a router of their own.
  const historyRouter = useHistoryRouterAdapter();
  const router = options.router ?? historyRouter;

  const { searchParams, setSearchParams } = router;

  const filters = useMemo(
    () => ({ ...pruneFilters(defaultFilters ?? {}), ...parseNotificationFilters(searchParams) }),
    [searchParams, defaultFilters],
  );

  const { page, pageSize } = useMemo(
    () =>
      parseNotificationPagination(
        searchParams,
        defaultPageSize === undefined ? {} : { pageSize: clampPageSize(defaultPageSize) },
      ),
    [searchParams, defaultPageSize],
  );

  const query = useMemo<NotificationListQuery>(
    () => ({ ...filters, page, pageSize }),
    [filters, page, pageSize],
  );

  const commit = useCallback(
    (nextFilters: NotificationFilters, nextPage: number, nextPageSize: number) => {
      setSearchParams(
        applyNotificationFilters(searchParams, nextFilters, {
          page: nextPage,
          pageSize: nextPageSize,
        }),
        { replace: navigationMode === 'replace' },
      );
    },
    [searchParams, setSearchParams, navigationMode],
  );

  const setFilters = useCallback<NotificationFiltersState['setFilters']>(
    (next) => {
      const resolved = typeof next === 'function' ? next(filters) : next;

      // A narrower result set makes the current page number meaningless, and
      // page 4 of a 2-page result is an empty table rather than an error.
      commit(pruneFilters(resolved), DEFAULT_PAGE, pageSize);
    },
    [commit, filters, pageSize],
  );

  const patchFilters = useCallback<NotificationFiltersState['patchFilters']>(
    (patch) => {
      setFilters({ ...filters, ...patch });
    },
    [setFilters, filters],
  );

  const setFilter = useCallback<NotificationFiltersState['setFilter']>(
    (key, value) => {
      patchFilters({ [key]: value } as Partial<NotificationFilters>);
    },
    [patchFilters],
  );

  const clearFilters = useCallback(() => {
    // Back to the defaults, but ordering is a view preference rather than a
    // filter, so clearing the filters leaves the chosen sort in place.
    const cleared: NotificationFilters = { ...pruneFilters(defaultFilters ?? {}) };

    if (filters.orderByField !== undefined) {
      cleared.orderByField = filters.orderByField;
    }

    if (filters.orderByDirection !== undefined) {
      cleared.orderByDirection = filters.orderByDirection;
    }

    commit(cleared, DEFAULT_PAGE, pageSize);
  }, [commit, defaultFilters, filters, pageSize]);

  const setPage = useCallback(
    (nextPage: number) => {
      commit(filters, Math.max(1, Math.trunc(nextPage)), pageSize);
    },
    [commit, filters, pageSize],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      // Page numbers do not survive a resize, so go back to the first one.
      commit(filters, DEFAULT_PAGE, clampPageSize(nextPageSize));
    },
    [commit, filters],
  );

  const setSort = useCallback<NotificationFiltersState['setSort']>(
    (field, direction) => {
      const next: NotificationFilters = { ...filters };

      if (field === undefined) {
        delete next.orderByField;
        delete next.orderByDirection;
      } else {
        next.orderByField = field;
        next.orderByDirection = direction ?? 'desc';
      }

      commit(next, DEFAULT_PAGE, pageSize);
    },
    [commit, filters, pageSize],
  );

  return useMemo(
    () => ({
      filters,
      page,
      pageSize,
      query,
      hasActiveFilters: computeHasActiveFilters(filters),
      searchParams,
      setFilters,
      setFilter,
      patchFilters,
      clearFilters,
      setPage,
      setPageSize,
      setSort,
    }),
    [
      filters,
      page,
      pageSize,
      query,
      searchParams,
      setFilters,
      setFilter,
      patchFilters,
      clearFilters,
      setPage,
      setPageSize,
      setSort,
    ],
  );
}

export { DEFAULT_PAGE, DEFAULT_PAGE_SIZE };
