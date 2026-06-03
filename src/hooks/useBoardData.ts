import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/boardsApi';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { supabase } from '../services/supabase';

export const useBoardData = (boardId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!boardId) return;
    const boardChannel = supabase
      .channel(`public:board_changes:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(boardChannel);
    };
  }, [boardId, queryClient]);

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

  const membersQuery = useQuery({
    queryKey: ['board_members', boardId],
    queryFn: () => api.getBoardMembers(boardId),
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

  const updateTaskDetailsMutation = useMutation({
    mutationFn: ({taskId, updates}: { taskId: string; updates: { description?: string; priority?: 'low' | 'medium' | 'high' } }) => 
      api.updateTaskDetails(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      toast.success('Детали задачи обновлены');
    }
  });

  return {
    columns: columnsQuery.data || [],
    tasks: tasksQuery.data || [],
    members: membersQuery.data || [],
    
    isLoading: columnsQuery.isLoading || tasksQuery.isLoading,
    
    createColumn: createColumnMutation.mutate,
    deleteColumn: deleteColumnMutation.mutate,
    updateColumnTitle: updateColumnTitleMutation.mutate,
    
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    moveTask: moveTaskMutation.mutate,

    updateTaskDetails: updateTaskDetailsMutation.mutate,
  };
};