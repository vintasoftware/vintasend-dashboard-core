import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

/**
 * The entry point is hand-maintained, so it is the easiest thing in the package
 * to leave a new hook out of. This asserts the surface consumers are told about
 * in the README actually exists.
 */
const EXPECTED_EXPORTS = [
  'createVintaSendClient',
  'createVintaSendFetchClient',
  'createVintaSendQueryClient',
  'VintaSendProvider',
  'useVintaSendClient',
  'useVintaSendApi',
  'useNotificationsQuery',
  'usePendingNotifications',
  'useFutureNotifications',
  'useOneOffNotifications',
  'useNotification',
  'useNotificationPreview',
  'useFilterCapabilities',
  'useHealth',
  'supportsCapability',
  'useInvalidateNotifications',
  'useResendNotification',
  'useCancelNotification',
  'useFilteredNotifications',
  'useNotificationFilters',
  'useHistoryRouterAdapter',
  'createStaticRouterAdapter',
  'parseNotificationFilters',
  'parseNotificationPagination',
  'parseNotificationListQuery',
  'applyNotificationFilters',
  'serializeNotificationFilters',
  'pruneFilters',
  'hasActiveFilters',
  'toSearchParams',
  'isApiErrorResponse',
  'getApiErrorCode',
  'getApiErrorMessage',
  'toApiErrorResponse',
  'NOTIFICATION_FILTER_KEYS',
  'NOTIFICATION_STATUSES',
  'NOTIFICATION_TYPES',
  'NOTIFICATION_ORDER_BY_FIELDS',
  'NOTIFICATION_LIST_PATHS',
  'DEFAULT_PAGE',
  'DEFAULT_PAGE_SIZE',
  'MAX_PAGE_SIZE',
] as const;

describe('package entry point', () => {
  it.each(EXPECTED_EXPORTS)('exports %s', (name) => {
    // Dynamic access is the point here: this walks the whole documented surface.
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: asserting the export list
    expect(pkg[name]).toBeDefined();
  });

  it('does not leak the Next.js binding into the framework-free entry point', () => {
    expect('useNextRouterAdapter' in pkg).toBe(false);
  });
});

describe('filter key lists', () => {
  it('has no duplicates', () => {
    expect(new Set(pkg.NOTIFICATION_FILTER_KEYS).size).toBe(pkg.NOTIFICATION_FILTER_KEYS.length);
  });

  it('covers the narrowing keys plus the sort keys', () => {
    expect([...pkg.NARROWING_FILTER_KEYS, ...pkg.SORT_KEYS].sort()).toEqual(
      [...pkg.NOTIFICATION_FILTER_KEYS].sort(),
    );
  });

  it('matches the statuses in the contract', () => {
    expect(pkg.NOTIFICATION_STATUSES).toEqual([
      'PENDING_SEND',
      'SENT',
      'FAILED',
      'READ',
      'CANCELLED',
    ]);
  });

  it('matches the notification types in the contract', () => {
    expect(pkg.NOTIFICATION_TYPES).toEqual(['EMAIL', 'SMS', 'PUSH', 'IN_APP']);
  });
});
