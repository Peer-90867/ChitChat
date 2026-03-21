export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  status?: string;
  updated_at?: string;
}

export interface Room {
  id: string;
  name?: string;
  code?: string;
  is_direct?: boolean;
  created_by: string;
  created_at: string;
  other_user_profile?: Profile; // Virtual property for DMs
  unread_count?: number; // Virtual property
  last_message_at?: string; // Virtual property
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  audio_url?: string;
  image_url?: string;
  is_pinned?: boolean;
  reply_to_id?: string;
  reply_to_message?: Message;
  link_preview?: {
    title?: string;
    description?: string;
    image?: string;
    url: string;
  };
  created_at: string;
  updated_at?: string;
  is_read?: boolean;
  profiles?: Profile;
  reactions?: Reaction[];
}

export interface RoomMember {
  user_id: string;
  room_id: string;
  joined_at: string;
}
