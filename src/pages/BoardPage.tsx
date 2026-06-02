import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardData } from '../hooks/useBoardData';
import { Column } from '../components/board/Column';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { ArrowLeft, Layout, Plus } from 'lucide-react';

export const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  const { 
    columns, tasks, isLoading, 
    createColumn, deleteColumn, 
    createTask, deleteTask, moveTask 
  } = useBoardData(boardId || '');

  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);

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
      {/* Шапка доски */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center shrink-0 px-6 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
            title="Назад к доскам"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 font-bold text-lg text-slate-800">
            <Layout className="h-5 w-5 text-blue-600" />
            <span>Панель управления доской</span>
          </div>
        </div>
      </header>

      {/* Рабочая dnd зона доски */}
      <main className="flex-1 overflow-x-auto p-6 flex gap-5 items-start minimal-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          {columns.map((column) => {
            const columnTasks = tasks.filter((t) => t.column_id === column.id);
            return (
              <Column
                key={column.id}
                id={column.id}
                title={column.title}
                tasks={columnTasks}
                onDeleteColumn={() => deleteColumn(column.id)}
                onAddTask={(title) => createTask({ columnId: column.id, title, position: columnTasks.length })}
                onDeleteTask={(taskId) => deleteTask(taskId)}
              />
            );
          })}
        </DndContext>

        {/* Форма быстрого добавления новой колонки */}
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
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-200/50 hover:bg-slate-200 text-slate-600 hover:text-slate-800 font-bold text-sm rounded-xl border border-dashed border-slate-300 hover:border-slate-400 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Добавить колонку</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
};