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