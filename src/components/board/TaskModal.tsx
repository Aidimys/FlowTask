import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../services/boardsApi';
import { X, AlertCircle, Calendar, User, MessageSquare, Send, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Task {
  id: string;
  column_id: string;
  title: string;
  position: number;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | string | null;
  due_date: string | null;
  assignee_id: string | null;
}

interface BoardMember {
  user_id: string;
  user_email: string;
}

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  members: BoardMember[];
  onClose: () => void;
  onSave: (taskId: string, updates: { 
    description: string; 
    priority: 'low' | 'medium' | 'high';
    due_date: string | null;
    assignee_id: string | null;
  }) => void;
}

export const TaskModal = ({ task, isOpen, members, onClose, onSave }: TaskModalProps) => {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [newComment, setNewComment] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getCurrentUser().then((user) => {
        if (user) setCurrentUserId(user.id);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
      setPriority((task.priority as 'low' | 'medium' | 'high') || 'medium');
      setDueDate(task.due_date || '');
      setAssigneeId(task.assignee_id || '');
    }
  }, [task]);

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['task_comments', task?.id],
    queryFn: () => api.getTaskComments(task!.id),
    enabled: isOpen && !!task?.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => api.createTaskComment(task!.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_comments', task?.id] });
      setNewComment('');
      toast.success('Комментарий добавлен');
    },
    onError: (error: any) => {
      toast.error(`Ошибка: ${error.message}`);
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteTaskComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_comments', task?.id] });
      toast.success('Комментарий удален');
    },
    onError: (error: any) => {
      toast.error(`Не удалось удалить: ${error.message}`);
    }
  });

  if (!isOpen || !task) return null;

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(task.id, { 
      description, 
      priority,
      due_date: dueDate || null,
      assignee_id: assigneeId || null
    });
    onClose();
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || addCommentMutation.isPending) return;
    addCommentMutation.mutate(newComment.trim());
  };

  const priorityColors = {
    low: 'bg-green-50 border-green-200 text-green-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    high: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200/80 flex flex-col overflow-hidden max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Шапка */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="space-y-1 pr-6">
            <h2 className="text-lg font-bold text-slate-800 wrap-break-word">{task.title}</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Детальная информация по задаче</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition shrink-0 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Тело модалки */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 minimal-scrollbar">
          
          {/* Форма деталей задачи */}
          <form onSubmit={handleSubmitDetails} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Приоритет</label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['low', 'medium', 'high'] as const).map((p) => {
                  const isActive = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 px-3 text-sm font-semibold rounded-xl border text-center transition uppercase tracking-wider cursor-pointer ${
                        isActive ? priorityColors[p] + ' ring-2 ring-offset-1 ring-blue-500 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p === 'low' ? 'Низкий' : p === 'medium' ? 'Средний' : 'Высокий'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Назначить исполнителя
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700 bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none transition cursor-pointer"
                >
                  <option value="">Не назначен</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.user_email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Срок выполнения
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700 bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none transition cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Добавьте более подробное описание для этой задачи..."
                className="w-full min-h-20 max-h-37.5 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition resize-y"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-b border-slate-100 pb-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
              >
                Сохранить изменения
              </button>
            </div>
          </form>

          {/* Блок комментариев */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <span>Комментарии ({comments.length})</span>
            </h3>

            <form onSubmit={handleAddComment} className="flex gap-2 items-start">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите комментарий..."
                className="flex-1 rounded-xl border border-slate-200 py-2.5 px-4 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none transition bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || addCommentMutation.isPending}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-xl transition disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="space-y-3 max-h-62.5 overflow-y-auto pr-1 minimal-scrollbar">
              {isLoadingComments ? (
                <div className="text-center py-4 text-xs text-slate-400">Загрузка комментариев...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  Здесь пока нет комментариев. Будьте первым!
                </div>
              ) : (
                comments.map((comment: any) => {
                  const author = members.find((m) => m.user_id === comment.user_id);
                  const authorEmail = author ? author.user_email : `Пользователь (${comment.user_id.slice(0,6)})`;
                  
                  const isMyComment = comment.user_id === currentUserId;

                  return (
                    <div key={comment.id} className="group/comment relative bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1 hover:border-slate-200 transition">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-600">{authorEmail}</span>
                        <span className="text-slate-400 mr-7">
                          {new Date(comment.created_at).toLocaleString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 wrap-break-word whitespace-pre-wrap pr-6">
                        {comment.content}
                      </p>

                      {/* Кнопка удаления комментария (показывается только автору при наведении) */}
                      {isMyComment && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Вы уверены, что хотите удалить этот комментарий?')) {
                              deleteCommentMutation.mutate(comment.id);
                            }
                          }}
                          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500 p-1 rounded-md md:opacity-0 group-hover/comment:opacity-100 transition cursor-pointer"
                          title="Удалить комментарий"
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