import { type DragEndEvent } from '@dnd-kit/core';

interface MinimalTask {
  id: string;
  column_id: string;
  position: number;
}

interface MinimalColumn {
  id: string;
}

// Выносим сортировку в отдельную переиспользуемую утилиту
export const sortItemsByPosition = <T extends { position: number }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.position - b.position);
};

export const calculateDragEndResult = (
  event: DragEndEvent,
  tasks: MinimalTask[],
  columns: MinimalColumn[]
) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  const taskId = String(active.id);
  const overId = String(over.id);

  const draggedTask = tasks.find(t => t.id === taskId);
  if (!draggedTask) return null;

  const isOverColumn = columns.some(c => c.id === overId);
  const overTask = !isOverColumn ? tasks.find(t => t.id === overId) : null;
  
  if (!isOverColumn && !overTask) return null;

  const targetColumnId = isOverColumn ? overId : overTask!.column_id;

  // Используем нашу новую утилиту сортировки
  const targetColumnTasks = sortItemsByPosition(
    tasks.filter(t => t.column_id === targetColumnId)
  );

  const destinationIndex = isOverColumn
    ? targetColumnTasks.length
    : targetColumnTasks.findIndex(t => t.id === overId);

  if (destinationIndex === -1) return null;

  const isChanged = 
    draggedTask.column_id !== targetColumnId || 
    draggedTask.position !== destinationIndex;

  if (!isChanged) return null;

  return {
    taskId,
    columnId: targetColumnId,
    position: destinationIndex
  };
};