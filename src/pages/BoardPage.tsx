import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardData } from '../hooks/useBoardData';
import { Column } from '../components/board/Column';
import { TaskModal } from '../components/board/TaskModal'; 
import { TaskCard } from '../components/board/TaskCard';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { ActivitySidebar } from '../components/board/ActivitySidebar';
import { BoardSkeleton } from '../components/shared/BoardSkeleton';
import { DndContext, type DragEndEvent, type DragStartEvent, TouchSensor, PointerSensor, useSensor, useSensors, closestCorners, DragOverlay } from '@dnd-kit/core';
import { ArrowLeft, Layout, Plus, UserPlus, Trash2, User, Search, SlidersHorizontal, X, History } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { supabase } from '../services/supabase';
import * as api from '../services/boardsApi';
import { calculateDragEndResult } from '../utils/boardUtils';

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

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: () => api.getBoardDetails(boardId!),
    enabled: !!boardId,
  });

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
      queryClient.invalidateQueries({ queryKey: ['boards'] });
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
      activationConstraint: {
        distance: 8, 
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, 
        tolerance: 5,  
      },
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const result = calculateDragEndResult(event, tasks, columns);
    if (result) {
      moveTask(result);
    }
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
  };

  const activeDraggingTask = tasks.find(t => t.id === activeTaskId);

  return (
    <div className="h-screen w-screen max-w-full bg-slate-50 flex flex-col overflow-hidden">
      
      <header className="bg-white border-b border-slate-200 py-3 px-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-10 gap-4 shrink-0">
        <div className="flex items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
              title="Назад к доскам"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 font-bold text-base md:text-lg text-slate-800 min-w-0">
              <Layout className="h-5 w-5 text-blue-600 shrink-0" />
              <span className="truncate">{boardInfo?.title || 'Панель управления доской'}</span>
            </div>
          </div>
          
          {isOwner && (
            <button
              onClick={() => {
                if (confirm('Вы уверены, что хотите НАВСЕГДА удалить эту доску?')) {
                  deleteBoardMutation.mutate();
                }
              }}
              className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-red-100 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Удалить доску</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer border border-slate-200 shadow-xs h-9 w-9 flex items-center justify-center bg-white shrink-0"
            title="История изменений"
          >
            <History className="h-4 w-4" />
          </button>
          
          <form onSubmit={handleInvite} className="flex items-center gap-1.5 flex-1 sm:flex-initial max-w-full sm:max-w-none">
            <input
              type="email"
              placeholder="Пригласить по email..."
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition flex-1 w-full sm:w-40 md:w-56 min-w-0"
            />
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-2 rounded-xl transition cursor-pointer h-9 w-9 shrink-0"
              title="Пригласить"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </form>

          <ThemeToggle />
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center justify-center h-9 w-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition shadow-xs cursor-pointer shrink-0"
            title="Профиль"
          >
            <User className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>

      {/* ФУНКЦИОНАЛЬНАЯ ПАНЕЛЬ ФИЛЬТРОВ И ПОИСКА ЗАДАЧ */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-2.5 flex flex-wrap items-center gap-3 shadow-xs shrink-0">
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

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 flex gap-4 md:gap-5 items-start minimal-scrollbar select-none">
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
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

          <DragOverlay dropAnimation={null}>
            {activeDraggingTask ? (
              <div className="w-72 min-w-[18rem] max-w-[18rem] rotate-2 opacity-90 shadow-2xl pointer-events-none">
                <TaskCard
                  task={activeDraggingTask}
                  members={members}
                  onDelete={() => {}}
                  onClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="w-72 min-w-[18rem] max-w-[18rem] shrink-0 pb-4">
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