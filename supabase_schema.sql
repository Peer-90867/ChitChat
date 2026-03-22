-- Create tables for the chat application
-- Note: This is a simplified schema. Adjust based on your specific requirements.

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  avatar_url TEXT,
  status TEXT,
  wallpaper_url TEXT,
  theme_preference TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT,
  code TEXT UNIQUE,
  is_direct BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Room Members Table
CREATE TABLE IF NOT EXISTS room_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(room_id, user_id)
);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  audio_url TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Reactions Table
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(message_id, user_id, emoji)
);

-- 6. Polls Table
CREATE TABLE IF NOT EXISTS polls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. Poll Options Table
CREATE TABLE IF NOT EXISTS poll_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL
);

-- 8. Poll Votes Table
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(poll_option_id, user_id)
);
