import { X, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/boardsApi';

interface ActivitySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

export const ActivitySidebar = ({ isOpen, onClose, boardId }: ActivitySidebarProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity_logs', boardId],
    queryFn: () => api.getActivityLogs(boardId),
    enabled: isOpen && !!boardId,
    refetchOnWindowFocus: false,
  });

  if (!isOpen) return null;

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-80 md:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 transform translate-x-0">
        
        {/* Шапка шторки */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>История активности</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Список логов */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 minimal-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : logs && logs.length > 0 ? (
            logs.map((log: any) => (
              <div key={log.id} className="flex gap-3 text-sm items-start border-b border-slate-100 pb-3 last:border-0">
                {/* Аватарка пользователя */}
                <img
                  src={log.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${log.profiles?.full_name || 'User'}`}
                  alt="avatar"
                  className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200"
                />
                <div className="flex-1 space-y-0.5">
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-900">
                    {log.profiles?.name || log.profiles?.full_name || 'Пользователь'}
                    </span>{' '}
                    {log.action_text}
                  </p>
                  <span className="text-[11px] font-medium text-slate-400 block">
                    {formatDate(log.created_at)} в {formatTime(log.created_at)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              На этой доске пока нет зарегистрированных действий.
            </div>
          )}
        </div>
      </div>
    </>
  );
};