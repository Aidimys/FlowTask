import { describe, it, expect } from 'vitest';
import { calculateDragEndResult, sortItemsByPosition } from './boardUtils';
import { type DragEndEvent } from '@dnd-kit/core';

describe('Board Utilities (DnD logic)', () => {
  const mockTasks = [
    { id: 'task-1', column_id: 'col-1', position: 1000 },
    { id: 'task-2', column_id: 'col-1', position: 2000 },
    { id: 'task-3', column_id: 'col-2', position: 1000 },
  ];

  const mockColumns = [
    { id: 'col-1' },
    { id: 'col-2' },
  ];

  it('должен возвращать null, если элемент сброшен вне зоны (over === null)', () => {
    const event = { active: { id: 'task-1' }, over: null } as DragEndEvent;
    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).toBeNull();
  });

  it('должен возвращать null, если задача сброшена на саму себя', () => {
    const event = {
      active: { id: 'task-1' },
      over: { id: 'task-1' },
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).toBeNull();
  });

  it('должен возвращать правильный объект перемещения при переносе в другую колонку', () => {
    const event = {
      active: { id: 'task-1' },
      over: { id: 'col-2' },
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).not.toBeNull();
    expect(result?.taskId).toBe('task-1');
    expect(result?.columnId).toBe('col-2');
    expect(result?.position).toBe(1);
  });

  it('должен правильно сортировать элементы по position', () => {
    const unsorted = [
      { id: '2', position: 200 },
      { id: '1', position: 100 }
    ];
    const sorted = sortItemsByPosition(unsorted);
    expect(sorted[0].id).toBe('1');
  });
});