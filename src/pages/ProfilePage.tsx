import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase'; 
import { User, Mail, Sparkles, Save, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (user) {
        setEmail(user.email || '');
        
        setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '');
        setAvatarUrl(user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.id}`);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          if ('name' in profileData && profileData.name) setFullName(profileData.name as string);
          if (profileData.avatar_url) setAvatarUrl(profileData.avatar_url);
        }
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке профиля:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    setAvatarUrl(`https://api.dicebear.com/7.x/lorelei/svg?seed=${randomSeed}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Пользователь не найден');

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: fullName,
          avatar_url: avatarUrl,
        } as any)
        .eq('id', user.id);

      if (profileError) throw profileError;
      await queryClient.invalidateQueries({ queryKey: ['board_members'] });
      setSuccessMessage('Профиль успешно обновлен!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Ошибка сохранения:', error.message);
      alert('Не удалось сохранить изменения: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Вернуться на доску
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-32 bg-linear-to-r from-indigo-500 to-purple-600 relative"></div>
          
          <div className="px-6 pb-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 mb-6">
              <div className="h-28 w-28 rounded-2xl border-4 border-white bg-slate-100 shadow-md overflow-hidden shrink-0">
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              </div>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={handleRandomizeAvatar}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-100 transition cursor-pointer border border-indigo-100"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Сгенерировать аватар
                </button>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-1">Личный кабинет</h2>
            <p className="text-sm text-slate-500 mb-6">Управление вашими личными данными.</p>

            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Email адрес (не меняется)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Ваше имя и фамилия
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Например, Иван Иванов"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Ссылка на аватар (URL)
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};