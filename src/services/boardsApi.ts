import { supabase } from './supabase';

export const getBoards = async () => {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, owner_id, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
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
  return data;
};

export const createColumn = async (boardId: string, title: string, position: number) => {
  const { data, error } = await supabase
    .from('columns')
    .insert([{ board_id: boardId, title, position }])
    .select()
    .single();

  if (error) throw new Error(error.message);
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
  return data;
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
  const { error } = await supabase
    .from('tasks')
    .update({ column_id: columnId, position })
    .eq('id', taskId);

  if (error) throw new Error(error.message);

};

export const updateTaskDetails = async (
  taskId: string, 
  updates: { 
    description?: string; 
    priority?: 'low' | 'medium' | 'high';
    due_date?: string | null;
    assignee_id?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const getBoardMembers = async (boardId: string) => {
  const { data, error } = await (supabase as any)
    .from('board_members_with_emails')
    .select('user_id, user_email, full_name, avatar_url')
    .eq('board_id', boardId);

  if (error) throw new Error(error.message);

  return (data || []).map((m: any) => ({
    user_id: m.user_id,
    user_email: m.user_email,
    full_name: m.full_name || '',
    avatar_url: m.avatar_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${m.user_id}`
  }));
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


export const inviteUserByEmail = async (boardId: string, email: string) => {
  const { data: userId, error: rpcError } = await (supabase as any)
    .rpc('get_user_id_by_email', { email_text: email.trim() });

  if (rpcError) throw new Error(rpcError.message);
  if (!userId) throw new Error('Пользователь с таким email не найден');

  const { error: insertError } = await supabase
    .from('board_members')
    .insert([{ board_id: boardId, user_id: userId, role: 'member' }]);

  if (insertError) {
    if (insertError.code === '23505') throw new Error('Этот... пользователь уже на доске');
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
  const { data, error } = await (supabase as any)
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
  return data;
};

export const createActivityLog = async (boardId: string, actionText: string) => {
  const { error } = await (supabase as any)
    .from('activity_logs')
    .insert([{ board_id: boardId, action_text: actionText }]);
  
  if (error) throw new Error(error.message);
};