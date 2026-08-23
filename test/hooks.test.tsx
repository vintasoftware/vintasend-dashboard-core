import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVintaSendClient, type VintaSendClient } from '../src/api/query.js';
import { useCancelNotification, useResendNotification } from '../src/hooks/mutations.js';
import {
  supportsCapability,
  useFilterCapabilities,
  useInvalidateNotifications,
  useNotification,
  useNotificationsQuery,
  usePendingNotifications,
} from '../src/hooks/queries.js';
import { useFilteredNotifications } from '../src/hooks/use-filtered-notifications.js';
import { useVintaSendClient, VintaSendProvider } from '../src/provider.js';

/**
 * Covers what this package adds on top of `openapi-react-query`: the provider,
 * the `enabled` gating on id-less queries, the `client` override, cache
 * invalidation after a write, and the URL-filters-to-list-query hook.
 *
 * Fetching, parsing, caching, and error propagation belong to
 * `openapi-react-query` and the generated schema, and are not re-tested here.
 */

function notification(id: string) {
  return {
    id,
    kind: 'user',
    notificationType: 'EMAIL',
    title: `Notification ${id}`,
    contextName: 'welcome',
    status: 'SENT',
    sendAfter: null,
    sentAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    adapterUsed: 'sendgrid',
    bodyTemplate: 'welcome.html',
    subjectTemplate: 'welcome-subject.txt',
    gitCommitSha: 'abc123',
    requestedTemplateVersion: null,
    usedTemplateVersion: null,
    tenant: null,
    userId: 'user-1',
  };
}

/**
 * A stand-in API. Routes are matched by pathname; `requests` records every call
 * so tests can assert on the query string the hooks built.
 */
function createStubApi(
  overrides: Record<string, (url: URL) => { status?: number; body: unknown }> = {},
) {
  const requests: URL[] = [];

  const routes: Record<string, (url: URL) => { status?: number; body: unknown }> = {
    '/api/v1/notifications': (url) => ({
      body: {
        data: [notification('n1'), notification('n2')],
        page: Number(url.searchParams.get('page') ?? 1),
        pageSize: Number(url.searchParams.get('pageSize') ?? 20),
        hasMore: url.searchParams.get('page') !== '3',
      },
    }),
    '/api/v1/notifications/pending': () => ({
      body: { data: [notification('p1')], page: 1, pageSize: 20, hasMore: false },
    }),
    '/api/v1/capabilities': () => ({ body: { data: { 'orderBy.sentAt': false } } }),
    ...overrides,
  };

  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const url = new URL(request.url);

    requests.push(url);

    const exact = routes[url.pathname];

    const handler =
      exact ??
      (/^\/api\/v1\/notifications\/[^/]+\/preview$/.test(url.pathname)
        ? routes.__preview
        : /^\/api\/v1\/notifications\/[^/]+\/resend$/.test(url.pathname)
          ? routes.__resend
          : /^\/api\/v1\/notifications\/[^/]+\/cancel$/.test(url.pathname)
            ? routes.__cancel
            : /^\/api\/v1\/notifications\/[^/]+$/.test(url.pathname)
              ? routes.__detail
              : undefined);

    if (!handler) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: `No route for ${url.pathname}` } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { status = 200, body } = handler(url);

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return { requests, fetchImpl: fetchImpl as unknown as typeof globalThis.fetch, routes };
}

function setup(overrides: Record<string, (url: URL) => { status?: number; body: unknown }> = {}) {
  const stub = createStubApi(overrides);

  const client = createVintaSendClient({
    baseUrl: 'https://api.example.com',
    fetch: stub.fetchImpl,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <VintaSendProvider client={client}>{children}</VintaSendProvider>
      </QueryClientProvider>
    );
  }

  return { ...stub, client, queryClient, wrapper };
}

function queryOnlyWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/notifications');
});

describe('VintaSendProvider', () => {
  it('hands the client to the hooks below it', () => {
    const { client, wrapper } = setup();

    const { result } = renderHook(() => useVintaSendClient(), { wrapper });

    expect(result.current).toBe(client);
  });

  it('explains what to do when a hook is used outside the provider', () => {
    const queryClient = new QueryClient();

    expect(() =>
      renderHook(() => useVintaSendClient(), { wrapper: queryOnlyWrapper(queryClient) }),
    ).toThrow(/VintaSendProvider/);
  });

  it('lets an explicit client stand in for the provider', () => {
    const { client } = setup();
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useVintaSendClient(client), {
      wrapper: queryOnlyWrapper(queryClient),
    });

    expect(result.current).toBe(client);
  });
});

describe('id-gated hooks', () => {
  it('stays idle until an id is available', () => {
    const { wrapper, requests } = setup();

    const { result } = renderHook(() => useNotification(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(requests).toHaveLength(0);
  });

  it('fires once the id arrives', async () => {
    const { wrapper, requests } = setup({
      __detail: () => ({ body: { data: { ...notification('n7'), attachments: [] } } }),
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useNotification(id),
      {
        wrapper,
        initialProps: { id: null as string | null },
      },
    );

    expect(requests).toHaveLength(0);

    rerender({ id: 'n7' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests.at(-1)?.pathname).toBe('/api/v1/notifications/n7');
  });

  it('uses a client passed to the hook instead of the one in context', async () => {
    const { wrapper } = setup();

    const other = createStubApi({
      '/api/v1/capabilities': () => ({ body: { data: { 'orderBy.readAt': false } } }),
    });

    const otherClient: VintaSendClient = createVintaSendClient({
      baseUrl: 'https://other.example.com',
      fetch: other.fetchImpl,
    });

    const { result } = renderHook(() => useFilterCapabilities({ client: otherClient }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(other.requests.at(-1)?.host).toBe('other.example.com');
    expect(result.current.data?.data).toEqual({ 'orderBy.readAt': false });
  });
});

describe('capabilities', () => {
  it('treats an absent key as supported, as the contract specifies', () => {
    expect(supportsCapability({ 'orderBy.sentAt': false }, 'orderBy.createdAt')).toBe(true);
  });

  it('reports an explicitly unsupported key', () => {
    expect(supportsCapability({ 'orderBy.sentAt': false }, 'orderBy.sentAt')).toBe(false);
  });

  it('assumes support before the capabilities have loaded', () => {
    expect(supportsCapability(undefined, 'orderBy.sentAt')).toBe(true);
  });
});

describe('mutations', () => {
  it('refetches the notification lists after a resend', async () => {
    const { wrapper, requests } = setup({
      __resend: () => ({ status: 201, body: { data: notification('new') } }),
    });

    const { result } = renderHook(
      () => ({
        list: useNotificationsQuery({ page: 1, pageSize: 20 }),
        resend: useResendNotification(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    const listCallsBefore = requests.filter((u) => u.pathname === '/api/v1/notifications').length;

    await act(async () => {
      await result.current.resend.mutateAsync({
        params: { path: { id: 'n1' } },
        body: { useStoredContext: false },
      });
    });

    await waitFor(() =>
      expect(requests.filter((u) => u.pathname === '/api/v1/notifications').length).toBeGreaterThan(
        listCallsBefore,
      ),
    );
  });

  it('runs the caller onSuccess as well as the invalidation', async () => {
    const { wrapper } = setup({
      __resend: () => ({ status: 201, body: { data: notification('new') } }),
    });

    const onSuccess = vi.fn();

    const { result } = renderHook(() => useResendNotification({ mutation: { onSuccess } }), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        params: { path: { id: 'n1' } },
        body: { useStoredContext: false },
      });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('refetches the cancelled notification detail', async () => {
    const { wrapper, requests } = setup({
      __detail: () => ({ body: { data: { ...notification('n1'), attachments: [] } } }),
      __cancel: () => ({ body: { data: { id: 'n1', status: 'CANCELLED' } } }),
    });

    const { result } = renderHook(
      () => ({ detail: useNotification('n1'), cancel: useCancelNotification() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    const detailCallsBefore = requests.filter(
      (u) => u.pathname === '/api/v1/notifications/n1',
    ).length;

    await act(async () => {
      await result.current.cancel.mutateAsync({ params: { path: { id: 'n1' } } });
    });

    await waitFor(() =>
      expect(
        requests.filter((u) => u.pathname === '/api/v1/notifications/n1').length,
      ).toBeGreaterThan(detailCallsBefore),
    );
  });
});

describe('useInvalidateNotifications', () => {
  it('refetches every notification list', async () => {
    const { wrapper, requests } = setup();

    const { result } = renderHook(
      () => ({
        list: useNotificationsQuery({ page: 1, pageSize: 20 }),
        pending: usePendingNotifications(),
        invalidate: useInvalidateNotifications(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.pending.isSuccess).toBe(true));

    const before = requests.length;

    await act(async () => {
      await result.current.invalidate();
    });

    await waitFor(() => expect(requests.length).toBeGreaterThan(before + 1));
  });
});

describe('useFilteredNotifications', () => {
  it('reads the filters from the URL and fetches with them', async () => {
    window.history.replaceState({}, '', '/notifications?status=SENT&page=2');

    const { wrapper, requests } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    const url = requests.at(-1);

    expect(url?.searchParams.get('status')).toBe('SENT');
    expect(url?.searchParams.get('page')).toBe('2');
    expect(result.current.filters).toEqual({ status: 'SENT' });
  });

  it('returns an empty list while loading rather than undefined', () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('reports a next page from hasMore', async () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('has no next page when the backend says the page was not full', async () => {
    window.history.replaceState({}, '', '/notifications?page=3');

    const { wrapper } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPreviousPage).toBe(true);
  });

  it('advances a page and refetches', async () => {
    const { wrapper, requests } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.nextPage());

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('page')).toBe('2'));
  });

  it('does not advance past the last page', async () => {
    window.history.replaceState({}, '', '/notifications?page=3');

    const { wrapper } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.previousPage());
    await waitFor(() => expect(result.current.page).toBe(2));
  });

  it('does not go back past the first page', async () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.previousPage());

    expect(result.current.page).toBe(1);
  });

  it('refetches when a filter changes', async () => {
    const { wrapper, requests } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilter('status', 'FAILED'));

    await waitFor(() => expect(requests.at(-1)?.searchParams.get('status')).toBe('FAILED'));
  });

  it('applies defaultFilters to the request', async () => {
    const { wrapper, requests } = setup();

    const { result } = renderHook(
      () => useFilteredNotifications({ defaultFilters: { tenant: 'acme' } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requests.at(-1)?.searchParams.get('tenant')).toBe('acme');
  });

  it('does not refetch in a loop when options are passed as inline literals', async () => {
    // A caller writing `{ defaultFilters: { tenant: 'acme' } }` inline hands the
    // hook a new object on every render. If that reached the query key by
    // identity rather than by value, the query would refetch forever.
    const { wrapper, requests } = setup();

    const { result, rerender } = renderHook(
      () => useFilteredNotifications({ defaultFilters: { tenant: 'acme' } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender();
    rerender();
    rerender();

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(requests).toHaveLength(1);
  });

  it('refetches on demand', async () => {
    const { wrapper, requests } = setup();

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = requests.length;

    act(() => result.current.refetch());

    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
  });

  it('exposes the error when the request fails', async () => {
    const { wrapper } = setup({
      '/api/v1/notifications': () => ({
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'Bad key.' } },
      }),
    });

    const { result } = renderHook(() => useFilteredNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.notifications).toEqual([]);
    expect((result.current.error as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  });
});
