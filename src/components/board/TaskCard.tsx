import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';

interface TaskCardProps {
  id: string;
  title: string;
  onDelete: () => void;
}

export const TaskCard = ({ id, title, onDelete }: TaskCardProps) => {
  // Подключаем dnd-kit sortable к карточке
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
    // Делаем карточку полупрозрачной во время перетаскивания
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 cursor-grab active:cursor-grabbing flex items-start justify-between gap-2 transition-colors touch-none"
    >
      <span className="text-sm font-medium text-slate-700 wrap-break-word line-clamp-3 select-none">
        {title}
      </span>
      
      {/* Кнопка удаления карточки */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="text-slate-400 hover:text-red-500 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        title="Удалить задачу"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};