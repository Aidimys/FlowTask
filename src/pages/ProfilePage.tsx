import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { ArrowLeft, User, Mail, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const loadProfile = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (user) {
        setTimeout(() => {
          setEmail(user.email || '');
          setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '');
          setAvatarUrl(user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.id}`);
        }, 0);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setTimeout(() => {
            if (profileData.full_name) setFullName(profileData.full_name);
            if (profileData.avatar_url) setAvatarUrl(profileData.avatar_url);
          }, 0);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Не удалось загрузить данные профиля: ${errorMessage} `);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 0);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    setAvatarUrl(`https://api.dicebear.com/7.x/lorelei/svg?seed=${randomSeed}`);
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Пользователь не найден');

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: { full_name: fullName, avatar_url: avatarUrl }
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          avatar_url: avatarUrl
        });

      if (profileUpdateError) throw profileUpdateError;

      toast.success('Профиль успешно обновлен!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка чтения: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center shrink-0 px-6 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-lg text-slate-800">Настройки профиля</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:py-12">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 md:p-8 space-y-8">
          
          {/* Секция Аватара */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
            <div className="relative h-24 w-24 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400">
                  <User className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="text-center sm:text-left space-y-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Ваш аватар</h3>
              <p className="text-xs text-slate-400 max-w-xs">Мы используем векторные аватары. Вы можете сгенерировать случайный образ одной кнопкой.</p>
              <button
                type="button"
                onClick={handleRandomizeAvatar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Сгенерировать новый
              </button>
            </div>
          </div>

          {/* Форма данных */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email (аккаунт)</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-2xs text-slate-400 mt-1.5 px-1">Смена email адреса временно недоступна.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Имя пользователя</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Как вас зовут?"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving || !fullName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-xs cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
};