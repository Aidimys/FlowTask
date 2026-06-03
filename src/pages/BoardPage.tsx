import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardData } from '../hooks/useBoardData';
import { Column } from '../components/board/Column';
import { TaskModal } from '../components/board/TaskModal'; 
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { ArrowLeft, Layout, Plus, UserPlus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../services/supabase';
// ИМПОРТ ИСПРАВЛЕН: подключаем наш файл апи
import * as api from '../services/boardsApi';

// ТИПЫ ИСПРАВЛЕНЫ: убрали string | null из приоритетов для совместимости с Column
interface Task {
  id: string;
  column_id: string;
  title: string;
  position: number; 
  description: string | null;
  priority: 'low' | 'medium' | 'high'; 
  due_date: string | null;
  assignee_id: string | null;
}

export const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  const { 
    columns, tasks, members, isLoading, 
    createColumn, deleteColumn, 
    createTask, deleteTask, moveTask,
    updateTaskDetails
  } = useBoardData(boardId || '');

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const queryClient = useQueryClient();

  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: () => api.getBoardDetails(boardId!),
    enabled: !!boardId,
  });

  useEffect(() => {
    if (boardInfo) {
      api.getCurrentUser().then(user => {
        setIsOwner(user?.id === boardInfo.owner_id);
      });
    }
  }, [boardInfo]);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.inviteUserByEmail(boardId!, email),
    onSuccess: () => {
      toast.success('Пользователь успешно добавлен!');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['board_members', boardId] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  // МУТАЦИЯ ИСПРАВЛЕНА: теперь возвращает чистый Promise, убирая ошибку TS
  const deleteBoardMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('boards').delete().eq('id', boardId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Доска удалена');
      navigate('/dashboard'); 
    },
    onError: (error: any) => {
      toast.error(`Не удалось удалить: ${error.message}`);
    }
  }); 

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate(inviteEmail);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    createColumn(newColumnTitle.trim());
    setNewColumnTitle('');
    setIsAddingColumn(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let targetColumnId = '';
    
    const isOverColumn = columns.some(c => c.id === overId);
    if (isOverColumn) {
      targetColumnId = overId;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) targetColumnId = overTask.column_id;
    }

    if (!targetColumnId) return;

    const columnTasks = tasks.filter(t => t.column_id === targetColumnId && t.id !== taskId);
    const newPosition = columnTasks.length;

    moveTask({ taskId, columnId: targetColumnId, position: newPosition });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ХЕДЕР С ИНТЕГРИРОВАННЫМИ ИНСТРУМЕНТАМИ ДОСТУПА */}
      <header className="bg-white border-b border-slate-200 min-h-16 py-2 flex flex-wrap items-center shrink-0 px-6 justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Назад к доскам"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-2 font-bold text-lg text-slate-800">
              <Layout className="h-5 w-5 text-blue-600" />
              <span>{boardInfo?.title || 'Панель управления доской'}</span>
            </div>
            
            {/* Кнопка удаления для создателя */}
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm('Вы уверены, что хотите НАВСЕГДА удалить эту доску?')) {
                    deleteBoardMutation.mutate();
                  }
                }}
                className="md:ml-2 flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Удалить доску
              </button>
            )}
          </div>
        </div>

        {/* Форма приглашения пользователей по Email */}
        <form onSubmit={handleInvite} className="flex items-center gap-2">
          <input
            type="email"
            placeholder="Пригласить по email..."
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition w-48 md:w-64"
          />
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-2 rounded-xl transition cursor-pointer h-9 w-9"
            title="Пригласить"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </form>
      </header>

      <main className="flex-1 overflow-x-auto p-6 flex gap-5 items-start minimal-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {columns.map((column) => {
            const columnTasks = tasks.filter((t) => t.column_id === column.id);
            return (
              <Column
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={columnTasks as any}
                onDeleteColumn={() => deleteColumn(column.id)}
                onAddTask={(title) => createTask({ columnId: column.id, title, position: columnTasks.length })}
                onDeleteTask={(taskId) => deleteTask(taskId)}
                onTaskClick={(task) => setSelectedTask(task as Task)}
              />
            );
          })}
        </DndContext>

        <div className="w-72 shrink-0">
          {isAddingColumn ? (
            <form onSubmit={handleCreateColumn} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Название колонки..."
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-md text-xs font-semibold transition hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold transition hover:bg-blue-700"
                >
                  Создать
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-200/50 hover:bg-slate-200 text-slate-600 hover:text-slate-800 font-bold text-sm rounded-xl border border-dashed border-slate-300 hover:border-slate-400 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Добавить колонку</span>
            </button>
          )}
        </div>
      </main>

      <TaskModal
        task={selectedTask as any}
        isOpen={selectedTask !== null}
        members={members}
        onClose={() => setSelectedTask(null)}
        onSave={(taskId, updates) => {
          updateTaskDetails({ taskId, updates });
        }}
      />
    </div>
  );
};