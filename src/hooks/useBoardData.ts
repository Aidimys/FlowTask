import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import * as api from '../services/boardsApi';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { type Database } from '../types/database.types';

type Column = Database['public']['Tables']['columns']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type BoardMember = Awaited<ReturnType<typeof api.getBoardMembers>>[number];

export const useBoardData = (boardId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
  if (!boardId) return;
  
  const boardChannel = supabase
    .channel(`public:board_changes:${boardId}`)
    // Слушаем колонки
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
        queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      }
    )
    // Слушаем задачи
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
        queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      }
    )
    // Слушаем участников доски
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'board_members', filter: `board_id=eq.${boardId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['board_members', boardId] });
      }
    )
    // Слушаем комментарии с безопасной типизацией payload
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments' },
      (payload: RealtimePostgresChangesPayload<{ task_id: string }>) => {
        // Проверяем наличие task_id в новых или старых данных в зависимости от события (INSERT/UPDATE/DELETE)
        const nextTaskId = payload.new && 'task_id' in payload.new ? payload.new.task_id : null;
        const prevTaskId = payload.old && 'task_id' in payload.old ? payload.old.task_id : null;
        
        const taskId = nextTaskId || prevTaskId;
        
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(boardChannel);
  };
}, [boardId, queryClient]);

  // --- ЗАПРОСЫ (QUERIES) ---

  const columnsQuery = useQuery<Column[]>({
    queryKey: ['columns', boardId],
    queryFn: () => api.getColumns(boardId),
    enabled: !!boardId,
  });

  const tasksQuery = useQuery<Task[]>({
    queryKey: ['tasks', boardId],
    queryFn: () => api.getTasks(boardId),
    enabled: !!boardId,
  });

  const membersQuery = useQuery<BoardMember[]>({
    queryKey: ['board_members', boardId],
    queryFn: () => api.getBoardMembers(boardId),
    enabled: !!boardId,
  });

  // --- МУТАЦИИ (MUTATIONS) ---

  const createColumnMutation = useMutation<Column, Error, string>({
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

  const deleteColumnMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => api.deleteColumn(id),
    onSuccess: (_, id) => {
      const columnTitle = columnsQuery.data?.find(c => c.id === id)?.title || '';
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      api.createActivityLog(boardId, `удалил(а) колонку "${columnTitle}"`);
      toast.success('Колонка удалена');
    },
  });

  const updateColumnTitleMutation = useMutation<void, Error, { id: string; title: string }>({
    mutationFn: ({ id, title }) => api.updateColumnTitle(id, title),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      api.createActivityLog(boardId, `переименовал(а) колонку в "${variables.title}"`);
    },
  });

  const createTaskMutation = useMutation<Task, Error, { columnId: string; title: string; position: number }>({
    mutationFn: ({ columnId, title, position }) => api.createTask(columnId, title, position),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      if (newTask) {
        api.createActivityLog(boardId, `добавил(а) задачу "${newTask.title}"`);
      }
      toast.success('Задача добавлена');
    },
  });

  const deleteTaskMutation = useMutation<void, Error, string>({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: (_, id) => {
      const taskTitle = tasksQuery.data?.find(t => t.id === id)?.title || '';
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      api.createActivityLog(boardId, `удалил(а) задачу "${taskTitle}"`);
      toast.success('Задача удалена');
    },
  });

  const moveTaskMutation = useMutation<void, Error, { taskId: string; columnId: string; position: number }>({
    mutationFn: ({ taskId, columnId, position }) => api.updateTaskPosition(taskId, columnId, position),
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

  const updateTaskDetailsMutation = useMutation<
    Task, 
    Error, 
    { taskId: string; updates: Parameters<typeof api.updateTaskDetails>[1] }
  >({
    mutationFn: ({ taskId, updates }) => api.updateTaskDetails(taskId, updates),
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