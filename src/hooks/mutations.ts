'use client';

/**
 * Write endpoints.
 *
 * Variables keep the generated shape — `{ params: { path: { id } }, body }` —
 * because that is what stays correct as `openapi.yaml` changes. What these add
 * over the raw client is cache invalidation: a resend creates a notification
 * and a cancel, requeue or repin changes one, so each makes every notification
 * list stale, and
 * forgetting to invalidate is the usual way a dashboard ends up showing a row
 * it just changed in its old state.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { VintaSendClient } from '../api/query.js';
import { useInvalidateNotifications, useVintaSendApi, type WithClient } from './queries.js';

/**
 * Mutation options forwarded to TanStack Query. Left loose because the exact
 * type depends on the endpoint; the generated client checks the call itself.
 */
type MutationOptions = Record<string, unknown>;

export type MutationHookOptions = WithClient & { mutation?: MutationOptions };

/**
 * Runs the caller's `onSuccess` after ours, so an app can chain a toast or a
 * redirect onto the invalidation instead of replacing it.
 */
function withInvalidation(
  options: MutationOptions | undefined,
  invalidate: (...args: unknown[]) => Promise<void>,
): MutationOptions {
  const callerOnSuccess = options?.onSuccess as ((...args: unknown[]) => unknown) | undefined;

  return {
    ...options,
    onSuccess: async (...args: unknown[]) => {
      await invalidate(...args);

      return callerOnSuccess?.(...args);
    },
  };
}

/**
 * Creates a new notification from an existing one. Only user notifications that
 * have already been sent or failed can be resent; anything else answers 409.
 *
 * ```ts
 * const resend = useResendNotification();
 * resend.mutate({ params: { path: { id } }, body: { useStoredContext: true } });
 * ```
 */
export function useResendNotification(options: MutationHookOptions = {}) {
  const invalidate = useInvalidateNotifications();

  return useVintaSendApi(options).useMutation(
    'post',
    '/api/v1/notifications/{id}/resend',
    withInvalidation(options.mutation, invalidate),
  );
}

/**
 * Cancels a notification that is still `PENDING_SEND`.
 *
 * ```ts
 * const cancel = useCancelNotification();
 * cancel.mutate({ params: { path: { id } } });
 * ```
 */
/**
 * Invalidates every notification list, then the changed notification's own
 * detail and preview, which are stale too.
 */
function useInvalidateNotificationAndLists() {
  const invalidateLists = useInvalidateNotifications();
  const queryClient = useQueryClient();

  return async (...args: unknown[]) => {
    await invalidateLists();

    const variables = args[1] as { params?: { path?: { id?: string } } } | undefined;
    const id = variables?.params?.path?.id;

    if (id !== undefined) {
      await queryClient.invalidateQueries({
        queryKey: ['get', '/api/v1/notifications/{id}', { params: { path: { id } } }],
      });
    }
  };
}

/**
 * Cancels a notification that is still `PENDING_SEND`.
 *
 * ```ts
 * const cancel = useCancelNotification();
 * cancel.mutate({ params: { path: { id } } });
 * ```
 */
export function useCancelNotification(options: MutationHookOptions = {}) {
  const invalidate = useInvalidateNotificationAndLists();

  return useVintaSendApi(options).useMutation(
    'post',
    '/api/v1/notifications/{id}/cancel',
    withInvalidation(options.mutation, invalidate),
  );
}

/**
 * Puts a `FAILED` or `CANCELLED` notification back into `PENDING_SEND`. It keeps
 * its ID, unlike a resend, and is sent at once when due. Omit `sendAfter` to
 * keep the notification's own; `null` means now. Any other status answers 409.
 *
 * ```ts
 * const requeue = useRequeueNotification();
 * requeue.mutate({ params: { path: { id } }, body: { sendAfter: null } });
 * ```
 */
export function useRequeueNotification(options: MutationHookOptions = {}) {
  const invalidate = useInvalidateNotificationAndLists();

  return useVintaSendApi(options).useMutation(
    'post',
    '/api/v1/notifications/{id}/requeue',
    withInvalidation(options.mutation, invalidate),
  );
}

/**
 * Pins a notification that has not been delivered to a template version: the
 * current one when `templateVersion` is omitted. Sends nothing; requeue a
 * failed notification afterwards. A delivered notification, or a template with
 * no versions, answers 409.
 *
 * ```ts
 * const repin = useRepinNotification();
 * repin.mutate({ params: { path: { id } }, body: {} });
 * ```
 */
export function useRepinNotification(options: MutationHookOptions = {}) {
  const invalidate = useInvalidateNotificationAndLists();

  return useVintaSendApi(options).useMutation(
    'post',
    '/api/v1/notifications/{id}/repin',
    withInvalidation(options.mutation, invalidate),
  );
}

export type { VintaSendClient };
