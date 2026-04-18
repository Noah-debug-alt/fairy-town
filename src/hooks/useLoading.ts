import { useCallback, useRef, useState } from 'react';

export function useDebounce<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number = 300
): T {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    const debouncedFn = useCallback(
        (...args: unknown[]) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    ) as T;

    return debouncedFn;
}

export function useThrottle<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number = 300
): T {
    const lastRunRef = useRef(0);
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    const throttledFn = useCallback(
        (...args: unknown[]) => {
            const now = Date.now();
            if (now - lastRunRef.current >= delay) {
                lastRunRef.current = now;
                callbackRef.current(...args);
            }
        },
        [delay]
    ) as T;

    return throttledFn;
}

interface UseLoadingStateOptions {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export function useLoadingState<T extends (...args: unknown[]) => Promise<unknown>>(
    callback: T,
    options: UseLoadingStateOptions = {}
) {
    const [loading, setLoading] = useState(false);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const run = useCallback(
        async (...args: unknown[]) => {
            setLoading(true);
            try {
                const result = await callbackRef.current(...args);
                options.onSuccess?.();
                return result;
            } catch (error) {
                options.onError?.(error as Error);
                throw error;
            } finally {
                setLoading(false);
            }
        },
        [options]
    ) as T & { loading: boolean };

    run.loading = loading;

    return run;
}

export function useButtonLock(initialState = false) {
    const [locked, setLocked] = useState(initialState);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const lock = useCallback((duration?: number) => {
        setLocked(true);
        if (duration) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                setLocked(false);
            }, duration);
        }
    }, []);

    const unlock = useCallback(() => {
        setLocked(false);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    return { locked, lock, unlock };
}

export default useDebounce;
