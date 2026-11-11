/**
 * Convenience aliases over the generated OpenAPI schema.
 *
 * `schema.ts` is generated from `openapi.yaml` and is the source of truth; it
 * is regenerated with `npm run generate:api` and must never be edited by hand.
 * Everything here is a type alias into it, so the contract stays single-sourced
 * while consumers get names they can import without indexing into `components`.
 */

import type { components, paths } from './schema.js';

type Schemas = components['schemas'];

export type NotificationStatus = Schemas['NotificationStatus'];
export type NotificationType = Schemas['NotificationType'];
export type NotificationAttachment = Schemas['NotificationAttachment'];

/** A notification addressed to a known user. */
export type UserNotification = Schemas['UserNotification'];
/** A notification addressed to a raw email/phone, without a user record. */
export type OneOffNotification = Schemas['OneOffNotification'];
/** List-view notification. `kind` discriminates the two variants. */
export type Notification = Schemas['Notification'];
/** Detail-view notification, including the (potentially large) context payloads. */
export type NotificationDetail = Schemas['NotificationDetail'];

export type NotificationPreview = Schemas['NotificationPreview'];
export type PaginatedNotifications = Schemas['PaginatedNotifications'];
export type ErrorResponse = Schemas['ErrorResponse'];
export type ApiErrorCode = ErrorResponse['error']['code'];

/**
 * Capabilities advertised by the configured backend, as flat dotted keys
 * (`orderBy.sentAt`, `stringLookups.includes`). For filter and ordering keys a
 * missing key means "supported". The action keys
 * ({@link NotificationActionCapability}) are always present and explicit.
 */
export type FilterCapabilities = Record<string, boolean>;

/**
 * The optional notification actions `/api/v1/capabilities` always reports,
 * `true` or `false`. Gate the matching affordance on them: `expectedVersion`
 * on requeue and repin, `templateVersion` on requeue, and the versions search.
 */
export type NotificationActionCapability =
  | 'repin.expectedVersion'
  | 'requeue.expectedVersion'
  | 'requeue.templateVersion'
  | 'versions.filter';

/**
 * Why the API refused a requeue, a repin or a versions search, from the error's
 * `details.reason`. `CHANGED` means the notification moved on since it was
 * listed: list it again rather than retry.
 */
export type NotificationActionRefusalReason =
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'NO_TEMPLATE_VERSION'
  | 'CHANGED'
  | 'UNSUPPORTED';

type VersionsSearchOperation = paths['/api/v1/notifications/versions']['post'];

/**
 * A filter for `POST /api/v1/notifications/versions`: a set of fields (ANDed),
 * or `{ and }`, `{ or }`, `{ not }` around more filters.
 */
export type NotificationSearchFilter = Schemas['NotificationSearchFilter'];
/** The fields of one {@link NotificationSearchFilter} leaf. */
export type NotificationSearchFilterFields = Schemas['NotificationSearchFilterFields'];
/** An ISO-8601 date range, either end optional. */
export type DateRange = Schemas['DateRange'];

/** Body of `POST /api/v1/notifications/versions`. */
export type NotificationVersionsSearch = NonNullable<
  VersionsSearchOperation['requestBody']
>['content']['application/json'];
/** A page of `POST /api/v1/notifications/versions`. */
export type NotificationVersionsPage =
  VersionsSearchOperation['responses'][200]['content']['application/json'];
/**
 * One row of the versions search: an ID and an opaque version token to pass
 * back as `expectedVersion`.
 */
export type NotificationVersionEntry = NotificationVersionsPage['data'][number];

/** Body of `POST /api/v1/notifications/{id}/requeue`. */
export type RequeueNotificationBody = NonNullable<
  paths['/api/v1/notifications/{id}/requeue']['post']['requestBody']
>['content']['application/json'];
/** Body of `POST /api/v1/notifications/{id}/repin`. */
export type RepinNotificationBody = NonNullable<
  paths['/api/v1/notifications/{id}/repin']['post']['requestBody']
>['content']['application/json'];

/** Payload of `POST /api/v1/notifications/{id}/cancel` on success. */
export type CancelledNotification = {
  id: string;
  status: NotificationStatus;
};

/**
 * Every query parameter `GET /api/v1/notifications` accepts, pagination
 * included. Read straight off the generated path so a spec change surfaces
 * here as a type error rather than a silently dropped filter.
 */
export type NotificationListQuery = NonNullable<
  paths['/api/v1/notifications']['get']['parameters']['query']
>;

/**
 * The filter half of the list query: everything except pagination. This is the
 * state `useNotificationFilters` mirrors into the URL.
 */
export type NotificationFilters = Omit<NotificationListQuery, 'page' | 'pageSize'>;

export type NotificationOrderByField = NonNullable<NotificationListQuery['orderByField']>;
export type NotificationOrderDirection = NonNullable<NotificationListQuery['orderByDirection']>;

export type { components, paths } from './schema.js';
