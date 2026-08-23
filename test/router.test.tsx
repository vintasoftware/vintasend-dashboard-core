import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStaticRouterAdapter, useHistoryRouterAdapter } from '../src/filters/router.js';

function setUrl(url: string) {
  window.history.replaceState({}, '', url);
}

describe('useHistoryRouterAdapter', () => {
  beforeEach(() => {
    setUrl('/notifications');
  });

  it('reads the current query string', () => {
    setUrl('/notifications?status=SENT&page=2');

    const { result } = renderHook(() => useHistoryRouterAdapter());

    expect(result.current.searchParams.get('status')).toBe('SENT');
    expect(result.current.searchParams.get('page')).toBe('2');
  });

  it('writes params to the URL and re-renders with them', () => {
    const { result } = renderHook(() => useHistoryRouterAdapter());

    act(() => {
      result.current.setSearchParams(new URLSearchParams({ status: 'FAILED' }));
    });

    expect(window.location.search).toBe('?status=FAILED');
    expect(result.current.searchParams.get('status')).toBe('FAILED');
  });

  it('replaces the history entry by default', () => {
    setUrl('/notifications?status=SENT');
    const lengthBefore = window.history.length;

    const { result } = renderHook(() => useHistoryRouterAdapter());

    act(() => {
      result.current.setSearchParams(new URLSearchParams({ status: 'READ' }));
    });

    expect(window.history.length).toBe(lengthBefore);
  });

  it('pushes a history entry when asked to', () => {
    const lengthBefore = window.history.length;

    const { result } = renderHook(() => useHistoryRouterAdapter());

    act(() => {
      result.current.setSearchParams(new URLSearchParams({ status: 'READ' }), { replace: false });
    });

    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it('keeps the pathname', () => {
    setUrl('/admin/notifications');

    const { result } = renderHook(() => useHistoryRouterAdapter());

    act(() => {
      result.current.setSearchParams(new URLSearchParams({ status: 'SENT' }));
    });

    expect(window.location.pathname).toBe('/admin/notifications');
  });

  it('drops the question mark when every parameter is cleared', () => {
    setUrl('/notifications?status=SENT');

    const { result } = renderHook(() => useHistoryRouterAdapter());

    act(() => {
      result.current.setSearchParams(new URLSearchParams());
    });

    expect(window.location.search).toBe('');
    expect(window.location.href.endsWith('/notifications')).toBe(true);
  });

  it('picks up a back-button navigation', () => {
    const { result } = renderHook(() => useHistoryRouterAdapter());

    act(() => {
      setUrl('/notifications?status=CANCELLED');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.searchParams.get('status')).toBe('CANCELLED');
  });

  it('keeps a stable searchParams identity across renders that change nothing', () => {
    const { result, rerender } = renderHook(() => useHistoryRouterAdapter());

    const first = result.current.searchParams;
    rerender();

    expect(result.current.searchParams).toBe(first);
  });

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useHistoryRouterAdapter());

    const before = result.current.searchParams.toString();
    unmount();

    act(() => {
      setUrl('/notifications?status=FAILED');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.searchParams.toString()).toBe(before);
  });
});

describe('createStaticRouterAdapter', () => {
  it('exposes the query string it was built with', () => {
    expect(createStaticRouterAdapter('status=SENT').searchParams.get('status')).toBe('SENT');
  });

  it('accepts a URLSearchParams', () => {
    const params = new URLSearchParams('tenant=acme');

    expect(createStaticRouterAdapter(params).searchParams).toBe(params);
  });

  it('discards writes instead of throwing', () => {
    const adapter = createStaticRouterAdapter('status=SENT');

    expect(() => adapter.setSearchParams(new URLSearchParams('status=READ'))).not.toThrow();
    expect(adapter.searchParams.get('status')).toBe('SENT');
  });
});
