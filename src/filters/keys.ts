/**
 * The filter vocabulary, grouped by how each key is parsed out of a URL.
 *
 * Every list is checked against the generated query type, so a parameter added
 * to `openapi.yaml` and left out here becomes a compile error rather than a
 * filter that silently never reaches the API.
 */

import type {
  NotificationFilters,
  NotificationOrderByField,
  NotificationOrderDirection,
  NotificationStatus,
  NotificationType,
} from '../api/types.js';

type FilterKey = keyof NotificationFilters;

export const NOTIFICATION_STATUSES = [
  'PENDING_SEND',
  'SENT',
  'FAILED',
  'READ',
  'CANCELLED',
] as const satisfies readonly NotificationStatus[];

export const NOTIFICATION_TYPES = [
  'EMAIL',
  'SMS',
  'PUSH',
  'IN_APP',
] as const satisfies readonly NotificationType[];

/** Fields the API can order by. A backend may support only some of them. */
export const NOTIFICATION_ORDER_BY_FIELDS = [
  'sendAfter',
  'sentAt',
  'readAt',
  'createdAt',
  'updatedAt',
] as const satisfies readonly NotificationOrderByField[];

export const NOTIFICATION_ORDER_DIRECTIONS = [
  'asc',
  'desc',
] as const satisfies readonly NotificationOrderDirection[];

/** Free-text filters, matched by the most precise lookup the backend supports. */
export const STRING_FILTER_KEYS = [
  'adapterUsed',
  'userId',
  'bodyTemplate',
  'subjectTemplate',
  'contextName',
  'tenant',
] as const satisfies readonly FilterKey[];

/** Non-negative integers. */
export const NUMBER_FILTER_KEYS = [
  'requestedTemplateVersion',
  'usedTemplateVersion',
] as const satisfies readonly FilterKey[];

/** ISO-8601 range bounds. */
export const DATE_FILTER_KEYS = [
  'createdAtFrom',
  'createdAtTo',
  'sentAtFrom',
  'sentAtTo',
] as const satisfies readonly FilterKey[];

/** Filters whose value must be one of a fixed set. */
export const ENUM_FILTER_KEYS = [
  'status',
  'notificationType',
] as const satisfies readonly FilterKey[];

/**
 * Ordering travels with the filters through the URL and the list query, but it
 * narrows nothing, so `hasActiveFilters` and `clearFilters` leave it alone.
 */
export const SORT_KEYS = [
  'orderByField',
  'orderByDirection',
] as const satisfies readonly FilterKey[];

/**
 * Every key the URL carries, in the order a UI would normally lay them out.
 */
export const NOTIFICATION_FILTER_KEYS = [
  ...ENUM_FILTER_KEYS,
  ...STRING_FILTER_KEYS,
  ...NUMBER_FILTER_KEYS,
  ...DATE_FILTER_KEYS,
  ...SORT_KEYS,
] as const satisfies readonly FilterKey[];

/** The narrowing keys alone — everything except ordering. */
export const NARROWING_FILTER_KEYS = [
  ...ENUM_FILTER_KEYS,
  ...STRING_FILTER_KEYS,
  ...NUMBER_FILTER_KEYS,
  ...DATE_FILTER_KEYS,
] as const satisfies readonly FilterKey[];

/** Pagination is tracked next to the filters, not inside them. */
export const PAGINATION_KEYS = ['page', 'pageSize'] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

/** `pageSize` bounds from `openapi.yaml`. Values outside are clamped, not rejected. */
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

/**
 * Compile-time proof that `NOTIFICATION_FILTER_KEYS` covers the query type. If
 * `openapi.yaml` grows a filter, the alias below stops satisfying its `never`
 * constraint and this file fails to type-check until the new key is added to
 * one of the groups above.
 */
type AssertNever<T extends never> = T;

export type UncoveredFilterKey = AssertNever<
  Exclude<FilterKey, (typeof NOTIFICATION_FILTER_KEYS)[number]>
>;
