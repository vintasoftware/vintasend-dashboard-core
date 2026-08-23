/**
 * TanStack Query bindings.
 *
 * `openapi-react-query` lifts the fetch client into query/mutation hooks whose
 * keys, inputs, and results are derived from the same generated `paths` type.
 * The named hooks in `../hooks` are thin wrappers over this; the raw client is
 * exported too, so an app can call an endpoint the wrappers do not cover
 * without dropping out of the typed layer.
 */

import createQueryClient, { type OpenapiQueryClient } from 'openapi-react-query';
import {
  createVintaSendFetchClient,
  type VintaSendClientConfig,
  type VintaSendFetchClient,
} from './client.js';
import type { paths } from './schema.js';

/** Query/mutation hooks generated for the VintaSend contract. */
export type VintaSendQueryClient = OpenapiQueryClient<paths>;

export type VintaSendClient = {
  /** The `openapi-fetch` client, for imperative calls outside React. */
  fetch: VintaSendFetchClient;
  /** The `openapi-react-query` client: `api.useQuery`, `api.useMutation`, … */
  api: VintaSendQueryClient;
};

/** Wraps an existing fetch client in the TanStack Query hooks. */
export function createVintaSendQueryClient(
  fetchClient: VintaSendFetchClient,
): VintaSendQueryClient {
  return createQueryClient(fetchClient);
}

/**
 * Builds both clients from one configuration. Create this once per app —
 * usually at module scope, or in a `useState` initialiser when the
 * configuration depends on a session — and hand it to `VintaSendProvider`.
 */
export function createVintaSendClient(config: VintaSendClientConfig): VintaSendClient {
  const fetchClient = createVintaSendFetchClient(config);

  return { fetch: fetchClient, api: createVintaSendQueryClient(fetchClient) };
}
