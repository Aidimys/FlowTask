import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBoards, createBoard, deleteBoard } from '../services/boardsApi';
import { toast } from 'sonner';

export const useBoards = () => {
  const queryClient = useQueryClient();

  const boardsQuery = useQuery({
    queryKey: ['boards'],
    queryFn: getBoards,
  });

  const createBoardMutation = useMutation({
    mutationFn: createBoard,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['boards'] });
        toast.success('Доска успешно создана!');
    },
    onError: (error: any) => {
        toast.error(error.message || 'Ошибка при создании доски!');
    }});
    
    const deleteBoardMutation = useMutation({
    mutationFn: deleteBoard,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['boards'] });
        toast.success('Доска успешно удалена!');
    },
    onError: (error: any) => {
        toast.error(error.message || 'Ошибка при удалении доски!');
    }});

  return {
    boards: boardsQuery.data ?? [],
    isLoading: boardsQuery.isLoading,
    isCreating: createBoardMutation.isPending,
    isDeleting: deleteBoardMutation.isPending,
    createBoard: createBoardMutation.mutateAsync,
    deleteBoard: deleteBoardMutation.mutateAsync,
  };
}