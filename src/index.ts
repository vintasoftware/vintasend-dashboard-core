/**
 * vintasend-dashboard-core
 *
 * The non-visual half of a VintaSend dashboard: a client generated from
 * `openapi.yaml`, TanStack Query hooks over it, and notification filters that
 * live in the URL. No components and no opinion about authentication, so an app
 * can bring its own UI and its own session handling.
 *
 * ```tsx
 * const client = createVintaSendClient({ baseUrl: '/api/vintasend' });
 *
 * <QueryClientProvider client={queryClient}>
 *   <VintaSendProvider client={client}>
 *     <Inbox />
 *   </VintaSendProvider>
 * </QueryClientProvider>
 * ```
 */

// Client
export {
  createVintaSendFetchClient,
  type VintaSendClientConfig,
  type VintaSendFetchClient,
} from './api/client.js';
// Errors
export {
  getApiErrorCode,
  getApiErrorMessage,
  isApiErrorResponse,
  toApiErrorResponse,
} from './api/errors.js';
export {
  createVintaSendClient,
  createVintaSendQueryClient,
  type VintaSendClient,
  type VintaSendQueryClient,
} from './api/query.js';

// Contract types
export type {
  ApiErrorCode,
  CancelledNotification,
  components,
  ErrorResponse,
  FilterCapabilities,
  Notification,
  NotificationAttachment,
  NotificationDetail,
  NotificationFilters,
  NotificationListQuery,
  NotificationOrderByField,
  NotificationOrderDirection,
  NotificationPreview,
  NotificationStatus,
  NotificationType,
  OneOffNotification,
  PaginatedNotifications,
  paths,
  UserNotification,
} from './api/types.js';
export {
  DATE_FILTER_KEYS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  ENUM_FILTER_KEYS,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  NARROWING_FILTER_KEYS,
  NOTIFICATION_FILTER_KEYS,
  NOTIFICATION_ORDER_BY_FIELDS,
  NOTIFICATION_ORDER_DIRECTIONS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  NUMBER_FILTER_KEYS,
  PAGINATION_KEYS,
  SORT_KEYS,
  STRING_FILTER_KEYS,
} from './filters/keys.js';
export {
  applyNotificationFilters,
  hasActiveFilters,
  type PaginationState,
  parseNotificationFilters,
  parseNotificationListQuery,
  parseNotificationPagination,
  pruneFilters,
  type SearchParamsInput,
  serializeNotificationFilters,
  toSearchParams,
} from './filters/parse.js';
export {
  createStaticRouterAdapter,
  type HistoryRouterAdapterOptions,
  type RouterAdapter,
  type SetSearchParamsOptions,
  useHistoryRouterAdapter,
} from './filters/router.js';
// Filters
export {
  type NotificationFiltersState,
  type UseNotificationFiltersOptions,
  useNotificationFilters,
} from './filters/use-notification-filters.js';
// Mutation hooks
export {
  type MutationHookOptions,
  useCancelNotification,
  useResendNotification,
} from './hooks/mutations.js';
// Query hooks
export {
  NOTIFICATION_LIST_PATHS,
  supportsCapability,
  useFilterCapabilities,
  useFutureNotifications,
  useHealth,
  useInvalidateNotifications,
  useNotification,
  useNotificationPreview,
  useNotificationsQuery,
  useOneOffNotifications,
  usePendingNotifications,
  useVintaSendApi,
  type WithClient,
} from './hooks/queries.js';
// Filters + list, joined
export {
  type UseFilteredNotificationsOptions,
  type UseFilteredNotificationsResult,
  useFilteredNotifications,
} from './hooks/use-filtered-notifications.js';
export { useVintaSendClient, VintaSendProvider, type VintaSendProviderProps } from './provider.js';
