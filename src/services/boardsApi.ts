import { supabase } from './supabase';

export const getBoards = async () => {
  const { data, error } = await supabase
  .from('boards')
  .select('id, title,created_at, owner_id');
  if (error) {
    console.error('Error fetching boards:', error);
    throw error;
  }
  return data;
};

export const createBoard = async (title: string) =>{
    const {data : {user}} = await supabase.auth.getUser();

    if(!user) {
        throw new Error('User not authenticated');
    }

    const {data: board, error: boardError} = await supabase
    .from('boards')
    .insert([{title, owner_id: user.id}])
    .select()
    .single();

    if(boardError) {
        console.error('Error creating board:', boardError);
        throw boardError;
    }

    const {error: memberError} = await supabase
    .from('board_members')
    .insert([{board_id: board.id, user_id: user.id, role: 'owner'}]);

    if(memberError) {
        console.error('Error adding board member:', memberError);
        throw memberError;
    }

    return board;
}

export const deleteBoard = async (boardId: string) => {
    const {error} = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId);

    if(error) {
        console.error('Error deleting board:', error);
        throw error;
    }
}