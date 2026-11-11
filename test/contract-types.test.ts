import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  type DateRange,
  getActionRefusalReason,
  type NotificationActionRefusalReason,
  type NotificationSearchFilter,
  type NotificationSearchFilterFields,
  type NotificationVersionEntry,
  type NotificationVersionsPage,
  type NotificationVersionsSearch,
  type RepinNotificationBody,
  type RequeueNotificationBody,
  useRequeueNotification,
  useVintaSendApi,
} from '../src/index.js';

/**
 * The aliases for the move-notifications contract: each one resolves to the shape the API
 * documents, so a consumer importing it gets complete types rather than `unknown` or `never`.
 * `@ts-expect-error` lines prove the shapes are closed where the contract is.
 */
describe('contract aliases', () => {
  it('types the versions search body, filter tree included', () => {
    const search: NotificationVersionsSearch = {
      page: 1,
      pageSize: 500,
      filter: {
        and: [
          { bodyTemplate: 'welcome', createdAtRange: { from: '2026-01-01T00:00:00.000Z' } },
          {
            or: [
              {
                and: [
                  { status: 'PENDING_SEND', hasSendAfter: true, hasRequestedTemplateVersion: true },
                  { not: { requestedTemplateVersion: 4 } },
                ],
              },
              { status: ['FAILED', 'CANCELLED'] },
            ],
          },
        ],
      },
    };
    expectTypeOf(search.filter).toEqualTypeOf<NotificationSearchFilter | undefined>();

    // @ts-expect-error a status the contract does not define
    const badStatus: NotificationSearchFilterFields = { status: 'DELIVERED' };
    // @ts-expect-error a version is a number
    const badVersion: NotificationSearchFilterFields = { requestedTemplateVersion: '4' };
    void badStatus;
    void badVersion;

    expectTypeOf<NotificationSearchFilterFields['hasSendAfter']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<NotificationSearchFilterFields['sendAfterRange']>().toEqualTypeOf<
      DateRange | undefined
    >();
  });

  it('types a page of versions as ids and opaque tokens', () => {
    expectTypeOf<NotificationVersionEntry>().toEqualTypeOf<{ id: string; version: string }>();
    expectTypeOf<NotificationVersionsPage['data']>().toEqualTypeOf<NotificationVersionEntry[]>();
    expectTypeOf<NotificationVersionsPage['hasMore']>().toEqualTypeOf<boolean>();
  });

  it('types every requeue and repin option', () => {
    const requeue: RequeueNotificationBody = {
      sendAfter: null,
      templateVersion: 4,
      expectedVersion: '2026-11-10T12:00:00.000Z',
      send: false,
    };
    const repin: RepinNotificationBody = { templateVersion: 4, expectedVersion: 'v1' };
    void requeue;
    void repin;

    expectTypeOf<RequeueNotificationBody['send']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RepinNotificationBody['expectedVersion']>().toEqualTypeOf<string | undefined>();
    // @ts-expect-error `send` is a requeue option only
    const repinWithSend: RepinNotificationBody = { send: false };
    void repinWithSend;
  });
});

/**
 * The README's example, checked by the compiler: never called, so it needs no provider.
 */
function useReadmeMoveExample() {
  const api = useVintaSendApi();
  const versions = api.useMutation('post', '/api/v1/notifications/versions');
  const requeue = useRequeueNotification();

  return async () => {
    const page = await versions.mutateAsync({
      body: { filter: { bodyTemplate: 'welcome', status: 'FAILED' }, pageSize: 500 },
    });
    expectTypeOf(page).toEqualTypeOf<NotificationVersionsPage>();
    for (const { id, version } of page.data) {
      await requeue.mutateAsync({
        params: { path: { id } },
        body: { templateVersion: 4, expectedVersion: version, send: false },
      });
    }
  };
}
void useReadmeMoveExample;

describe('getActionRefusalReason', () => {
  const refusal = (details: unknown) => ({
    error: { code: 'CONFLICT', message: 'Refused', details },
  });

  it.each([
    'NOT_FOUND',
    'INVALID_STATUS',
    'NO_TEMPLATE_VERSION',
    'CHANGED',
    'UNSUPPORTED',
  ] as const)('reads %s', (reason) => {
    const read = getActionRefusalReason(refusal({ reason }));

    expect(read).toBe(reason);
    expectTypeOf(read).toEqualTypeOf<NotificationActionRefusalReason | undefined>();
  });

  it.each([
    ['a reason the contract does not define', refusal({ reason: 'SOMETHING_ELSE' })],
    ['no details', refusal(undefined)],
    ['details without a reason', refusal({ issues: [] })],
    ['an error that is not from the API', new Error('offline')],
  ])('answers undefined for %s', (_label, error) => {
    expect(getActionRefusalReason(error)).toBeUndefined();
  });
});
