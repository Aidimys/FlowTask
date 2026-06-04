import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Trash2 } from 'lucide-react';

export const TaskCard: React.FC<any> = (props) => {
  const task = props.task || props.item || (props.id ? props : null);

  const safeTaskId = task?.id || props.id || 'temporary-id';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: safeTaskId });

  if (!task) return null;

  const id = task.id || props.id;
  const title = task.title || props.title || 'Без названия';
  const dueDate = task.due_date || task.dueDate || props.due_date || props.dueDate;
  const assigneeId = task.assignee_id || task.assigneeId || props.assignee_id || props.assigneeId;
  const priority = task.priority || props.priority;
  const members = props.members || [];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
      if (props.onDeleteTask) props.onDeleteTask(id);
      else if (props.onDelete) props.onDelete(id);
    }
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-green-50 text-green-700 border-green-100',
  };

  const assignee = members?.find((m: any) => m?.id === assigneeId || m?.user_id === assigneeId);
  console.log('Найденный исполнитель:', assignee);
  const avatarUrl = assignee?.avatar_url || task?.profiles?.avatar_url || (assigneeId ? `https://api.dicebear.com/7.x/lorelei/svg?seed=${assigneeId}` : '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={props.onClick}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition cursor-grab active:cursor-grabbing relative group space-y-3 select-none my-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-slate-800 text-sm leading-snug wrap-break-word pr-4">
          {title}
        </h4>
        <button
          onClick={handleDelete}
          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 rounded-md hover:bg-slate-50 cursor-pointer absolute top-3 right-3"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {priority && priorityColors[priority] && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${priorityColors[priority]}`}>
              {priority === 'high' ? 'Высокий' : priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
          )}

          {dueDate && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date(dueDate).toLocaleDateString('ru-RU', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {assigneeId && (
          <div 
            className="h-6 w-6 rounded-full border border-white shadow-xs bg-slate-100 overflow-hidden shrink-0" 
            title={assignee?.name || assignee?.full_name || 'Исполнитель'}
          >
            <img
              src={avatarUrl}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
};