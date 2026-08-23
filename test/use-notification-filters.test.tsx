import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStaticRouterAdapter } from '../src/filters/router.js';
import { useNotificationFilters } from '../src/filters/use-notification-filters.js';

function setUrl(url: string) {
  window.history.replaceState({}, '', url);
}

/** Renders the hook against the real History adapter, which the tests then read. */
function render(url = '/notifications', options = {}) {
  setUrl(url);

  return renderHook(() => useNotificationFilters(options));
}

function currentSearch() {
  return new URLSearchParams(window.location.search);
}

describe('useNotificationFilters', () => {
  beforeEach(() => {
    setUrl('/notifications');
  });

  describe('reading', () => {
    it('starts empty when the URL carries nothing', () => {
      const { result } = render();

      expect(result.current.filters).toEqual({});
      expect(result.current.page).toBe(1);
      expect(result.current.pageSize).toBe(20);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('reads filters and pagination out of the URL', () => {
      const { result } = render('/notifications?status=SENT&tenant=acme&page=3&pageSize=50');

      expect(result.current.filters).toEqual({ status: 'SENT', tenant: 'acme' });
      expect(result.current.page).toBe(3);
      expect(result.current.pageSize).toBe(50);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('exposes a list query with pagination folded in', () => {
      const { result } = render('/notifications?status=SENT&page=2');

      expect(result.current.query).toEqual({ status: 'SENT', page: 2, pageSize: 20 });
    });

    it('ignores an invalid filter in the URL', () => {
      const { result } = render('/notifications?status=BOGUS');

      expect(result.current.filters).toEqual({});
    });
  });

  describe('defaults', () => {
    it('applies defaultFilters when the URL is silent', () => {
      const { result } = render('/notifications', { defaultFilters: { tenant: 'acme' } });

      expect(result.current.filters).toEqual({ tenant: 'acme' });
    });

    it('lets the URL override a default', () => {
      const { result } = render('/notifications?tenant=other', {
        defaultFilters: { tenant: 'acme' },
      });

      expect(result.current.filters.tenant).toBe('other');
    });

    it('applies defaultPageSize when the URL is silent', () => {
      const { result } = render('/notifications', { defaultPageSize: 50 });

      expect(result.current.pageSize).toBe(50);
    });

    it('clamps an out-of-range defaultPageSize', () => {
      const { result } = render('/notifications', { defaultPageSize: 1000 });

      expect(result.current.pageSize).toBe(100);
    });
  });

  describe('setFilters', () => {
    it('writes the filters to the URL', () => {
      const { result } = render();

      act(() => result.current.setFilters({ status: 'FAILED' }));

      expect(currentSearch().get('status')).toBe('FAILED');
      expect(result.current.filters).toEqual({ status: 'FAILED' });
    });

    it('accepts an updater function', () => {
      const { result } = render('/notifications?status=SENT');

      act(() => result.current.setFilters((previous) => ({ ...previous, tenant: 'acme' })));

      expect(result.current.filters).toEqual({ status: 'SENT', tenant: 'acme' });
    });

    it('replaces rather than merges', () => {
      const { result } = render('/notifications?status=SENT&tenant=acme');

      act(() => result.current.setFilters({ status: 'READ' }));

      expect(result.current.filters).toEqual({ status: 'READ' });
      expect(currentSearch().has('tenant')).toBe(false);
    });

    it('resets to page 1, since the old page number no longer means anything', () => {
      const { result } = render('/notifications?page=5');

      act(() => result.current.setFilters({ status: 'SENT' }));

      expect(result.current.page).toBe(1);
      expect(currentSearch().get('page')).toBe('1');
    });

    it('keeps the current page size', () => {
      const { result } = render('/notifications?pageSize=50');

      act(() => result.current.setFilters({ status: 'SENT' }));

      expect(result.current.pageSize).toBe(50);
    });

    it('leaves unrelated URL parameters alone', () => {
      const { result } = render('/notifications?tab=pending');

      act(() => result.current.setFilters({ status: 'SENT' }));

      expect(currentSearch().get('tab')).toBe('pending');
    });
  });

  describe('patchFilters and setFilter', () => {
    it('merges a patch into the current filters', () => {
      const { result } = render('/notifications?status=SENT');

      act(() => result.current.patchFilters({ tenant: 'acme' }));

      expect(result.current.filters).toEqual({ status: 'SENT', tenant: 'acme' });
    });

    it('clears a key set to undefined in a patch', () => {
      const { result } = render('/notifications?status=SENT&tenant=acme');

      act(() => result.current.patchFilters({ tenant: undefined }));

      expect(result.current.filters).toEqual({ status: 'SENT' });
    });

    it('sets a single filter', () => {
      const { result } = render();

      act(() => result.current.setFilter('notificationType', 'EMAIL'));

      expect(result.current.filters).toEqual({ notificationType: 'EMAIL' });
    });

    it('clears a single filter', () => {
      const { result } = render('/notifications?status=SENT&tenant=acme');

      act(() => result.current.setFilter('status', undefined));

      expect(result.current.filters).toEqual({ tenant: 'acme' });
    });

    it('clears a single filter set to an empty string, as a text input would', () => {
      const { result } = render('/notifications?adapterUsed=sendgrid');

      act(() => result.current.setFilter('adapterUsed', ''));

      expect(result.current.filters).toEqual({});
      expect(currentSearch().has('adapterUsed')).toBe(false);
    });
  });

  describe('clearFilters', () => {
    it('removes every filter', () => {
      const { result } = render('/notifications?status=SENT&tenant=acme&adapterUsed=sendgrid');

      act(() => result.current.clearFilters());

      expect(result.current.filters).toEqual({});
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('keeps the chosen ordering, which is a view preference rather than a filter', () => {
      const { result } = render(
        '/notifications?status=SENT&orderByField=sentAt&orderByDirection=asc',
      );

      act(() => result.current.clearFilters());

      expect(result.current.filters).toEqual({ orderByField: 'sentAt', orderByDirection: 'asc' });
    });

    it('returns to defaultFilters rather than to nothing', () => {
      const { result } = render('/notifications?status=SENT&tenant=other', {
        defaultFilters: { tenant: 'acme' },
      });

      act(() => result.current.clearFilters());

      expect(result.current.filters).toEqual({ tenant: 'acme' });
    });

    it('goes back to page 1', () => {
      const { result } = render('/notifications?status=SENT&page=4');

      act(() => result.current.clearFilters());

      expect(result.current.page).toBe(1);
    });

    it('keeps unrelated URL parameters', () => {
      const { result } = render('/notifications?status=SENT&tab=pending');

      act(() => result.current.clearFilters());

      expect(currentSearch().get('tab')).toBe('pending');
    });
  });

  describe('pagination', () => {
    it('sets the page', () => {
      const { result } = render('/notifications?status=SENT');

      act(() => result.current.setPage(3));

      expect(result.current.page).toBe(3);
      expect(currentSearch().get('page')).toBe('3');
    });

    it('keeps the filters when paging', () => {
      const { result } = render('/notifications?status=SENT');

      act(() => result.current.setPage(2));

      expect(result.current.filters).toEqual({ status: 'SENT' });
    });

    it('floors a page below 1 up to 1', () => {
      const { result } = render();

      act(() => result.current.setPage(0));

      expect(result.current.page).toBe(1);
    });

    it('changes the page size', () => {
      const { result } = render();

      act(() => result.current.setPageSize(50));

      expect(result.current.pageSize).toBe(50);
    });

    it('returns to page 1 when the page size changes, since page 4 of 20 is not page 4 of 50', () => {
      const { result } = render('/notifications?page=4');

      act(() => result.current.setPageSize(50));

      expect(result.current.page).toBe(1);
    });

    it('clamps the page size to the contract maximum', () => {
      const { result } = render();

      act(() => result.current.setPageSize(9000));

      expect(result.current.pageSize).toBe(100);
    });
  });

  describe('setSort', () => {
    it('sets a field and direction', () => {
      const { result } = render();

      act(() => result.current.setSort('sentAt', 'asc'));

      expect(result.current.filters.orderByField).toBe('sentAt');
      expect(result.current.filters.orderByDirection).toBe('asc');
    });

    it('defaults to descending, which is what a recency-ordered table wants', () => {
      const { result } = render();

      act(() => result.current.setSort('createdAt'));

      expect(result.current.filters.orderByDirection).toBe('desc');
    });

    it('clears ordering when called with no field', () => {
      const { result } = render('/notifications?orderByField=sentAt&orderByDirection=asc');

      act(() => result.current.setSort());

      expect(result.current.filters.orderByField).toBeUndefined();
      expect(currentSearch().has('orderByField')).toBe(false);
    });

    it('keeps the filters when sorting', () => {
      const { result } = render('/notifications?status=SENT');

      act(() => result.current.setSort('sentAt'));

      expect(result.current.filters.status).toBe('SENT');
    });

    it('goes back to page 1', () => {
      const { result } = render('/notifications?page=3');

      act(() => result.current.setSort('sentAt'));

      expect(result.current.page).toBe(1);
    });
  });

  describe('with a supplied router', () => {
    it('reads from the supplied adapter rather than the URL', () => {
      setUrl('/notifications?status=SENT');

      const { result } = renderHook(() =>
        useNotificationFilters({ router: createStaticRouterAdapter('status=FAILED') }),
      );

      expect(result.current.filters).toEqual({ status: 'FAILED' });
    });

    it('writes through the supplied adapter', () => {
      const writes: string[] = [];
      const adapter = {
        searchParams: new URLSearchParams('status=SENT'),
        setSearchParams: (next: URLSearchParams) => writes.push(next.toString()),
      };

      const { result } = renderHook(() => useNotificationFilters({ router: adapter }));

      act(() => result.current.setFilter('tenant', 'acme'));

      expect(writes).toHaveLength(1);
      expect(new URLSearchParams(writes[0]).get('tenant')).toBe('acme');
      expect(window.location.search).toBe('');
    });

    it('asks the adapter to replace by default', () => {
      const modes: (boolean | undefined)[] = [];
      const adapter = {
        searchParams: new URLSearchParams(),
        setSearchParams: (_next: URLSearchParams, options?: { replace?: boolean }) =>
          modes.push(options?.replace),
      };

      const { result } = renderHook(() => useNotificationFilters({ router: adapter }));

      act(() => result.current.setFilter('status', 'SENT'));

      expect(modes).toEqual([true]);
    });

    it('asks the adapter to push when navigationMode is push', () => {
      const modes: (boolean | undefined)[] = [];
      const adapter = {
        searchParams: new URLSearchParams(),
        setSearchParams: (_next: URLSearchParams, options?: { replace?: boolean }) =>
          modes.push(options?.replace),
      };

      const { result } = renderHook(() =>
        useNotificationFilters({ router: adapter, navigationMode: 'push' }),
      );

      act(() => result.current.setFilter('status', 'SENT'));

      expect(modes).toEqual([false]);
    });
  });
});
