/**
 * Reading filters out of a URL and writing them back.
 *
 * A URL is user-editable, so nothing here trusts it: a value that is not a
 * legal member of its filter is dropped rather than forwarded, which keeps a
 * hand-typed `?status=nope` from turning into a 400. Pagination is clamped to
 * the bounds in `openapi.yaml` for the same reason.
 *
 * These are plain functions over `URLSearchParams`, usable on a server (a Next
 * `searchParams` object, an Express request) as well as in the browser.
 */

import type {
  NotificationFilters,
  NotificationListQuery,
  NotificationOrderByField,
  NotificationOrderDirection,
  NotificationStatus,
  NotificationType,
} from '../api/types.js';
import {
  DATE_FILTER_KEYS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  NARROWING_FILTER_KEYS,
  NOTIFICATION_FILTER_KEYS,
  NOTIFICATION_ORDER_BY_FIELDS,
  NOTIFICATION_ORDER_DIRECTIONS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  NUMBER_FILTER_KEYS,
  STRING_FILTER_KEYS,
} from './keys.js';

/**
 * Anything that can stand in for a query string. The record form is what a Next
 * server component receives as `searchParams`; a repeated parameter keeps its
 * first value, since every filter is single-valued.
 */
export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | string;

export type PaginationState = {
  /** 1-indexed, as on the wire. */
  page: number;
  pageSize: number;
};

export function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) {
    return input;
  }

  if (typeof input === 'string') {
    return new URLSearchParams(input);
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    const first = Array.isArray(value) ? value[0] : value;

    if (first !== undefined) {
      params.set(key, first);
    }
  }

  return params;
}

function readString(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();

  return value ? value : undefined;
}

function readEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = readString(params, key);

  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function readInteger(
  params: URLSearchParams,
  key: string,
  { min, max }: { min: number; max?: number },
): number | undefined {
  const raw = readString(params, key);

  if (raw === undefined) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min) {
    return undefined;
  }

  return max !== undefined && value > max ? max : value;
}

function readTimestamp(params: URLSearchParams, key: string): string | undefined {
  const value = readString(params, key);

  return value !== undefined && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/**
 * Reads every filter the contract defines. Unknown parameters — a UI's own tab
 * or selection state, say — are ignored, so filters can share a URL with them.
 */
export function parseNotificationFilters(input: SearchParamsInput): NotificationFilters {
  const params = toSearchParams(input);
  const filters: NotificationFilters = {};

  const status = readEnum<NotificationStatus>(params, 'status', NOTIFICATION_STATUSES);
  if (status !== undefined) {
    filters.status = status;
  }

  const notificationType = readEnum<NotificationType>(
    params,
    'notificationType',
    NOTIFICATION_TYPES,
  );
  if (notificationType !== undefined) {
    filters.notificationType = notificationType;
  }

  const orderByField = readEnum<NotificationOrderByField>(
    params,
    'orderByField',
    NOTIFICATION_ORDER_BY_FIELDS,
  );
  if (orderByField !== undefined) {
    filters.orderByField = orderByField;
  }

  const orderByDirection = readEnum<NotificationOrderDirection>(
    params,
    'orderByDirection',
    NOTIFICATION_ORDER_DIRECTIONS,
  );
  if (orderByDirection !== undefined) {
    filters.orderByDirection = orderByDirection;
  }

  for (const key of STRING_FILTER_KEYS) {
    const value = readString(params, key);
    if (value !== undefined) {
      filters[key] = value;
    }
  }

  for (const key of NUMBER_FILTER_KEYS) {
    const value = readInteger(params, key, { min: 0 });
    if (value !== undefined) {
      filters[key] = value;
    }
  }

  for (const key of DATE_FILTER_KEYS) {
    const value = readTimestamp(params, key);
    if (value !== undefined) {
      filters[key] = value;
    }
  }

  return filters;
}

/**
 * Reads `page` and `pageSize`, falling back to the defaults and clamping
 * `pageSize` to the range the API accepts.
 */
export function parseNotificationPagination(
  input: SearchParamsInput,
  defaults: Partial<PaginationState> = {},
): PaginationState {
  const params = toSearchParams(input);

  return {
    page: readInteger(params, 'page', { min: 1 }) ?? defaults.page ?? DEFAULT_PAGE,
    pageSize:
      readInteger(params, 'pageSize', { min: MIN_PAGE_SIZE, max: MAX_PAGE_SIZE }) ??
      defaults.pageSize ??
      DEFAULT_PAGE_SIZE,
  };
}

/** Filters and pagination together, in the shape the list endpoint expects. */
export function parseNotificationListQuery(
  input: SearchParamsInput,
  defaults: Partial<PaginationState> = {},
): NotificationListQuery {
  return {
    ...parseNotificationFilters(input),
    ...parseNotificationPagination(input, defaults),
  };
}

/**
 * Writes filters onto a copy of `params`, deleting the keys that are unset.
 * Copying rather than mutating keeps this safe to call with the object a router
 * handed you, and leaving unrelated parameters in place means a filter change
 * does not clobber the rest of the URL.
 */
export function applyNotificationFilters(
  params: URLSearchParams,
  filters: NotificationFilters,
  pagination?: Partial<PaginationState>,
): URLSearchParams {
  const next = new URLSearchParams(params);

  for (const key of NOTIFICATION_FILTER_KEYS) {
    const value = filters[key];

    if (value === undefined || value === null || value === '') {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }

  if (pagination?.page !== undefined) {
    next.set('page', String(pagination.page));
  }

  if (pagination?.pageSize !== undefined) {
    next.set('pageSize', String(pagination.pageSize));
  }

  return next;
}

/**
 * The query string for a set of filters on its own, with no other parameters.
 * Keys are sorted so the same filters always produce the same string — handy
 * for cache keys and for asserting on URLs in tests.
 */
export function serializeNotificationFilters(
  filters: NotificationFilters,
  pagination?: Partial<PaginationState>,
): string {
  const params = applyNotificationFilters(new URLSearchParams(), filters, pagination);

  params.sort();

  return params.toString();
}

/** Drops empty values, so `{ status: undefined }` does not become `?status=`. */
export function pruneFilters(filters: NotificationFilters): NotificationFilters {
  const pruned: NotificationFilters = {};

  for (const key of NOTIFICATION_FILTER_KEYS) {
    const value = filters[key];

    if (value !== undefined && value !== null && value !== '') {
      // Each key's value type is preserved by the source object.
      (pruned as Record<string, unknown>)[key] = value;
    }
  }

  return pruned;
}

/**
 * True when at least one narrowing filter is set. Ordering does not count: a
 * sorted-but-unfiltered list is still the full list, so a "clear filters"
 * affordance should stay hidden for it.
 */
export function hasActiveFilters(filters: NotificationFilters): boolean {
  return NARROWING_FILTER_KEYS.some((key) => {
    const value = filters[key];

    return value !== undefined && value !== null && value !== '';
  });
}
