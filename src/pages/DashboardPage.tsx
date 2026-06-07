import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoards } from '../hooks/useBoards';
import { useAuth } from '../providers/AuthProvider';
import { Plus, Trash2, Layout, LogOut, FolderKanban, User } from 'lucide-react';
import { ThemeToggle } from '../components/shared/ThemeToggle';

export const DashboardPage = () => {
  const { boards, isLoading, createBoard, deleteBoard, isCreating, isDeleting } = useBoards();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateBoard = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;

    createBoard(newBoardTitle.trim(), {
      onSuccess: () => {
        setNewBoardTitle('');
        setIsModalOpen(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <Layout className="h-6 w-6" />
            <span>TaskFlow</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition shadow-xs cursor-pointer"
            >
              <User className="h-4 w-4 text-slate-500" />
            </button>
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Мои рабочие доски</h1>
            <p className="text-slate-500 text-sm mt-0.5">Выберите доску или создайте новую, чтобы начать работу</p>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Создать доску</span>
          </button>
        </div>

        {/* Скелетон загрузки */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : boards.length === 0 ? (
          /* Пустое состояние */
          <div className="flex flex-col items-center justify-center text-center bg-white p-12 rounded-xl border border-slate-200 border-dashed">
            <FolderKanban className="h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-700">У вас пока нет досок</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">Создайте свою первую канбан-доску, чтобы распределять задачи и следить за прогрессом.</p>
          </div>
        ) : (
          /* Список досок */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                onClick={() => navigate(`/board/${board.id}`)}
                className="group relative h-32 bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer flex flex-col justify-between transition"
              >
                <h2 className="font-bold text-slate-800 group-hover:text-blue-600 transition truncate pr-6">
                  {board.title}
                </h2>
                
                <span className="text-xs text-slate-400">
                  Создана: {board.created_at ? new Date(board.created_at).toLocaleDateString() : '—'}
                </span>

                {/* Кнопка удаления (только если текущий юзер — владелец) */}
                {board.owner_id === user?.id && (
                  <button
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation(); 
                      if (confirm('Вы уверены, что хотите удалить эту доску?')) {
                        deleteBoard(board.id);
                      }
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
                    title="Удалить доску"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Модальное окно создания доски */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Новая доска</h3>
              
              <form onSubmit={handleCreateBoard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Название доски</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    placeholder="Например: Разработка сайта"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newBoardTitle.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition cursor-pointer"
                  >
                    {isCreating ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};