-- См. структуру таблиц TaskFlow
CREATE TABLE public.boards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT boards_pkey PRIMARY KEY (id),
  CONSTRAINT boards_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);

CREATE TABLE public.board_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'member'::text])),
  CONSTRAINT board_members_pkey PRIMARY KEY (id),
  CONSTRAINT board_members_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(id),
  CONSTRAINT board_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.columns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  CONSTRAINT columns_pkey PRIMARY KEY (id),
  CONSTRAINT columns_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(id)
);

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  due_date date,
  assignee_id uuid,
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.columns(id),
  CONSTRAINT tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  avatar_url text,
  full_name text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  action_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.boards(id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- =====================================================================
-- Включаем защиту ROW LEVEL SECURITY на таблицах
-- =====================================================================
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Хелпер-функция для безопасного обхода рекурсии в RLS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_accessible_boards(user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER   -- Позволяет читать таблицы в обход RLS, разрывая бесконечный цикл
SET search_path = public
STABLE             -- Кэширует выполнение внутри одного транзакционного запроса
AS $$
  SELECT id FROM public.boards WHERE owner_id = $1
  UNION
  SELECT board_id FROM public.board_members WHERE user_id = $1;
$$;

-- =====================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ BOARDS (Доски)
-- =====================================================================
CREATE POLICY "boards_select_policy" ON public.boards
  FOR SELECT USING (id IN (SELECT public.get_accessible_boards(auth.uid())));

CREATE POLICY "boards_insert_policy" ON public.boards
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "boards_update_policy" ON public.boards
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "boards_delete_policy" ON public.boards
  FOR DELETE USING (auth.uid() = owner_id);

-- =====================================================================
-- ПОЛИТИКИ ДЛЯ ТАБЛИЦЫ BOARD_MEMBERS (Участники досок)
-- =====================================================================
CREATE POLICY "board_members_select_policy" ON public.board_members
  FOR SELECT USING (board_id IN (SELECT public.get_accessible_boards(auth.uid())));

CREATE POLICY "board_members_insert_policy" ON public.board_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND owner_id = auth.uid())
  );

-- Изменить/удалить участника может либо владелец доски, либо сам участник (выход из доски)
CREATE POLICY "board_members_delete_policy" ON public.board_members
  FOR DELETE USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND owner_id = auth.uid())
  );

-- =====================================================================
-- ПОЛЬЗОВАТЕЛЬСКИЕ ФУНКЦИИ И VIEW
-- =====================================================================

-- Создание функции для поиска ID пользователя по Email (исправлен запрос к auth.users)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(target_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- позволяет заглядывать в закрытую схему auth
AS $$
DECLARE
    found_user_id uuid;
BEGIN
    -- Ищем пользователя напрямую в системной таблице auth.users по email
    SELECT id INTO found_user_id
    FROM auth.users
    WHERE email = target_email
    LIMIT 1;

    RETURN found_user_id;
END;
$$;

-- Создание View для получения участников доски вместе с их email из auth.users
CREATE OR REPLACE VIEW public.board_members_with_emails AS
SELECT 
    bm.user_id,
    bm.board_id,
    bm.role,
    p.full_name,
    p.avatar_url,
    u.email AS user_email
FROM public.board_members bm
LEFT JOIN public.profiles p ON bm.user_id = p.id
LEFT JOIN auth.users u ON bm.user_id = u.id;