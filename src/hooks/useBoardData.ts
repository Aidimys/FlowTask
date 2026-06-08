import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(boardChannel);
    };
  }, [boardId, queryClient]);


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

  const moveTaskMutation = useMutation<
    void, 
    Error, 
    { taskId: string; columnId: string; position: number },
    { previousTasks: Task[] | undefined }
  >({
    mutationFn: ({ taskId, columnId, position }) => api.updateTaskPosition(taskId, columnId, position),
    
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', boardId] });

      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', boardId]);

      queryClient.setQueryData<Task[]>(['tasks', boardId], (oldTasks) => {
        if (!oldTasks) return [];

        const taskToMove = oldTasks.find(t => t.id === variables.taskId);
        if (!taskToMove) return oldTasks;

        const otherColsTasks = oldTasks.filter(
          t => t.column_id !== taskToMove.column_id && t.column_id !== variables.columnId
        );

        const sourceTasks = oldTasks
          .filter(t => t.column_id === taskToMove.column_id && t.id !== variables.taskId)
          .sort((a, b) => a.position - b.position);

        const updatedMovedTask = { ...taskToMove, column_id: variables.columnId };

        const isSameColumn = taskToMove.column_id === variables.columnId;

        const finalSourceTasks = isSameColumn
          ? []
          : sourceTasks.map((t, idx) => ({ ...t, position: idx }));

        const targetTasks = isSameColumn
          ? sourceTasks
          : oldTasks
              .filter(t => t.column_id === variables.columnId)
              .sort((a, b) => a.position - b.position);

        const newOrder = [...targetTasks];
        newOrder.splice(variables.position, 0, updatedMovedTask);
        const finalTargetTasks = newOrder.map((t, idx) => ({ ...t, position: idx }));
        return [...otherColsTasks, ...finalSourceTasks, ...finalTargetTasks];
      });

      return { previousTasks };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', boardId], context.previousTasks);
      }
      toast.error('Не удалось сохранить порядок задач. Восстановление...');
    },

    onSettled: (_, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      queryClient.invalidateQueries({ queryKey: ['activity_logs', boardId] });
      
      const currentTask = queryClient.getQueryData<Task[]>(['tasks', boardId])?.find(t => t.id === variables.taskId);
      const targetColumn = queryClient.getQueryData<Column[]>(['columns', boardId])?.find(c => c.id === variables.columnId);
      
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
