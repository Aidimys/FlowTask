create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  email text
);

create table public.boards (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  owner_id uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.board_members (
  id uuid default gen_random_uuid() primary key,
  board_id uuid references public.boards(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member'::text,
  unique(board_id, user_id)
);


create table public.columns (
  id uuid default gen_random_uuid() primary key,
  board_id uuid references public.boards(id) on delete cascade,
  title text not null,
  position integer not null
);

create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  column_id uuid references public.columns(id) on delete cascade,
  title text not null,
  description text,
  position integer not null,
  priority text default 'medium'::text,
  due_date timestamp with time zone,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create or replace function public.get_user_id_by_email(email_text text)
returns uuid
security definer
language plpgsql
as $$
declare
  target_uid uuid;
begin
  select id into target_uid from public.profiles where email = email_text limit 1;
  return target_uid;
end;
$$;

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;

create policy "Users can view boards they are members of" on public.boards
  for select using (
    exists (select 1 from public.board_members where board_id = boards.id and user_id = auth.uid())
  );

create policy "Owners can delete their boards" on public.boards
  for delete using (owner_id = auth.uid());