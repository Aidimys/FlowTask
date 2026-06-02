import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/boardsApi';
import { toast } from 'sonner';

export const useBoardData = (boardId: string) => {
  const queryClient = useQueryClient();

  const columnsQuery = useQuery({
    queryKey: ['columns', boardId],
    queryFn: () => api.getColumns(boardId),
    enabled: !!boardId,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', boardId],
    queryFn: () => api.getTasks(boardId),
    enabled: !!boardId,
  });

  const createColumnMutation = useMutation({
    mutationFn: (title: string) => {
      const currentPos = columnsQuery.data?.length || 0;
      return api.createColumn(boardId, title, currentPos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      toast.success('Колонка создана');
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id: string) => api.deleteColumn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      toast.success('Колонка удалена');
    },
  });

  const updateColumnTitleMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.updateColumnTitle(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ columnId, title, position }: { columnId: string; title: string; position: number }) => 
      api.createTask(columnId, title, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      toast.success('Задача добавлена');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      toast.success('Задача удалена');
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, columnId, position }: { taskId: string; columnId: string; position: number }) =>
      api.updateTaskPosition(taskId, columnId, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  return {
    columns: columnsQuery.data || [],
    tasks: tasksQuery.data || [],
    isLoading: columnsQuery.isLoading || tasksQuery.isLoading,
    
    createColumn: createColumnMutation.mutate,
    deleteColumn: deleteColumnMutation.mutate,
    updateColumnTitle: updateColumnTitleMutation.mutate,
    
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    moveTask: moveTaskMutation.mutate,
  };
};