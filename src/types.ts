export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  status?: string;
  wallpaper_url?: string;
  theme_preference?: string;
  bio?: string;
  last_seen?: string;
  updated_at?: string;
  is_ai_bot?: boolean;
  bot_persona?: string;
  current_song?: {
    title: string;
    artist: string;
    album_art?: string;
    is_playing: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    updated_at: string;
  };
  close_friends?: string[]; // Array of user IDs
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
  expires_at: string;
  is_close_friends_only?: boolean;
  profiles?: Profile;
  views?: StoryView[];
}

export interface StoryView {
  id: string;
  story_id: string;
  user_id: string;
  viewed_at: string;
  profiles?: Profile;
}

export interface Room {
  id: string;
  name?: string;
  code?: string;
  is_direct?: boolean;
  vanish_mode?: boolean;
  type?: 'group' | 'direct' | 'channel' | 'community';
  community_id?: string;
  created_by: string;
  created_at: string;
  other_user_profile?: Profile; // Virtual property for DMs
  unread_count?: number; // Virtual property
  last_message_at?: string; // Virtual property
  streak_count?: number; // Virtual property
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // Array of user IDs
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  is_multiple_choice: boolean;
  expires_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  audio_url?: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  is_pinned?: boolean;
  is_starred?: boolean;
  is_bookmarked?: boolean;
  is_forwarded?: boolean;
  is_view_once?: boolean;
  is_viewed?: boolean;
  translation?: string;
  reply_to_id?: string;
  reply_to?: string;
  reply_to_message?: Message;
  poll?: Poll;
  poll_id?: string;
  scheduled_at?: string;
  transcription?: string;
  link_preview?: {
    title?: string;
    description?: string;
    image?: string;
    url: string;
  };
  read_by?: string[];
  read_at?: string;
  created_at: string;
  updated_at?: string;
  is_read?: boolean;
  is_delivered?: boolean;
  profiles?: Profile;
  reactions?: Reaction[];
}

export interface RoomMember {
  user_id: string;
  room_id: string;
  joined_at: string;
}
