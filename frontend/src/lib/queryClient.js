import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: (n, e) => (e?.status >= 400 && e?.status < 500 ? false : n < 2), refetchOnWindowFocus: false },
  },
});
