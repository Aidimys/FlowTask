import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { TaskCard } from './TaskCard';
import { Plus, X, Trash2 } from 'lucide-react';

interface Task {
  id: string;
  column_id: string;
  title: string;
  position: number;
}

interface ColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onDeleteColumn: () => void;
  onAddTask: (title: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export const Column = ({ id, title, tasks, onDeleteColumn, onAddTask, onDeleteTask }: ColumnProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');

  // Регистрируем колонку как зону, куда можно дропать элементы
  const { setNodeRef } = useDroppable({ id });

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(taskTitle.trim());
    setTaskTitle('');
    setIsAdding(false);
  };

  return (
    <div className="w-72 max-h-[calc(100vh-12rem)] flex flex-col bg-slate-100 rounded-xl border border-slate-200/60 p-3 shrink-0">
      
      {/* Шапка колонки с возможностью удаления */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">{title}</h3>
          <span className="text-xs font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        
        <button
          onClick={() => {
            if (confirm(`Удалить колонку "${title}" вместе со всеми задачами?`)) {
              onDeleteColumn();
            }
          }}
          className="text-slate-400 hover:text-red-500 p-1 rounded-md transition"
          title="Удалить колонку"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Зона списка задач с SortableContext */}
      <div 
        ref={setNodeRef} 
        className="flex-1 overflow-y-auto minimal-scrollbar space-y-2.5 pb-2"
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))}
        </SortableContext>
      </div>

      {/* Футер: Добавление новой задачи */}
      <div className="mt-2">
        {isAdding ? (
          <form onSubmit={handleAddTaskSubmit} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 shadow-sm">
            <textarea
              required
              autoFocus
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Введите название задачи..."
              className="w-full text-sm border-0 bg-transparent resize-none focus:ring-0 p-0 text-slate-700 placeholder-slate-400 focus:outline-none max-h-20"
              rows={2}
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md transition shadow-xs"
              >
                Добавить
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 hover:bg-slate-200 text-slate-600 hover:text-slate-800 font-medium text-sm rounded-lg border border-transparent hover:border-slate-300/40 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Добавить задачу</span>
          </button>
        )}
      </div>
    </div>
  );
};