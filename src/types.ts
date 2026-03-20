export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  updated_at?: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface RoomMember {
  user_id: string;
  room_id: string;
  joined_at: string;
}
