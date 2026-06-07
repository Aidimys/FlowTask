import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { toast } from 'react-hot-toast'; 

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Что-то пошло не так';
      toast.error(`Ошибка загрузки данных: ${message}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Ошибка сервера';
      toast.error(`Не удалось выполнить операцию: ${message}`);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,                
      staleTime: 1000 * 60 * 5, 
    },
  },
});

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};