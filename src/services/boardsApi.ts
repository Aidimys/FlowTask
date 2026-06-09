import { toast } from 'sonner';
import { supabase } from './supabase';

export const getBoards = async () => {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, owner_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || []; 
};

export const createBoard = async (title: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Пользователь не авторизован');

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .insert([{ title, owner_id: user.id }])
    .select()
    .single();

  if (boardError) throw new Error(boardError.message);

  const { error: memberError } = await supabase
    .from('board_members')
    .insert([{ board_id: board.id, user_id: user.id, role: 'owner' }]);

  if (memberError) throw new Error(memberError.message);

  const defaultColumns = ['To Do', 'In Progress', 'Done'];
  const columnsToInsert = defaultColumns.map((colTitle, index) => ({
    board_id: board.id,
    title: colTitle,
    position: index,
  }));

  const { error: columnsError } = await supabase
    .from('columns')
    .insert(columnsToInsert);

  if (columnsError) throw new Error(columnsError.message);

  return board;
};

export const deleteBoard = async (boardId: string) => {
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId);

  if (error) throw new Error(error.message);
};

export const getColumns = async (boardId: string) => {
  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

export const createColumn = async (boardId: string, title: string, position: number) => {
  const { data, error } = await supabase
    .from('columns')
    .insert([{ board_id: boardId, title, position }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Не удалось создать колонку');
  return data;
};

export const deleteColumn = async (columnId: string) => {
  const { error } = await supabase
    .from('columns')
    .delete()
    .eq('id', columnId);

  if (error) throw new Error(error.message);
};

export const updateColumnTitle = async (columnId: string, title: string) => {
  const { error } = await supabase
    .from('columns')
    .update({ title })
    .eq('id', columnId);

  if (error) throw new Error(error.message);
};

export const getTasks = async (boardId: string) => {
  const { data: columns } = await supabase
    .from('columns')
    .select('id')
    .eq('board_id', boardId);

  const columnIds = columns?.map(c => c.id) || [];

  if (columnIds.length === 0) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .in('column_id', columnIds)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

export const createTask = async (columnId: string, title: string, position: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');

  const { data, error } = await supabase
    .from('tasks')
    .insert([
      { 
        column_id: columnId, 
        title, 
        position, 
        created_by: user.id,
        priority: 'medium'
      }
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Не удалось создать задачу');
  return data;
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw new Error(error.message);
};

export const updateTaskPosition = async (taskId: string, columnId: string, position: number) => {
  const { error } = await supabase.rpc('reorder_tasks', {
    p_task_id: taskId,
    p_target_column_id: columnId,
    p_new_position: position
  });

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    toast.error(`Ошибка реордеринга задач: ${errorMessage}`);
    throw error;
  }
};
export const updateTaskDetails = async (
  taskId: string, 
  updates: { 
    title?: string;
    description?: string | null; 
    priority?: string | null; 
    due_date?: string | null;
    assignee_id?: string | null;
    column_id?: string;
    position?: number;
  }
) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Не удалось обновить задачу');
  return data;
};

export interface BoardMember {
  user_id: string;
  user_email: string;
  full_name: string;
  avatar_url: string;
  role: string;
}

export const getBoardMembers = async (boardId: string): Promise<BoardMember[]> => {
  const { data: members, error: membersError } = await supabase
    .from('board_members')
    .select('user_id, role')
    .eq('board_id', boardId);

  if (membersError) throw membersError;
  if (!members || members.length === 0) return [];

  const userIds = members.map(m => m.user_id);
  
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, name')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  return members.map(member => {
    const profile = profiles?.find(p => p.id === member.user_id);
    
    return {
      user_id: member.user_id,
      role: member.role,
      full_name: profile?.full_name || profile?.name || 'Пользователь',
      avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${member.user_id}`,
      user_email: profile?.name || '' 
    };
  });
};
export const getTaskComments = async (taskId: string) => {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

export const createTaskComment = async (taskId: string, content: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Пользователь не авторизован');

  const { data, error } = await supabase
    .from('comments')
    .insert([
      {
        task_id: taskId,
        user_id: user.id,
        content: content,
      }
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const deleteTaskComment = async (commentId: string) => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw new Error(error.message);
};

export const inviteUserByEmail = async (boardId: string, email: string): Promise<void> => {
  const { data: userId, error: rpcError } = await supabase
    .rpc('get_user_id_by_email', { email_text: email.trim() });

  if (rpcError) throw new Error(rpcError.message);
  if (!userId) {
    throw new Error('Пользователь с таким Email не зарегистрирован в системе');
  }

  const { error: insertError } = await supabase
    .from('board_members')
    .insert([{ board_id: boardId, user_id: userId, role: 'member' }]);

  if (insertError) {
    if (insertError.code === '23505') throw new Error('Этот пользователь уже является участником доски');
    throw new Error(insertError.message);
  }
};

export const getBoardDetails = async (boardId: string) => {
  const { data, error } = await supabase
    .from('boards')
    .select('owner_id, title')
    .eq('id', boardId)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getActivityLogs = async (boardId: string) => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      id,
      action_text,
      created_at,
      profiles (
        name,
        full_name,
        avatar_url
      )
    `)
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data || [];
};

export const createActivityLog = async (boardId: string, actionText: string) => {
  const { error } = await supabase
    .from('activity_logs')
    .insert([{ board_id: boardId, action_text: actionText }]);
  
  if (error) throw new Error(error.message);
};