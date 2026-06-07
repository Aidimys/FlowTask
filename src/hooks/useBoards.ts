import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBoards, createBoard, deleteBoard } from '../services/boardsApi';
import { toast } from 'sonner';
import { type Database } from '../types/database.types';

// При желании можно вытащить чистый тип доски напрямую из базы
type Board = Database['public']['Tables']['boards']['Row'];

export const useBoards = () => {
  const queryClient = useQueryClient();

  // React Query автоматически выведет тип данных как Board[] благодаря нашему строгому api
  const boardsQuery = useQuery<Board[]>({
    queryKey: ['boards'],
    queryFn: getBoards,
  });

  // Указываем generic типы: <ТипРезультата, ТипОшибки, ТипАргумента>
  const createBoardMutation = useMutation<Board, Error, string>({
    mutationFn: createBoard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Доска успешно создана!');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка при создании доски!');
    },
  });

  const deleteBoardMutation = useMutation<void, Error, string>({
    mutationFn: deleteBoard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Доска успешно удалена!');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка при удалении доски!');
    },
  });

  return {
    boards: boardsQuery.data ?? [],
    isLoading: boardsQuery.isLoading,
    isCreating: createBoardMutation.isPending,
    isDeleting: deleteBoardMutation.isPending,
    createBoard: createBoardMutation.mutateAsync,
    deleteBoard: deleteBoardMutation.mutateAsync,
  };
};