import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { toast } from 'react-hot-toast'; 

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,                
      staleTime: 1000 * 60 * 5, 
    },
  },
  queryCache: new QueryCache({
    onError: (error: any) => {
      toast.error(`Ошибка загрузки данных: ${error.message || 'Что-то пошло не так'}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      toast.error(`Не удалось выполнить операцию: ${error.message || 'Ошибка сервера'}`);
    },
  }),
});

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};