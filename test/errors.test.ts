import { describe, expect, it } from 'vitest';
import {
  getApiErrorCode,
  getApiErrorMessage,
  isApiErrorResponse,
  toApiErrorResponse,
} from '../src/api/errors.js';

const notFound = { error: { code: 'NOT_FOUND', message: 'No such notification.' } };

describe('isApiErrorResponse', () => {
  it('accepts the contract envelope', () => {
    expect(isApiErrorResponse(notFound)).toBe(true);
  });

  it('accepts an envelope carrying details', () => {
    expect(
      isApiErrorResponse({
        error: { code: 'BAD_REQUEST', message: 'Invalid.', details: { field: 'status' } },
      }),
    ).toBe(true);
  });

  it('rejects an unknown error code', () => {
    expect(isApiErrorResponse({ error: { code: 'TEAPOT', message: 'no' } })).toBe(false);
  });

  it('rejects an envelope with a non-string message', () => {
    expect(isApiErrorResponse({ error: { code: 'NOT_FOUND', message: 404 } })).toBe(false);
  });

  it('rejects a bare Error', () => {
    expect(isApiErrorResponse(new Error('network down'))).toBe(false);
  });

  it('rejects null', () => {
    expect(isApiErrorResponse(null)).toBe(false);
  });

  it('rejects a string', () => {
    expect(isApiErrorResponse('NOT_FOUND')).toBe(false);
  });

  it('rejects an object with no error key', () => {
    expect(isApiErrorResponse({ code: 'NOT_FOUND', message: 'x' })).toBe(false);
  });
});

describe('getApiErrorCode', () => {
  it('reads the code off an API failure', () => {
    expect(getApiErrorCode(notFound)).toBe('NOT_FOUND');
  });

  it('is undefined for a transport failure', () => {
    expect(getApiErrorCode(new TypeError('Failed to fetch'))).toBeUndefined();
  });
});

describe('getApiErrorMessage', () => {
  it('prefers the API message', () => {
    expect(getApiErrorMessage(notFound)).toBe('No such notification.');
  });

  it('falls back to an Error message', () => {
    expect(getApiErrorMessage(new Error('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('has a last resort for a thrown non-Error', () => {
    expect(getApiErrorMessage('something')).toBe('The notifications API request failed.');
  });
});

describe('toApiErrorResponse', () => {
  it('passes an API failure through unchanged', () => {
    expect(toApiErrorResponse(notFound)).toBe(notFound);
  });

  it('wraps a transport failure as UPSTREAM_ERROR', () => {
    expect(toApiErrorResponse(new Error('socket hang up'))).toEqual({
      error: { code: 'UPSTREAM_ERROR', message: 'socket hang up' },
    });
  });
});
