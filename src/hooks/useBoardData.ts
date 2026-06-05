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
          queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
          queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
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
    onSuccess: (newColumn) => {
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      if (newColumn) {
        api.createActivityLog(boardId, `создал(а) колонку "${newColumn.title}"`);
      }
      toast.success('Колонка создана');
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id: string) => api.deleteColumn(id),
    onSuccess: (_, id) => {
      // Находим имя удаляемой колонки в кэше до инвалидации
      const columnTitle = columnsQuery.data?.find(c => c.id === id)?.title || '';
      
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      api.createActivityLog(boardId, `удалил(а) колонку "${columnTitle}"`);
      toast.success('Колонка удалена');
    },
  });

  const updateColumnTitleMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.updateColumnTitle(id, title),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      api.createActivityLog(boardId, `переименовал(а) колонку в "${variables.title}"`);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ columnId, title, position }: { columnId: string; title: string; position: number }) => 
      api.createTask(columnId, title, position),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      if (newTask) {
        api.createActivityLog(boardId, `добавил(а) задачу "${newTask.title}"`);
      }
      toast.success('Задача добавлена');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: (_, id) => {
      // Находим имя удаляемой задачи в кэше
      const taskTitle = tasksQuery.data?.find(t => t.id === id)?.title || '';
      
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      api.createActivityLog(boardId, `удалил(а) задачу "${taskTitle}"`);
      toast.success('Задача удалена');
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, columnId, position }: { taskId: string; columnId: string; position: number }) =>
      api.updateTaskPosition(taskId, columnId, position),
    onSuccess: (_, variables) => {
      const currentTask = tasksQuery.data?.find(t => t.id === variables.taskId);
      const targetColumn = columnsQuery.data?.find(c => c.id === variables.columnId);
      
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      if (currentTask && targetColumn) {
        api.createActivityLog(
          boardId, 
          `перенёс(ла) задачу "${currentTask.title}" в колонку "${targetColumn.title}"`
        );
      }
    },
  });

  const updateTaskDetailsMutation = useMutation({
    mutationFn: ({taskId, updates}: { taskId: string; updates: any }) => 
      api.updateTaskDetails(taskId, updates),
    onSuccess: (_, variables) => {
      const currentTask = tasksQuery.data?.find(t => t.id === variables.taskId);
      
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      if (currentTask) {
        api.createActivityLog(boardId, `обновил(а) детали задачи "${currentTask.title}"`);
      }
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