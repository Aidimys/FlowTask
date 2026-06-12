//@vitest-environment jsdom
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBoardData } from './useBoardData';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../services/boardsApi';

// 1. Полностью изолируем тесты от внешних API запросов
vi.mock('../services/boardsApi', () => ({
  getColumns: vi.fn(),
  getTasks: vi.fn(),
  getBoardMembers: vi.fn(),
  createColumn: vi.fn(),
  createActivityLog: vi.fn(),
}));

// 2. Заглушка для реального времени Supabase, чтобы подписка на каналы не падала
vi.mock('../services/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Вспомогательная функция для генерации чистого QueryClient для каждого теста
const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }, // Отключаем повторные попытки при ошибках, чтобы тесты шли быстро
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Хук useBoardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен возвращать состояние загрузки и пустые массивы при старте', async () => {
    // Настраиваем моки на возврат пустых промисов
    vi.mocked(api.getColumns).mockResolvedValue([]);
    vi.mocked(api.getTasks).mockResolvedValue([]);
    vi.mocked(api.getBoardMembers).mockResolvedValue([]);

    const { result } = renderHook(() => useBoardData('board-id-123'), {
      wrapper: createQueryWrapper(),
    });

    // На первом рендере isLoading должен быть true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.columns).toEqual([]);
    expect(result.current.tasks).toEqual([]);

    // Ждем, пока TanStack Query завершит резолв промисов
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('должен успешно маппить данные из API в стейт после загрузки', async () => {
    const mockColumns = [
      { id: 'col-1', board_id: 'board-id-123', title: 'В работе', position: 0, created_at: '' }
    ];
    const mockTasks = [
      { id: 'task-1', board_id: 'board-id-123', column_id: 'col-1', title: 'Покрыть хуки тестами', position: 0, description: '', priority: 'high' as const, due_date: null, assignee_id: null, created_at: '', created_by: 'user-1' }
    ];

    vi.mocked(api.getColumns).mockResolvedValue(mockColumns);
    vi.mocked(api.getTasks).mockResolvedValue(mockTasks);
    vi.mocked(api.getBoardMembers).mockResolvedValue([]);

    const { result } = renderHook(() => useBoardData('board-id-123'), {
      wrapper: createQueryWrapper(),
    });

    // Ждем окончания загрузки
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Проверяем, что хук отдал ровно то, что вернул сервер
    expect(result.current.columns).toHaveLength(1);
    expect(result.current.columns[0].title).toBe('В работе');
    expect(result.current.tasks[0].title).toBe('Покрыть хуки тестами');
  });
});