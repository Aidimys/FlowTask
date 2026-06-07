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

-- Включаем защиту на таблицах
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Политики для досок (просмотр владельцами и участниками)
CREATE POLICY "Users can view boards they are members or owners of" ON public.boards
    FOR SELECT USING (
        auth.uid() = owner_id OR 
        EXISTS (SELECT 1 FROM public.board_members WHERE board_members.board_id = boards.id AND board_members.user_id = auth.uid())
    );

-- Политики для участников (видеть участников могут только члены этой доски)
CREATE POLICY "Members can view board participants" ON public.board_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = board_members.board_id AND bm.user_id = auth.uid())
    );


-- Создание функции для поиска ID пользователя по Email
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(target_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- позволяет обходить ограничения схем auth
AS $$
DECLARE
    found_user_id uuid;
BEGIN
    -- Ищем пользователя в таблице профилей по email
    SELECT id INTO found_user_id
    FROM public.profiles
    WHERE email = target_email
    LIMIT 1;

    -- Если не нашли, возвращаем NULL (фронтенд поймет, что юзера нет)
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