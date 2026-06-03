import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Calendar, User } from 'lucide-react';

interface TaskCardProps {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | string | null;
  dueDate: string | null;
  assigneeId: string | null;
  onDelete: () => void;
  onClick: () => void;
}

export const TaskCard = ({ id, title, priority, dueDate, assigneeId, onDelete, onClick }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const validPriority = (priority === 'low' || priority === 'high') ? priority : 'medium';

  const priorityBadgeColors = {
    low: 'bg-green-500',
    medium: 'bg-amber-500',
    high: 'bg-red-500',
  };

  const priorityLabels = {
    low: 'Низкий приоритет',
    medium: 'Средний приоритет',
    high: 'Высокий приоритет',
  };

  const isOverdue = dueDate ? new Date(dueDate) < new Date(new Date().setHours(0,0,0,0)) : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="group bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md cursor-grab active:cursor-grabbing flex flex-col transition touch-none overflow-hidden"
    >
      {/* Линия приоритета сверху карточки */}
      <div className={`h-1 w-full ${priorityBadgeColors[validPriority]}`} title={priorityLabels[validPriority]} />

      <div className="p-3.5 space-y-3">
        {/* Верхняя часть: Текст и кнопка удаления */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700 wrap-break-word line-clamp-3 select-none">
            {title}
          </span>
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-slate-400 hover:text-red-500 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition shrink-0"
            title="Удалить задачу"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Нижняя часть (Метаданные): Показываем только если есть дата или исполнитель */}
        {(dueDate || assigneeId) && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs text-slate-400 select-none">
            
            {/* Блок дедлайна */}
            {dueDate ? (
              <div 
                className={`flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-md ${
                  isOverdue ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-500'
                }`}
                title={isOverdue ? "Срок задачи истек!" : "Срок выполнения"}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
              </div>
            ) : (
              <div />
            )}

            {/* Блок исполнителя */}
            {assigneeId && (
              <div 
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium"
                title="Исполнитель назначен"
              >
                <User className="h-3 w-3" />
                <span>Назначен</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};