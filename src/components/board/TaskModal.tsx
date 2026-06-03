import React, { useState, useEffect } from 'react';
import { X, Calendar, AlignLeft, BarChart2, User, MessageSquare, Send, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase'; 
import { toast } from 'react-hot-toast';

interface TaskModalProps {
  task: any;
  isOpen: boolean;
  members: any[];
  onClose: () => void;
  onSave: (taskId: string, updates: any) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  members,
  onClose,
  onSave,
}) => {
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [newComment, setNewComment] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.due_date || task.dueDate || '');
      setAssigneeId(task.assignee_id || task.assigneeId || '');
    }
  }, [task]);

  const { data: comments = [], isLoading: isCommentsLoading } = useQuery({
    queryKey: ['comments', task?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!task?.id && isOpen,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUserId) throw new Error('Пользователь не авторизован');
      const { error } = await supabase.from('comments').insert([
        { task_id: task.id, user_id: currentUserId, content }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', task?.id] });
      toast.success('Комментарий добавлен');
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', task?.id] });
      toast.success('Комментарий удален');
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  if (!isOpen || !task) return null;

  const handleBlurSave = (field: string, value: any) => {
    onSave(task.id, { [field]: value });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col minimal-scrollbar">
        
        {/* Шапка модалки */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white z-10">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleBlurSave('title', title)}
            className="text-xl font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none w-11/12 transition py-0.5"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Тело модалки */}
        <div className="p-6 space-y-6 flex-1">
          
          {/* Сетка настроек задачи */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            
            {/* Поле: Исполнитель */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Исполнитель
              </label>
              <select
                value={assigneeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssigneeId(val);
                  onSave(task.id, { assignee_id: val || null });
                }}
                className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:border-blue-500 focus:outline-none transition shadow-2xs"
              >
                <option value="">Не назначен</option>
                {members?.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name ? `${member.full_name} (${member.user_email})` : member.user_email}
                  </option>
                ))}
              </select>
            </div>

            {/* Поле: Приоритет */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" /> Приоритет
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  onSave(task.id, { priority: e.target.value });
                }}
                className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:border-blue-500 focus:outline-none transition shadow-2xs"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>

            {/* Поле: Дедлайн */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Срок выполнения
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  onSave(task.id, { due_date: e.target.value || null });
                }}
                className="w-full text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:border-blue-500 focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Описание задачи */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
              <AlignLeft className="h-3.5 w-3.5" /> Описание задачи
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleBlurSave('description', description)}
              placeholder="Добавьте более подробное описание к этой задаче..."
              rows={4}
              className="w-full text-sm rounded-xl border border-slate-200 p-3 text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Блок комментариев */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
              <MessageSquare className="h-3.5 w-3.5" /> Комментарии ({comments.length})
            </label>

            {/* Форма добавления нового комментария */}
            <form onSubmit={handleCommentSubmit} className="flex gap-2 items-end">
              <textarea
                rows={1}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите комментарий..."
                className="flex-1 text-sm rounded-xl border border-slate-200 p-2.5 text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition min-h-10.5 max-h-32 resize-none minimal-scrollbar bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                disabled={addCommentMutation.isPending || !newComment.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center h-10.5 w-10.5 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            {/* Лента существующих комментариев */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 minimal-scrollbar">
              {isCommentsLoading ? (
                <div className="text-xs text-slate-400 text-center py-4">Загрузка комментариев...</div>
              ) : comments.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Здесь пока нет комментариев. Оставьте первый!
                </div>
              ) : (
                comments.map((comment: any) => {
                  const author = members?.find((m) => m.user_id === comment.user_id);
                  const authorName = author?.full_name || author?.user_email || 'Пользователь';
                  const authorAvatar = author?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`;
                  const isMyComment = comment.user_id === currentUserId;

                  return (
                    <div key={comment.id} className="group/comment relative bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-2 hover:border-slate-200 transition">
                      <div className="flex items-center justify-between text-xs">
                        {/* Аватарка и имя автора комментария */}
                        <div className="flex items-center gap-2">
                          <img src={authorAvatar} alt="avatar" className="h-5 w-5 rounded-full bg-slate-200 object-cover" />
                          <span className="font-bold text-slate-700">{authorName}</span>
                        </div>
                        <span className="text-slate-400 mr-7">
                          {new Date(comment.created_at).toLocaleString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 wrap-break-word whitespace-pre-wrap pl-7">
                        {comment.content}
                      </p>

                      {/* Кнопка удаления комментария (видна только автору при наведении) */}
                      {isMyComment && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Удалить этот комментарий?')) {
                              deleteCommentMutation.mutate(comment.id);
                            }
                          }}
                          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500 p-1 rounded-md md:opacity-0 group-hover/comment:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};