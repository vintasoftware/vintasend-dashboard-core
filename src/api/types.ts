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
 * Filter capabilities advertised by the configured backend, as flat dotted keys
 * (`orderBy.sentAt`, `stringLookups.includes`). A missing key means "supported".
 */
export type FilterCapabilities = Record<string, boolean>;

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
