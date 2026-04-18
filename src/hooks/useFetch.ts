import useSWR, { mutate } from 'swr';
import { useCallback, useEffect, useRef } from 'react';

export interface SWRConfig {
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
    focusThrottleInterval?: number;
    dedupingInterval?: number;
}

const DEFAULT_CONFIG: SWRConfig = {
    refreshInterval: 3000,
    revalidateOnFocus: true,
    focusThrottleInterval: 5000,
    dedupingInterval: 2000,
};

export function useFetch<T = unknown>(
    key: string | null,
    options: SWRConfig = {}
) {
    const config = { ...DEFAULT_CONFIG, ...options };

    const { data, error, isLoading, isValidating, mutate: localMutate } = useSWR<T>(
        key,
        async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error('Failed to fetch');
            }
            return res.json();
        },
        {
            refreshInterval: config.refreshInterval,
            revalidateOnFocus: config.revalidateOnFocus,
            focusThrottleInterval: config.focusThrottleInterval,
            dedupingInterval: config.dedupingInterval,
        }
    );

    const refresh = useCallback(() => {
        localMutate();
    }, [localMutate]);

    return {
        data,
        error,
        isLoading,
        isValidating,
        refresh,
    };
}

export function useOptimisticUpdate<T>(
    key: string,
    updateFn: (data: T[]) => T[]
) {
    const mutateKey = useRef(key);

    useEffect(() => {
        mutateKey.current = key;
    }, [key]);

    const optimisticUpdate = useCallback(async (newItem: T) => {
        const previousData = await mutate(mutateKey.current);

        await mutate(
            mutateKey.current,
            (currentData: T[] | undefined) => {
                if (!currentData) return [newItem];
                return updateFn([...currentData, newItem]);
            },
            false
        );

        return { previousData };
    }, [key, updateFn]);

    const rollback = useCallback(async (previousData: T[]) => {
        await mutate(mutateKey.current, previousData, false);
    }, [key]);

    return { optimisticUpdate, rollback };
}

export function useVisibilityPolling(
    enabled: boolean,
    interval: number,
    callback: () => void
) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isVisible = useRef(true);

    useEffect(() => {
        const handleVisibilityChange = () => {
            isVisible.current = document.visibilityState === 'visible';

            if (isVisible.current && enabled) {
                callback();
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
                intervalRef.current = setInterval(callback, interval);
            } else if (!isVisible.current && intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        if (enabled) {
            document.addEventListener('visibilitychange', handleVisibilityChange);
            intervalRef.current = setInterval(callback, interval);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, interval, callback]);

    return {
        isVisible: isVisible.current,
    };
}

export { mutate };
export default useFetch;
