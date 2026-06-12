import { describe, it, expect } from 'vitest';
import { calculateDragEndResult, sortItemsByPosition } from './boardUtils';
import { type DragEndEvent } from '@dnd-kit/core';

describe('Board Utilities (DnD logic)', () => {
  // Используем последовательные индексы 0, 1, 2 для точного тестирования,
  // так как утилита вычисляет destinationIndex на основе реальных индексов массива.
  const mockTasks = [
    { id: 'task-1', column_id: 'col-1', position: 0 },
    { id: 'task-2', column_id: 'col-1', position: 1 },
    { id: 'task-3', column_id: 'col-1', position: 2 },
    { id: 'task-4', column_id: 'col-2', position: 0 },
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

  // === КЕЙС: Перенос между колонками (Дроп на контейнер колонки) ===
  it('должен возвращать правильный объект перемещения при переносе в другую колонку (дроп на саму колонку)', () => {
    const event = {
      active: { id: 'task-1' },
      over: { id: 'col-2' },
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).not.toBeNull();
    expect(result?.taskId).toBe('task-1');
    expect(result?.columnId).toBe('col-2');
    // В col-2 уже есть одна задача (task-4), значит новая должна встать в конец (индекс 1)
    expect(result?.position).toBe(1);
  });

  // === КЕЙС: Перенос между колонками (Дроп поверх чужой задачи) ===
  it('должен корректно вычислять позицию при переносе задачи поверх другой задачи в чужой колонке', () => {
    const event = {
      active: { id: 'task-1' },
      over: { id: 'task-4' }, // задача в col-2 с позицией 0
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).not.toBeNull();
    expect(result?.columnId).toBe('col-2');
    expect(result?.position).toBe(0); // должна занять место task-4
  });

  // === КЕЙС: Сортировка внутри колонки ===
  it('должен корректно изменять позицию при перемещении задачи внутри одной и той же колонки', () => {
    const event = {
      active: { id: 'task-1' }, // исходная позиция 0
      over: { id: 'task-3' },   // перемещаем на место task-3 (индекс 2)
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).not.toBeNull();
    expect(result?.columnId).toBe('col-1');
    expect(result?.position).toBe(2);
  });

  // === КЕЙС: Крайние позиции списка (Начало / Конец) ===
  it('должен корректно обрабатывать перемещение в самое начало списка (индекс 0)', () => {
    const event = {
      active: { id: 'task-3' }, // исходная позиция 2
      over: { id: 'task-1' },   // бросаем в самый верх на task-1 (индекс 0)
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).not.toBeNull();
    expect(result?.position).toBe(0);
  });

  it('должен корректно перемещать задачу в самый конец списка при дропе на контейнер колонки', () => {
    const event = {
      active: { id: 'task-4' }, // берем из col-2
      over: { id: 'col-1' },    // переносим в col-1 в самый конец
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).not.toBeNull();
    expect(result?.columnId).toBe('col-1');
    // В col-1 уже 3 задачи (task-1, task-2, task-3), значит индекс конца = 3
    expect(result?.position).toBe(3);
  });

  // === КЕЙС: Предотвращение лишних апдейтов (Rollback / No-op guard) ===
  it('должен возвращать null, если задача перемещена на свою же текущую позицию', () => {
    const event = {
      active: { id: 'task-2' }, // текущая позиция 1
      over: { id: 'task-2' },   // брошена туда же
    } as unknown as DragEndEvent;

    const result = calculateDragEndResult(event, mockTasks, mockColumns);
    expect(result).toBeNull(); // функция предотвращает лишние вызовы API
  });

  it('должен правильно сортировать элементы по полю position с помощью sortItemsByPosition', () => {
    const unsorted = [
      { id: 'task-b', position: 2 },
      { id: 'task-a', position: 0 },
      { id: 'task-c', position: 1 }
    ];
    const sorted = sortItemsByPosition(unsorted);
    expect(sorted[0].id).toBe('task-a');
    expect(sorted[1].id).toBe('task-c');
    expect(sorted[2].id).toBe('task-b');
  });
});