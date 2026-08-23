import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../src/filters/keys.js';
import {
  applyNotificationFilters,
  hasActiveFilters,
  parseNotificationFilters,
  parseNotificationListQuery,
  parseNotificationPagination,
  pruneFilters,
  serializeNotificationFilters,
  toSearchParams,
} from '../src/filters/parse.js';

describe('toSearchParams', () => {
  it('passes a URLSearchParams through untouched', () => {
    const params = new URLSearchParams('status=SENT');

    expect(toSearchParams(params)).toBe(params);
  });

  it('parses a raw query string', () => {
    expect(toSearchParams('?status=SENT&page=2').get('status')).toBe('SENT');
  });

  it('reads a Next-style searchParams record', () => {
    const params = toSearchParams({ status: 'SENT', page: '3', missing: undefined });

    expect(params.get('status')).toBe('SENT');
    expect(params.get('page')).toBe('3');
    expect(params.has('missing')).toBe(false);
  });

  it('keeps the first value of a repeated parameter', () => {
    expect(toSearchParams({ status: ['SENT', 'FAILED'] }).get('status')).toBe('SENT');
  });

  it('ignores an empty repeated parameter', () => {
    expect(toSearchParams({ status: [] }).has('status')).toBe(false);
  });
});

describe('parseNotificationFilters', () => {
  it('reads every kind of filter', () => {
    const filters = parseNotificationFilters(
      new URLSearchParams({
        status: 'SENT',
        notificationType: 'EMAIL',
        adapterUsed: 'sendgrid',
        userId: 'user-1',
        bodyTemplate: 'welcome',
        subjectTemplate: 'welcome-subject',
        contextName: 'welcome_context',
        tenant: 'acme',
        requestedTemplateVersion: '3',
        usedTemplateVersion: '0',
        createdAtFrom: '2026-01-01T00:00:00.000Z',
        createdAtTo: '2026-02-01T00:00:00.000Z',
        sentAtFrom: '2026-01-15T00:00:00.000Z',
        sentAtTo: '2026-01-20T00:00:00.000Z',
        orderByField: 'sentAt',
        orderByDirection: 'asc',
      }),
    );

    expect(filters).toEqual({
      status: 'SENT',
      notificationType: 'EMAIL',
      adapterUsed: 'sendgrid',
      userId: 'user-1',
      bodyTemplate: 'welcome',
      subjectTemplate: 'welcome-subject',
      contextName: 'welcome_context',
      tenant: 'acme',
      requestedTemplateVersion: 3,
      usedTemplateVersion: 0,
      createdAtFrom: '2026-01-01T00:00:00.000Z',
      createdAtTo: '2026-02-01T00:00:00.000Z',
      sentAtFrom: '2026-01-15T00:00:00.000Z',
      sentAtTo: '2026-01-20T00:00:00.000Z',
      orderByField: 'sentAt',
      orderByDirection: 'asc',
    });
  });

  it('returns nothing for an empty query string', () => {
    expect(parseNotificationFilters('')).toEqual({});
  });

  it('drops a status that is not in the contract', () => {
    expect(parseNotificationFilters('status=NOPE')).toEqual({});
  });

  it('drops a notification type that is not in the contract', () => {
    expect(parseNotificationFilters('notificationType=CARRIER_PIGEON')).toEqual({});
  });

  it('drops an unsupported order-by field', () => {
    expect(parseNotificationFilters('orderByField=title')).toEqual({});
  });

  it('drops an order direction that is neither asc nor desc', () => {
    expect(parseNotificationFilters('orderByDirection=sideways')).toEqual({});
  });

  it('is case-sensitive about enum values, since the API is', () => {
    expect(parseNotificationFilters('status=sent')).toEqual({});
  });

  it('drops an empty string rather than sending it as a filter', () => {
    expect(parseNotificationFilters('adapterUsed=')).toEqual({});
  });

  it('drops a whitespace-only string filter', () => {
    expect(parseNotificationFilters('adapterUsed=%20%20')).toEqual({});
  });

  it('trims surrounding whitespace off a string filter', () => {
    expect(parseNotificationFilters('adapterUsed=%20sendgrid%20')).toEqual({
      adapterUsed: 'sendgrid',
    });
  });

  it('drops a non-numeric template version', () => {
    expect(parseNotificationFilters('usedTemplateVersion=latest')).toEqual({});
  });

  it('drops a fractional template version', () => {
    expect(parseNotificationFilters('usedTemplateVersion=1.5')).toEqual({});
  });

  it('drops a negative template version, which the contract forbids', () => {
    expect(parseNotificationFilters('usedTemplateVersion=-1')).toEqual({});
  });

  it('keeps version zero, which is a real version', () => {
    expect(parseNotificationFilters('requestedTemplateVersion=0')).toEqual({
      requestedTemplateVersion: 0,
    });
  });

  it('drops an unparseable timestamp', () => {
    expect(parseNotificationFilters('createdAtFrom=yesterday')).toEqual({});
  });

  it('accepts a date-only timestamp', () => {
    expect(parseNotificationFilters('createdAtFrom=2026-01-01')).toEqual({
      createdAtFrom: '2026-01-01',
    });
  });

  it('ignores parameters that are not filters', () => {
    expect(parseNotificationFilters('tab=pending&selected=abc&page=4')).toEqual({});
  });
});

describe('parseNotificationPagination', () => {
  it('falls back to the defaults when the URL says nothing', () => {
    expect(parseNotificationPagination('')).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('reads page and pageSize from the URL', () => {
    expect(parseNotificationPagination('page=4&pageSize=50')).toEqual({ page: 4, pageSize: 50 });
  });

  it('clamps pageSize down to the contract maximum', () => {
    expect(parseNotificationPagination('pageSize=5000').pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('falls back when pageSize is below the minimum', () => {
    expect(parseNotificationPagination('pageSize=0').pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back when page is zero, since the API is 1-indexed', () => {
    expect(parseNotificationPagination('page=0').page).toBe(DEFAULT_PAGE);
  });

  it('falls back when page is negative', () => {
    expect(parseNotificationPagination('page=-3').page).toBe(DEFAULT_PAGE);
  });

  it('falls back when page is not a number', () => {
    expect(parseNotificationPagination('page=two').page).toBe(DEFAULT_PAGE);
  });

  it('honours caller-supplied defaults', () => {
    expect(parseNotificationPagination('', { page: 2, pageSize: 25 })).toEqual({
      page: 2,
      pageSize: 25,
    });
  });

  it('prefers the URL over the caller-supplied defaults', () => {
    expect(parseNotificationPagination('page=7', { page: 2 }).page).toBe(7);
  });
});

describe('parseNotificationListQuery', () => {
  it('merges filters and pagination into one query object', () => {
    expect(parseNotificationListQuery('status=FAILED&page=2&pageSize=10')).toEqual({
      status: 'FAILED',
      page: 2,
      pageSize: 10,
    });
  });
});

describe('applyNotificationFilters', () => {
  it('writes set filters and deletes unset ones', () => {
    const existing = new URLSearchParams('status=SENT&tenant=acme');

    const next = applyNotificationFilters(existing, { status: 'FAILED' });

    expect(next.get('status')).toBe('FAILED');
    expect(next.has('tenant')).toBe(false);
  });

  it('does not mutate the params it was given', () => {
    const existing = new URLSearchParams('status=SENT');

    applyNotificationFilters(existing, { status: 'FAILED' });

    expect(existing.get('status')).toBe('SENT');
  });

  it('leaves parameters it does not own alone', () => {
    const next = applyNotificationFilters(new URLSearchParams('tab=pending'), { status: 'SENT' });

    expect(next.get('tab')).toBe('pending');
  });

  it('writes pagination when it is supplied', () => {
    const next = applyNotificationFilters(new URLSearchParams(), {}, { page: 3, pageSize: 50 });

    expect(next.get('page')).toBe('3');
    expect(next.get('pageSize')).toBe('50');
  });

  it('leaves existing pagination in place when none is supplied', () => {
    const next = applyNotificationFilters(new URLSearchParams('page=5'), { status: 'SENT' });

    expect(next.get('page')).toBe('5');
  });

  it('stringifies a numeric filter', () => {
    expect(
      applyNotificationFilters(new URLSearchParams(), { usedTemplateVersion: 0 }).get(
        'usedTemplateVersion',
      ),
    ).toBe('0');
  });

  it('round-trips through parseNotificationFilters', () => {
    const filters = {
      status: 'READ',
      tenant: 'acme',
      usedTemplateVersion: 2,
      createdAtFrom: '2026-03-01T00:00:00.000Z',
      orderByField: 'createdAt',
      orderByDirection: 'desc',
    } as const;

    expect(
      parseNotificationFilters(applyNotificationFilters(new URLSearchParams(), filters)),
    ).toEqual(filters);
  });
});

describe('serializeNotificationFilters', () => {
  it('sorts keys so equal filters produce equal strings', () => {
    const a = serializeNotificationFilters({ tenant: 'acme', status: 'SENT' });
    const b = serializeNotificationFilters({ status: 'SENT', tenant: 'acme' });

    expect(a).toBe(b);
    expect(a).toBe('status=SENT&tenant=acme');
  });

  it('produces an empty string for no filters', () => {
    expect(serializeNotificationFilters({})).toBe('');
  });
});

describe('pruneFilters', () => {
  it('drops undefined and empty values', () => {
    expect(pruneFilters({ status: 'SENT', tenant: undefined, adapterUsed: '' })).toEqual({
      status: 'SENT',
    });
  });

  it('keeps a zero, which is a meaningful template version', () => {
    expect(pruneFilters({ requestedTemplateVersion: 0 })).toEqual({
      requestedTemplateVersion: 0,
    });
  });
});

describe('hasActiveFilters', () => {
  it('is false for no filters', () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it('is true when a narrowing filter is set', () => {
    expect(hasActiveFilters({ status: 'SENT' })).toBe(true);
  });

  it('is false when only ordering is set, since sorting narrows nothing', () => {
    expect(hasActiveFilters({ orderByField: 'sentAt', orderByDirection: 'asc' })).toBe(false);
  });

  it('is false when a filter key is present but empty', () => {
    expect(hasActiveFilters({ tenant: '' })).toBe(false);
  });
});
