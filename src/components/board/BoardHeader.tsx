import { useEffect, useState } from 'react';
import { ThemeToggle } from '../shared/ThemeToggle';
import { ArrowLeft, Layout, UserPlus, Trash2, User, History } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import * as api from '../../services/boardsApi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface BoardHeaderProps {
  boardId: string;
  setIsHistoryOpen: (open: boolean) => void;
  
}

export const BoardHeader = ({ boardId, setIsHistoryOpen }: BoardHeaderProps) => {
    const [isOwner, setIsOwner] = useState(false);

    const [inviteEmail, setInviteEmail] = useState('');
    const queryClient = useQueryClient();
    const navigate = useNavigate();
  
    const { data: boardInfo } = useQuery({
    queryKey: ['board_info', boardId],
    queryFn: () => api.getBoardDetails(boardId!),
    enabled: !!boardId,
    });

    useEffect(() => {
    if (boardInfo) {
      api.getCurrentUser().then(user => {
        setIsOwner(user?.id === boardInfo.owner_id);
      });
    }
    }, [boardInfo]);
    const inviteMutation = useMutation<void, Error, string>({
        mutationFn: (email: string) => api.inviteUserByEmail(boardId!, email),
        onSuccess: () => {
          toast.success('Пользователь успешно добавлен!');
          setInviteEmail('');
          queryClient.invalidateQueries({ queryKey: ['board_members', boardId] });
        },
        onError: (error) => {
          toast.error(error.message);
        }
      });
    const deleteBoardMutation = useMutation<void, Error>({
        mutationFn: async () => {
          const { error } = await supabase.from('boards').delete().eq('id', boardId!);
          if (error) throw error;
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['boards'] });
          toast.success('Доска удалена');
          navigate('/dashboard'); 
        },
        onError: (error) => {
          toast.error(`Не удалось удалить: ${error.message}`);
        }
      }); 
      const handleInvite = (e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          if (!inviteEmail.trim()) return;
          inviteMutation.mutate(inviteEmail);
        };

    return (<header className="bg-white border-b border-slate-200 py-3 px-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-10 gap-4 shrink-0">
        <div className="flex items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
              title="Назад к доскам"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 font-bold text-base md:text-lg text-slate-800 min-w-0">
              <Layout className="h-5 w-5 text-blue-600 shrink-0" />
              <span className="truncate">{boardInfo?.title || 'Панель управления доской'}</span>
            </div>
          </div>
          
          {isOwner && (
            <button
              onClick={() => {
                if (confirm('Вы уверены, что хотите НАВСЕГДА удалить эту доску?')) {
                  deleteBoardMutation.mutate();
                }
              }}
              className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-red-100 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Удалить доску</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer border border-slate-200 shadow-xs h-9 w-9 flex items-center justify-center bg-white shrink-0"
            title="История изменений"
          >
            <History className="h-4 w-4" />
          </button>
          
          <form onSubmit={handleInvite} className="flex items-center gap-1.5 flex-1 sm:flex-initial max-w-full sm:max-w-none">
            <input
              type="email"
              placeholder="Пригласить по email..."
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition flex-1 w-full sm:w-40 md:w-56 min-w-0"
            />
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-2 rounded-xl transition cursor-pointer h-9 w-9 shrink-0"
              title="Пригласить"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </form>

          <ThemeToggle />
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center justify-center h-9 w-9 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 transition shadow-xs cursor-pointer shrink-0"
            title="Профиль"
          >
            <User className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>)
};