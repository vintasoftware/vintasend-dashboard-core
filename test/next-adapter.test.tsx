import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const push = vi.fn();
const state = { pathname: '/notifications', search: '' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
}));

const { useNextRouterAdapter } = await import('../src/next/index.js');

describe('useNextRouterAdapter', () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    state.pathname = '/notifications';
    state.search = '';
  });

  it('exposes the router search params', () => {
    state.search = 'status=SENT&page=2';

    const { result } = renderHook(() => useNextRouterAdapter());

    expect(result.current.searchParams.get('status')).toBe('SENT');
    expect(result.current.searchParams.get('page')).toBe('2');
  });

  it('hands out a mutable copy, not Next’s readonly params', () => {
    state.search = 'status=SENT';

    const { result } = renderHook(() => useNextRouterAdapter());

    expect(() => result.current.searchParams.set('status', 'READ')).not.toThrow();
    expect(result.current.searchParams.get('status')).toBe('READ');
  });

  it('replaces through the Next router by default', () => {
    const { result } = renderHook(() => useNextRouterAdapter());

    result.current.setSearchParams(new URLSearchParams({ status: 'FAILED' }));

    expect(replace).toHaveBeenCalledWith('/notifications?status=FAILED', { scroll: false });
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes when asked to', () => {
    const { result } = renderHook(() => useNextRouterAdapter());

    result.current.setSearchParams(new URLSearchParams({ status: 'FAILED' }), { replace: false });

    expect(push).toHaveBeenCalledWith('/notifications?status=FAILED', { scroll: false });
    expect(replace).not.toHaveBeenCalled();
  });

  it('scrolls to the top when preserveScroll is off', () => {
    const { result } = renderHook(() => useNextRouterAdapter({ preserveScroll: false }));

    result.current.setSearchParams(new URLSearchParams({ status: 'FAILED' }));

    expect(replace).toHaveBeenCalledWith('/notifications?status=FAILED', { scroll: true });
  });

  it('keeps the current pathname', () => {
    state.pathname = '/admin/notifications';

    const { result } = renderHook(() => useNextRouterAdapter());

    result.current.setSearchParams(new URLSearchParams({ status: 'SENT' }));

    expect(replace).toHaveBeenCalledWith('/admin/notifications?status=SENT', { scroll: false });
  });

  it('navigates to the bare pathname when every parameter is cleared', () => {
    state.search = 'status=SENT';

    const { result } = renderHook(() => useNextRouterAdapter());

    result.current.setSearchParams(new URLSearchParams());

    expect(replace).toHaveBeenCalledWith('/notifications', { scroll: false });
  });
});
