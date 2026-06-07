// @vitest-environment jsdom
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useBoards } from './useBoards';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as api from '../services/boardsApi';
import { toast } from 'sonner';

vi.mock('../services/boardsApi', () => ({
  getBoards: vi.fn(),
  createBoard: vi.fn(),
  deleteBoard: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Хук useBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен возвращать состояние загрузки и пустой массив досок при старте', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);

    const { result } = renderHook(() => useBoards(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    // ФИКС: хук возвращает стабильный [] по умолчанию через оператор ?? []
    expect(result.current.boards).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.boards).toEqual([]);
  });

  it('должен успешно вызывать createBoard и показывать уведомление', async () => {
    const mockNewBoard = { id: 'new-id', title: 'Новая доска', owner_id: 'user-1', created_at: '' };
    vi.mocked(api.getBoards).mockResolvedValue([]);
    vi.mocked(api.createBoard).mockResolvedValue(mockNewBoard);

    const { result } = renderHook(() => useBoards(), {
      wrapper: createQueryWrapper(),
    });

    // Вызываем создание доски (mutateAsync возвращает Promise)
    await result.current.createBoard('Новая доска');

    await waitFor(() => {
      // ФИКС: учитываем внутренний контекст TanStack Query v5 вторым аргументом
      expect(api.createBoard).toHaveBeenCalledWith('Новая доска', expect.any(Object));
      expect(toast.success).toHaveBeenCalledWith('Доска успешно создана!');
    });
  });

  it('должен обрабатывать ошибку при неудачном создании доски', async () => {
    vi.mocked(api.getBoards).mockResolvedValue([]);
    vi.mocked(api.createBoard).mockRejectedValue(new Error('Ошибка сервера'));

    const { result } = renderHook(() => useBoards(), {
      wrapper: createQueryWrapper(),
    });

    // ФИКС: ловим отклонение промиса от mutateAsync, чтобы избежать Unhandled Rejection
    await result.current.createBoard('Упавшая доска').catch(() => {});

    await waitFor(() => {
      expect(api.createBoard).toHaveBeenCalled();
      // ФИКС: хук выводит кастомный error.message ("Ошибка сервера")
      expect(toast.error).toHaveBeenCalledWith('Ошибка сервера');
    });
  });
});