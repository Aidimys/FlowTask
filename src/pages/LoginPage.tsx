import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../providers/AuthProvider';
import { toast } from 'sonner';
import { Lock, Mail, User, KanbanSquare } from 'lucide-react';

export const LoginPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Пожалуйста, заполните все обязательные поля');
      return;
    }
    
    if (isRegister && !fullName) {
      toast.error('Пожалуйста, введите ваше имя');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: fullName,
            },
          },
        });
        
        if (error) throw error;
        
        toast.success('Регистрация успешна! Проверьте почту для подтверждения или воспользуйтесь входом (если подтверждение отключено).');
        setIsRegister(false); 
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        toast.success('С возвращением!');
        navigate('/dashboard');
      }
    } catch (error) {
      // Безопасно извлекаем сообщение об ошибке без использования any
      const errorMessage = error instanceof Error ? error.message : 'Произошла ошибка при аутентификации';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        
        {/* Логотип и заголовок */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <KanbanSquare className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            {isRegister ? 'Создать аккаунт' : 'Войти в TaskFlow'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Управляйте задачами эффективно и в realtime
          </p>
        </div>

        {/* Форма */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            
            {/* Поле Имени (только для регистрации) */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имя пользователя</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Иван Иванов"
                  />
                </div>
              </div>
            )}

            {/* Поле Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email адрес</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Поле Пароля */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Кнопка отправки */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isRegister ? (
                'Зарегистрироваться'
              ) : (
                'Войти'
              )}
            </button>
          </div>
        </form>

        {/* Переключатель режима формы */}
        <div className="text-center text-sm">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="font-medium text-blue-600 hover:text-blue-500 transition"
          >
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>

      </div>
    </div>
  );
};