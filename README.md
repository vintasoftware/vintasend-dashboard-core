# vintasend-dashboard-core

The non-visual half of a VintaSend dashboard: a **typed API client generated
from the OpenAPI contract**, **TanStack Query hooks** over it, and
**notification filters that live in the URL**.

[`vintasend-dashboard`](https://github.com/vintasoftware/vintasend-dashboard) is
a ready-made UI. This package is for everyone who wants their own — a different
design system, an existing admin app, an authentication setup of their own. It
ships no components and takes no position on how you log users in.

```
openapi.yaml  ──(openapi-typescript)──▶  src/api/schema.ts
                                              │
                          openapi-fetch  ◀────┤
                                 │            │
                     openapi-react-query  ◀───┘
                                 │
                    useNotificationFilters (URL state)
                                 │
                       useFilteredNotifications
```

## Install

```bash
npm install vintasend-dashboard-core @tanstack/react-query
```

`react` (18 or 19) and `@tanstack/react-query` v5 are peer dependencies. `next`
is an optional peer, needed only for the `/next` entry point.

## Setup

Create a client and put it in context, inside your own `QueryClientProvider`:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VintaSendProvider, createVintaSendClient } from 'vintasend-dashboard-core';

const queryClient = new QueryClient();

// Points at your own route, which forwards to the API with the secret key.
const vintasend = createVintaSendClient({ baseUrl: '/api/vintasend' });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <VintaSendProvider client={vintasend}>{children}</VintaSendProvider>
    </QueryClientProvider>
  );
}
```

### A note on the API key

The VintaSend API authenticates with a bearer key that is a **server-side
secret**. Do not put it in `createVintaSendClient` in browser code. Two shapes
work:

```ts
// 1. Browser -> your server -> the API. Your route adds the key.
createVintaSendClient({ baseUrl: '/api/vintasend' });

// 2. Browser -> the API, authenticated with your app's own session.
createVintaSendClient({
  baseUrl: 'https://notifications.example.com',
  getHeaders: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
});

// 3. Server-side only (route handler, server component, CLI).
createVintaSendClient({
  baseUrl: process.env.VINTASEND_API_URL!,
  apiKey: process.env.VINTASEND_API_KEY!,
});
```

`getHeaders` is resolved before every request, so a rotating token works
without rebuilding the client.

## Filters in the URL

`useNotificationFilters` keeps the whole filter state in the query string. There
is no local copy to drift out of sync, so a filtered view is shareable, survives
a reload, and the back button steps through it.

```tsx
const {
  filters, page, pageSize, query,   // current state
  setFilter, patchFilters, setFilters, clearFilters,
  setPage, setPageSize, setSort,
  hasActiveFilters,
} = useNotificationFilters();
```

Values that are not legal — `?status=nope`, `?page=0`, a `pageSize` over the
contract's maximum — are dropped or clamped rather than forwarded, so a
hand-edited URL cannot turn into a 400.

Changing a filter, the sort, or the page size resets to page 1; page 4 of a
result set that just got smaller is an empty table.

### Binding it to your router

The hook reads and writes through a small adapter, so it never imports a router
of its own.

| Setup | Adapter |
| --- | --- |
| Next.js app router | `useNextRouterAdapter()` from `vintasend-dashboard-core/next` |
| Anything else | the default — `useHistoryRouterAdapter()`, over `window.history` |
| Server render, tests | `createStaticRouterAdapter(search)` |

```tsx
'use client';

import { useFilteredNotifications } from 'vintasend-dashboard-core';
import { useNextRouterAdapter } from 'vintasend-dashboard-core/next';

export function Inbox() {
  const router = useNextRouterAdapter();
  const { notifications, filters, setFilter, ... } = useFilteredNotifications({ router });
}
```

Use the Next adapter in a Next app: navigating through the router is what lets a
server component re-render with the new filters, which the History API does not
do. As with anything that reads search params in Next, the component must be a
client component under a `<Suspense>` boundary.

To write your own — for react-router, TanStack Router, or a custom scheme —
implement two members:

```ts
type RouterAdapter = {
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams, options?: { replace?: boolean }) => void;
};
```

## Filters + data, together

`useFilteredNotifications` is the hook most dashboards want: URL filters fed
straight into the generated list query.

```tsx
export function NotificationsTable() {
  const {
    notifications, isLoading, error,
    filters, setFilter, clearFilters, hasActiveFilters,
    page, hasNextPage, hasPreviousPage, nextPage, previousPage,
    setSort,
  } = useFilteredNotifications({ router: useNextRouterAdapter() });

  if (error) return <Error message={getApiErrorMessage(error)} />;

  return (
    <>
      <input
        value={filters.adapterUsed ?? ''}
        onChange={(e) => setFilter('adapterUsed', e.target.value)}
      />
      {hasActiveFilters && <button onClick={clearFilters}>Clear</button>}

      <table>{notifications.map((n) => <Row key={n.id} notification={n} />)}</table>

      <button disabled={!hasPreviousPage} onClick={previousPage}>Previous</button>
      <span>Page {page}</span>
      <button disabled={!hasNextPage} onClick={nextPage}>Next</button>
    </>
  );
}
```

The API reports `hasMore` rather than a total count — a backend is not required
to be able to count — so there is a "next page" flag but no page count.

Debouncing a text filter is left to you, since every UI wants it slightly
differently; `setFilter` writes immediately.

## Hooks

| Hook | Endpoint |
| --- | --- |
| `useNotificationsQuery(query)` | `GET /api/v1/notifications` |
| `usePendingNotifications(page)` | `GET /api/v1/notifications/pending` |
| `useFutureNotifications(page)` | `GET /api/v1/notifications/future` |
| `useOneOffNotifications(page)` | `GET /api/v1/notifications/one-off` |
| `useNotification(id)` | `GET /api/v1/notifications/{id}` |
| `useNotificationPreview(id)` | `GET /api/v1/notifications/{id}/preview` |
| `useFilterCapabilities()` | `GET /api/v1/capabilities` |
| `useHealth()` | `GET /health` |
| `useResendNotification()` | `POST /api/v1/notifications/{id}/resend` |
| `useCancelNotification()` | `POST /api/v1/notifications/{id}/cancel` |

`useNotification` and `useNotificationPreview` stay idle while the id is
`null`, which is what a detail panel that is not open yet wants.

Mutations keep the generated variable shape and invalidate the notification
lists on success:

```tsx
const resend = useResendNotification();
resend.mutate({ params: { path: { id } }, body: { useStoredContext: true } });

const cancel = useCancelNotification();
cancel.mutate({ params: { path: { id } } });
```

Anything not named above is still reachable, fully typed, through the raw
generated client:

```tsx
const api = useVintaSendApi();
const { data } = api.useQuery('get', '/api/v1/notifications/{id}', {
  params: { path: { id } },
});
```

## Capabilities

Backends differ in what they can filter and sort by. `GET /api/v1/capabilities`
reports the gaps, and a **missing key means supported**:

```tsx
const { data } = useFilterCapabilities();
const canSortBySentAt = supportsCapability(data?.data, 'orderBy.sentAt');
```

## Errors

A failed query rejects with the contract's error envelope, so branch on the
code rather than on message text:

```tsx
if (getApiErrorCode(error) === 'PREVIEW_UNAVAILABLE') return <NoPreview />;

return <p>{getApiErrorMessage(error)}</p>;   // also handles network failures
```

`isApiErrorResponse` narrows the type; `toApiErrorResponse` coerces any
rejection — including a dropped connection — into the same envelope.

## Regenerating the client

`src/api/schema.ts` is generated by
[`openapi-typescript`](https://openapi-ts.dev) from the API package's
`openapi.yaml`, and committed so the package builds on its own. Never edit it by
hand:

```bash
npm run generate:api
```

CI regenerates it against the published contract and fails if the committed copy
is stale.

## Development

```bash
npm install
npm run generate:api   # regenerate from ../vintasend-api/openapi.yaml
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

## Releasing

Tag `v<version>` matching `package.json`, and the publish workflow ships it to
npm over OIDC trusted publishing — no `NPM_TOKEN`. A prerelease version goes out
under its own dist-tag (`1.0.0-alpha1` → `alpha`).

## License

MIT
