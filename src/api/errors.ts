/**
 * Error helpers.
 *
 * `openapi-react-query` rejects a query with whatever the API put in the
 * response body, so a failed call surfaces the contract's `ErrorResponse`
 * envelope as-is — accurately typed, but awkward to branch on. These helpers
 * narrow that shape, and normalise the other things a fetch can reject with
 * (a network failure, an HTML error page from a proxy) into the same envelope.
 */

import type { ApiErrorCode, ErrorResponse } from './types.js';

const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'PREVIEW_UNAVAILABLE',
  'UPSTREAM_ERROR',
  'INTERNAL_ERROR',
];

/**
 * True when `value` is the API's error envelope. Use it to narrow the `error`
 * a query or mutation rejected with before reading `code`.
 */
export function isApiErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const inner = (value as { error: unknown }).error;

  return (
    typeof inner === 'object' &&
    inner !== null &&
    'code' in inner &&
    'message' in inner &&
    typeof (inner as { message: unknown }).message === 'string' &&
    API_ERROR_CODES.includes((inner as { code: ApiErrorCode }).code)
  );
}

/**
 * The machine-readable code behind a failure, or `undefined` when it did not
 * come from the API (a dropped connection, a CORS rejection, a proxy timeout).
 * Branch on this rather than on message text.
 */
export function getApiErrorCode(error: unknown): ApiErrorCode | undefined {
  return isApiErrorResponse(error) ? error.error.code : undefined;
}

/**
 * A message worth showing a user, for any rejection reason.
 */
export function getApiErrorMessage(error: unknown): string {
  if (isApiErrorResponse(error)) {
    return error.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'The notifications API request failed.';
}

/**
 * Coerces any rejection into the contract's envelope, so UI code has one shape
 * to render. Non-API failures become `UPSTREAM_ERROR`, which is what a
 * transport-level problem is from the dashboard's point of view.
 */
export function toApiErrorResponse(error: unknown): ErrorResponse {
  if (isApiErrorResponse(error)) {
    return error;
  }

  return {
    error: { code: 'UPSTREAM_ERROR', message: getApiErrorMessage(error) },
  };
}
