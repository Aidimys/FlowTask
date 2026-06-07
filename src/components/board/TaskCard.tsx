import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Trash2 } from 'lucide-react';
import { type Database } from '../../types/database.types';
import { type BoardMember } from '../../services/boardsApi';

// Получаем базовый тип задачи из автосгенерированных типов Supabase
type BaseTask = Database['public']['Tables']['tasks']['Row'];

// Расширяем тип задачи для join-запросов профилей
type TaskWithProfile = BaseTask & {
  profiles?: {
    avatar_url?: string | null;
    full_name?: string | null;
  } | null;
};

interface TaskCardProps {
  task: TaskWithProfile;
  members: BoardMember[];
  onClick: () => void;
  onDelete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  members,
  onClick,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Предотвращаем срабатывание onClick на самой карточке
    onDelete(task.id);
  };

  // Строго типизированный маппинг цветов для приоритетов
  const priorityColors: Record<string, string> = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-green-50 text-green-700 border-green-100',
  };

  const assignee = members?.find((m) => m.user_id === task.assignee_id);
  
  const avatarUrl =
    assignee?.avatar_url ||
    task.profiles?.avatar_url ||
    (task.assignee_id ? `https://api.dicebear.com/7.x/lorelei/svg?seed=${task.assignee_id}` : '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-grab active:cursor-grabbing relative group space-y-3 select-none my-2"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Исправлен класс переноса слов на break-words */}
        <h4 className="font-semibold text-slate-800 text-sm leading-snug wrap-break-word pr-5">
          {task.title || 'Без названия'}
        </h4>
        <button
          type="button"
          onClick={handleDelete}
          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 rounded-md hover:bg-slate-50 cursor-pointer absolute top-3 right-3"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {task.priority && priorityColors[task.priority] && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${priorityColors[task.priority]}`}>
              {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
          )}

          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date(task.due_date).toLocaleDateString('ru-RU', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {task.assignee_id && (
          <div 
            className="h-6 w-6 rounded-full border border-white shadow-xs bg-slate-100 overflow-hidden shrink-0" 
            title={assignee?.full_name || 'Исполнитель'}
          >
            <img
              src={avatarUrl}
              alt="avatar"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
};