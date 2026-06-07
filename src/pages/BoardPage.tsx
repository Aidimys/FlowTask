import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardData } from '../hooks/useBoardData';
import { Column } from '../components/board/Column';
import { TaskModal } from '../components/board/TaskModal'; 
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { ActivitySidebar } from '../components/board/ActivitySidebar';
import { BoardSkeleton } from '../components/shared/BoardSkeleton';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { ArrowLeft, Layout, Plus, UserPlus, Trash2, User, Search, SlidersHorizontal, X, History } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../services/supabase';
import * as api from '../services/boardsApi';

type Task = ReturnType<typeof useBoardData>['tasks'][number];
type BoardMember = ReturnType<typeof useBoardData>['members'][number];

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

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskColumnId, setQuickTaskColumnId] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: () => api.getBoardDetails(boardId!),
    enabled: !!boardId,
  });

  // Вычисляем дефолтную колонку "на лету" без лишних useEffect и каскадных рендеров
  const effectiveQuickTaskColumnId = quickTaskColumnId || (columns && columns.length > 0 ? columns[0].id : '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' || e.key === 'т' || e.key === 'Т') {
        if (
          document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (boardInfo) {
      api.getCurrentUser().then(user => {
        setIsOwner(user?.id === boardInfo.owner_id);
      });
    }
  }, [boardInfo]);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      
    const matchesPriority = !priorityFilter || task.priority === priorityFilter;
    const matchesAssignee = !assigneeFilter || task.assignee_id === assigneeFilter;
    
    let matchesDate = true;
    if (dateFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      matchesDate = task.due_date ? task.due_date.startsWith(todayStr) : false;
    } else if (dateFilter === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      matchesDate = task.due_date ? new Date(task.due_date) < today : false;
    } else if (dateFilter === 'has_deadline') {
      matchesDate = !!task.due_date;
    }
    
    return matchesSearch && matchesPriority && matchesAssignee && matchesDate;
  });

  const inviteMutation = useMutation<void, Error, string>({
    mutationFn: (email: string) => api.inviteUserByEmail(boardId!, email),
    onSuccess: () => {
      toast.success('Пользователь успешно добавлен!');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['board_members', boardId] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const deleteBoardMutation = useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await supabase.from('boards').delete().eq('id', boardId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Доска удалена');
      navigate('/dashboard'); 
    },
    onError: (error) => {
      toast.error(`Не удалось удалить: ${error.message}`);
    }
  }); 

  const handleInvite = (e: React.FormEvent<HTMLFormElement>) => {
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
  return <BoardSkeleton />;
}
  const handleCreateColumn = (e: React.FormEvent<HTMLFormElement>) => {
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

    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    const isOverColumn = columns.some(c => c.id === overId);
    
    // Избавляемся от мутаций и no-useless-assignment с помощью декларативного подхода
    const overTask = !isOverColumn ? tasks.find(t => t.id === overId) : null;
    if (!isOverColumn && !overTask) return;

    const targetColumnId = isOverColumn ? overId : overTask!.column_id;
    
    const destinationIndex = isOverColumn
      ? tasks.filter(t => t.column_id === targetColumnId).length
      : tasks
          .filter(t => t.column_id === targetColumnId)
          .sort((a, b) => a.position - b.position)
          .findIndex(t => t.id === overId);

    if (!targetColumnId || destinationIndex === -1) return;
    if (draggedTask.column_id !== targetColumnId || draggedTask.position !== destinationIndex) {
      moveTask({ 
        taskId, 
        columnId: targetColumnId, 
        position: destinationIndex 
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
        <div className="flex flex-wrap items-center shrink-0 px-6 justify-between gap-4">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer border border-slate-200 shadow-xs h-9 w-9 flex items-center justify-center bg-white"
            title="История изменений"
          >
            <History className="h-4 w-4" />
          </button>
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

          <ThemeToggle />
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition shadow-xs cursor-pointer"
          >
            <User className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>

      {/* ФУНКЦИОНАЛЬНАЯ ПАНЕЛЬ ФИЛЬТРОВ И ПОИСКА ЗАДАЧ */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-60 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <SlidersHorizontal className="h-4 w-4 text-slate-400 mr-1" />
          
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 transition cursor-pointer text-slate-700"
          >
            <option value="">Все исполнители</option>
            {members.map((m: BoardMember) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name || m.user_email}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 transition cursor-pointer text-slate-700"
          >
            <option value="">Все приоритеты</option>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 transition cursor-pointer text-slate-700"
          >
            <option value="">Все сроки</option>
            <option value="today">На сегодня</option>
            <option value="overdue">Просроченные</option>
            <option value="has_deadline">Есть дедлайн</option>
          </select>

          {(searchQuery || priorityFilter || assigneeFilter || dateFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPriorityFilter('');
                setAssigneeFilter('');
                setDateFilter('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-x-auto p-6 flex gap-5 items-start minimal-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {columns.map((column) => {
            const columnTasks = filteredTasks.filter((t) => t.column_id === column.id);
            return (
              <Column
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={columnTasks} 
                members={members}
                onDeleteColumn={() => deleteColumn(column.id)}
                onAddTask={(title) => createTask({ columnId: column.id, title, position: columnTasks.length })}
                onDeleteTask={(taskId) => deleteTask(taskId)}
                onTaskClick={(task) => setSelectedTask(task)} 
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
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-md text-xs font-semibold transition hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold transition hover:bg-blue-700 cursor-pointer"
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

      {/* МОДАЛЬНОЕ ОКНО БЫСТРОГО СОЗДАНИЯ */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Быстрое создание задачи 
              </h3>
              <button 
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!quickTaskTitle.trim() || !effectiveQuickTaskColumnId) return;
              
              const targetColTasks = tasks.filter(t => t.column_id === effectiveQuickTaskColumnId);
              createTask({ 
                columnId: effectiveQuickTaskColumnId, 
                title: quickTaskTitle.trim(), 
                position: targetColTasks.length 
              });
              
              setQuickTaskTitle('');
              setIsQuickAddOpen(false);
              toast.success('Задача создана успешно!');
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Название задачи</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder="Что необходимо сделать?..."
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Выберите колонку</label>
                <select
                  value={effectiveQuickTaskColumnId}
                  onChange={(e) => setQuickTaskColumnId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none transition cursor-pointer"
                >
                  {columns.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold transition hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TaskModal
        key={selectedTask?.id || 'empty'}
        task={selectedTask} 
        isOpen={selectedTask !== null}
        members={members}
        onClose={() => setSelectedTask(null)}
        onSave={(taskId, updates) => {
          const taskUpdates: {
            description?: string;
            priority?: 'medium' | 'low' | 'high';
            due_date?: string | null;
            assignee_id?: string | null;
          } = {};

          if ('description' in updates) {
            taskUpdates.description = updates.description ?? undefined;
          }
          if ('priority' in updates) {
            const priority = updates.priority;
            taskUpdates.priority =
              priority === 'low' || priority === 'medium' || priority === 'high'
                ? priority
                : undefined;
          }
          if ('due_date' in updates) {
            taskUpdates.due_date = updates.due_date ?? undefined;
          }
          if ('assignee_id' in updates) {
            taskUpdates.assignee_id = updates.assignee_id ?? undefined;
          }

          updateTaskDetails({ taskId, updates: taskUpdates });
        }}
      />
      
      <ActivitySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        boardId={boardId || ''}
      />
    </div>
  );
};