import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { supabase, hasValidSupabase } from '@/src/lib/supabase';
import { Room, Message, Profile } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  MessageSquare, 
  Plus, 
  Hash, 
  LogOut, 
  Settings, 
  Send,
  User,
  Users,
  Search,
  Copy,
  Check,
  ChevronRight,
  MoreVertical,
  Menu,
  X,
  History,
  AlertCircle,
  Smile,
  Mic,
  Square,
  Trash2,
  Play,
  Pause,
  Volume2,
  Pencil,
  Camera,
  Upload,
  Crown,
  Image as ImageIcon,
  Pin,
  PinOff,
  Paperclip,
  SmilePlus,
  Sun,
  Moon,
  Bell,
  BellOff,
  VolumeX,
  CheckCheck,
  Filter,
  Reply,
  CornerUpLeft,
  Palette,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { customAlphabet } from 'nanoid';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { Toast } from '../ui/Toast';
import { fetchLinkPreview } from '@/src/services/geminiService';
import { LinkPreview } from './LinkPreview';
import { ExternalLink } from 'lucide-react';
import { validateImage, compressImage } from '@/src/lib/imageUtils';
import { useTheme } from '../../context/ThemeContext';
import Cropper, { Area, Point } from 'react-easy-crop';
import getCroppedImg from '@/src/lib/cropImage';

const generateRoomCode = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

const HighlightedText = ({ children, query }: { children: string; query: string }) => {
  if (!query.trim()) return <>{children}</>;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = children.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const ChatDashboard = ({ user }: { user: any }) => {
  const { theme, toggleTheme } = useTheme();
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error'; action?: { label: string; onClick: () => void } }[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success', action?: { label: string; onClick: () => void }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000); // Increased to 5s to give time for Undo
  };

  const [rooms, setRooms] = useState<Room[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'unread'>('unread');
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false);
  const [showStorageGuide, setShowStorageGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMobileRoomMenu, setShowMobileRoomMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState<Profile[]>([]);
  const [isSearchingDMs, setIsSearchingDMs] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editRoomName, setEditRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [pendingEditMessageId, setPendingEditMessageId] = useState<string | null>(null);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
  const [roomContextMenu, setRoomContextMenu] = useState<{ x: number; y: number; roomId: string } | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const MESSAGES_PER_PAGE = 30;

  const groupRooms = rooms.filter(r => !r.is_direct);
  const directMessages = rooms.filter(r => r.is_direct);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [globalNotificationsEnabled, setGlobalNotificationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('globalNotificationsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [mutedRooms, setMutedRooms] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('mutedRooms');
    return saved !== null ? new Set(JSON.parse(saved)) : new Set();
  });
  const [roomSounds, setRoomSounds] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('roomSounds');
    return saved !== null ? JSON.parse(saved) : {};
  });
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('snoozeUntil');
    return saved !== null ? JSON.parse(saved) : null;
  });
  const [notificationSound, setNotificationSound] = useState<string>(() => {
    return localStorage.getItem('notificationSound') || 'pop';
  });
  const [chatTheme, setChatTheme] = useState<string>(() => {
    return localStorage.getItem('chatTheme') || 'default';
  });
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
    return localStorage.getItem('chatWallpaper') || '';
  });

  useEffect(() => {
    localStorage.setItem('globalNotificationsEnabled', JSON.stringify(globalNotificationsEnabled));
  }, [globalNotificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('mutedRooms', JSON.stringify(Array.from(mutedRooms)));
  }, [mutedRooms]);

  useEffect(() => {
    localStorage.setItem('roomSounds', JSON.stringify(roomSounds));
  }, [roomSounds]);

  useEffect(() => {
    localStorage.setItem('snoozeUntil', JSON.stringify(snoozeUntil));
  }, [snoozeUntil]);

  useEffect(() => {
    localStorage.setItem('notificationSound', notificationSound);
  }, [notificationSound]);

  useEffect(() => {
    localStorage.setItem('chatTheme', chatTheme);
  }, [chatTheme]);

  useEffect(() => {
    localStorage.setItem('chatWallpaper', chatWallpaper);
  }, [chatWallpaper]);

  const NOTIFICATION_SOUNDS = {
    none: null,
    pop: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
    ding: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
    chime: 'https://assets.mixkit.co/active_storage/sfx/2361/2361-preview.mp3',
    bubble: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3',
  };

  const playNotificationSound = (roomId?: string) => {
    const soundKey = (roomId && roomSounds[roomId]) || notificationSound;
    const soundUrl = NOTIFICATION_SOUNDS[soundKey as keyof typeof NOTIFICATION_SOUNDS];
    if (soundUrl) {
      const audio = new Audio(soundUrl);
      audio.play().catch(err => console.error('Error playing notification sound:', err));
    }
  };

  const toggleRoomMute = (roomId: string) => {
    setMutedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('This browser does not support notifications.', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast('Notifications enabled!');
      } else {
        showToast('Notifications disabled.', 'error');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      showToast('Failed to request notification permission', 'error');
    }
  };

  const showNotification = (title: string, body: string, roomId: string, icon?: string) => {
    if (!globalNotificationsEnabled) return;
    if (mutedRooms.has(roomId)) return;

    // Check for snooze
    if (snoozeUntil && Date.now() < snoozeUntil) return;

    // Play sound if window is hidden OR if it's not the active room
    if (document.visibilityState === 'hidden' || activeRoom?.id !== roomId) {
      playNotificationSound(roomId);
    }

    if (notificationPermission === 'granted' && document.visibilityState === 'hidden') {
      try {
        const notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
  };
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeChannelRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView) {
      loadMoreMessages();
    }
  }, [inView]);

  const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '🙏', '✅', '👀', '✨', '🎉', '💯', '🚀', '🤔', '👏', '🙌'];

  useEffect(() => {
    fetchProfile();
    fetchRooms();
    
    // Set initial members visibility
    if (window.innerWidth >= 1024) {
      setShowMembers(true);
    }

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowMembers(false);
      } else {
        setShowMembers(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dmSearchQuery) {
        searchUsers(dmSearchQuery);
      } else {
        setDmSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dmSearchQuery]);

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [sortBy]);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setRoomContextMenu(null);
    };
    const handleScroll = () => {
      setContextMenu(null);
      setRoomContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  useEffect(() => {
    if (activeRoom) {
      setMessages([]);
      setMembers([]);
      setIsAtBottom(true);
      setHasUnread(false);
      setHasMore(true);
      fetchMessages(activeRoom.id);
      fetchMembers(activeRoom.id);
      
      // Subscribe to real-time messages, members, and presence
      const channel = supabase.channel(`room:${activeRoom.id}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      activeChannelRef.current = channel;

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${activeRoom.id}`
          },
          async (payload) => {
            const newMessage = payload.new as Message;
            // Fetch profile for the new message to show username/avatar
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newMessage.user_id)
              .single();
            
            let replyToMessage = null;
            if (newMessage.reply_to_id) {
              const { data: replyData } = await supabase
                .from('messages')
                .select('*, profiles(*)')
                .eq('id', newMessage.reply_to_id)
                .single();
              replyToMessage = replyData;
            }
            
            setMessages(prev => {
              // Prevent duplicate messages if the user sent it themselves and it's already in state
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, { ...newMessage, profiles: profileData, reply_to_message: replyToMessage }];
            });

            // Mark as read if it's a DM and we're the recipient
            if (activeRoom.is_direct && newMessage.user_id !== user.id) {
              markMessagesAsRead(activeRoom.id);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${activeRoom.id}`
          },
          async (payload) => {
            const updatedMessage = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${activeRoom.id}`
          },
          (payload) => {
            const deletedMessageId = payload.old.id;
            setMessages(prev => prev.filter(m => m.id !== deletedMessageId));
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_members',
            filter: `room_id=eq.${activeRoom.id}`
          },
          () => {
            // Refresh members list when someone joins or leaves
            fetchMembers(activeRoom.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reactions',
          },
          async (payload) => {
            // Refresh messages to get updated reactions
            if (activeRoom) fetchMessages(activeRoom.id);
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const onlineIds = new Set<string>();
          const typingUsernames = new Set<string>();
          
          Object.keys(state).forEach((key) => {
            onlineIds.add(key);
            const userPresence = state[key] as any[];
            if (userPresence && userPresence[0]?.is_typing && key !== user.id) {
              typingUsernames.add(userPresence[0].username || 'Someone');
            }
          });
          
          setOnlineUsers(onlineIds);
          setTypingUsers(typingUsernames);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
          
          if (key !== user.id && newPresences[0]?.is_typing) {
            setTypingUsers(prev => {
              const next = new Set(prev);
              next.add(newPresences[0].username || 'Someone');
              return next;
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
          
          if (leftPresences[0]?.username) {
            setTypingUsers(prev => {
              const next = new Set(prev);
              next.delete(leftPresences[0].username);
              return next;
            });
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              username: profile?.username || user.email?.split('@')[0] || 'user',
              online_at: new Date().toISOString(),
              is_typing: false
            });
          }
        });

      // Polling fallback: Refresh messages every 0.3 seconds as requested
      const pollingInterval = setInterval(() => {
        if (hasValidSupabase && activeRoom) {
          fetchMessages(activeRoom.id, true);
        }
      }, 300);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollingInterval);
        activeChannelRef.current = null;
      };
    }
  }, [activeRoom, profile]);

  useEffect(() => {
    if (!user || rooms.length === 0) return;

    const channel = supabase.channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Don't notify for own messages
          if (newMessage.user_id === user.id) return;
          
          // Check if message is in one of the user's rooms
          const room = rooms.find(r => r.id === newMessage.room_id);
          if (!room) return;

          // Fetch sender profile for notification
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newMessage.user_id)
            .single();

          const senderName = profileData?.username || 'Someone';
          const roomName = room.name || 'a room';
          
          const notificationTitle = room.is_direct 
            ? `New message from ${senderName}` 
            : `New message in ${roomName}`;

          showNotification(
            notificationTitle,
            `${senderName}: ${newMessage.content.substring(0, 100)}${newMessage.content.length > 100 ? '...' : ''}`,
            newMessage.room_id,
            profileData?.avatar_url
          );

          // Update local rooms state to increment unread count and update last message timestamp
          setRooms(prev => {
            const updatedRooms = prev.map(r => {
              if (r.id === newMessage.room_id) {
                // Only increment unread if it's not the active room
                const isUnread = activeRoom?.id !== r.id;
                return { 
                  ...r, 
                  unread_count: isUnread ? (r.unread_count || 0) + 1 : 0,
                  last_message_at: newMessage.created_at
                };
              }
              return r;
            });

            // Re-sort if needed
            return [...updatedRooms].sort((a, b) => {
              if (sortBy === 'unread') {
                if (a.unread_count !== b.unread_count) {
                  return (b.unread_count || 0) - (a.unread_count || 0);
                }
              }
              const timeA = new Date(a.last_message_at || a.created_at).getTime();
              const timeB = new Date(b.last_message_at || b.created_at).getTime();
              return timeB - timeA;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, rooms, notificationPermission]);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
      setHasUnread(false);
    } else if (messages.length > 0) {
      setHasUnread(true);
    }
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Open Settings (Profile Modal)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowProfileModal(true);
      }

      // Ctrl/Cmd + ArrowUp / ArrowDown: Switch Rooms
      if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (rooms.length === 0) return;

        const currentIndex = activeRoom ? rooms.findIndex(r => r.id === activeRoom.id) : -1;
        let nextIndex;

        if (e.key === 'ArrowUp') {
          nextIndex = currentIndex <= 0 ? rooms.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === rooms.length - 1 ? 0 : currentIndex + 1;
        }

        setActiveRoom(rooms[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rooms, activeRoom]);

  const scrollToBottom = (force = false) => {
    if (force || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    
    // If we are within 50px of the bottom, consider it "at bottom"
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasUnread(false);
    }
  };

  const loadMoreMessages = () => {
    if (!activeRoom || !hasMore || isLoadingMore || messages.length === 0) return;
    const firstMessage = messages[0];
    fetchMessages(activeRoom.id, false, firstMessage.created_at);
  };

  const fetchProfile = async () => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) {
        // Create profile if it doesn't exist (resilience for missing triggers)
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{ id: user.id, username: user.email?.split('@')[0] || 'user' }])
          .select()
          .single();
        
        if (createError) throw createError;
        data = newProfile;
      }
      
      if (data) {
        setProfile(data);
        setEditUsername(data.username || '');
        setEditStatus(data.status || '');
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile settings', 'error');
    }
  };

  const onCropComplete = (_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      if (croppedImage) {
        const compressed = await compressImage(new File([croppedImage], avatarFileName || 'avatar.jpg', { type: 'image/jpeg' }));
        setAvatarFile(compressed);
        setAvatarPreview(URL.createObjectURL(compressed));
        setIsCropping(false);
        setImageToCrop(null);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
      showToast('Failed to crop image', 'error');
    }
  };

  const handleUpdateProfile = async () => {
    if (!editUsername.trim()) return;
    setIsUploadingAvatar(true);
    
    try {
      let avatarUrl = profile?.avatar_url;

      if (avatarFile) {
        const fileExt = avatarFileName.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          if (uploadError.message.toLowerCase().includes('bucket not found')) {
            showToast('Storage bucket "avatars" is missing. Please create a public bucket named "avatars" in your Supabase project.', 'error');
            throw new Error('Bucket "avatars" not found. Please create it in your Supabase Storage dashboard.');
          }
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: editUsername, 
          status: editStatus,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, username: editUsername, status: editStatus, avatar_url: avatarUrl } : null);
      setShowProfileModal(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      showToast('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!activeRoom || !editRoomName.trim()) return;
    
    const { error } = await supabase
      .from('rooms')
      .update({ name: editRoomName })
      .eq('id', activeRoom.id);

    if (!error) {
      const updatedRoom = { ...activeRoom, name: editRoomName };
      setActiveRoom(updatedRoom);
      setRooms(prev => prev.map(r => r.id === activeRoom.id ? updatedRoom : r));
      setShowRoomSettingsModal(false);
      showToast('Room name updated successfully!');
    } else {
      showToast(error.message, 'error');
    }
  };

  const handleDeleteRoom = async () => {
    if (!activeRoom) return;
    
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', activeRoom.id);

    if (!error) {
      setRooms(prev => prev.filter(r => r.id !== activeRoom.id));
      setActiveRoom(null);
      setShowRoomSettingsModal(false);
      setIsDeleting(false);
      showToast('Room deleted successfully!');
    } else {
      showToast(error.message, 'error');
    }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;

    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', activeRoom.id)
      .eq('user_id', user.id);

    if (!error) {
      setRooms(prev => prev.filter(r => r.id !== activeRoom.id));
      setActiveRoom(null);
      setShowRoomSettingsModal(false);
      setIsLeaving(false);
      showToast('Left room successfully!');
    } else {
      showToast(error.message, 'error');
    }
  };

  const markMessagesAsRead = async (roomId: string) => {
    if (!user || !activeRoom?.is_direct || !document.hasFocus()) return;

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
    } else {
      // Update local rooms state to clear unread count
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unread_count: 0 } : r));
    }
  };

  const markRoomAsUnread = async (roomId: string) => {
    const { data: latestMessage, error } = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestMessage) return;

    const { error: updateError } = await supabase
      .from('messages')
      .update({ is_read: false })
      .eq('id', latestMessage.id);

    if (!updateError) {
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unread_count: (r.unread_count || 0) + 1 } : r));
    }
  };

  useEffect(() => {
    const handleFocus = () => {
      if (activeRoom?.is_direct) {
        markMessagesAsRead(activeRoom.id);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeRoom, user]);

  const handleEditMessage = async (messageId: string) => {
    if (!editMessageContent.trim()) return;
    
    const url = extractUrl(editMessageContent);
    let linkPreview = null;
    if (url) {
      linkPreview = await fetchLinkPreview(url);
    }

    const { error } = await supabase
      .from('messages')
      .update({ 
        content: editMessageContent, 
        updated_at: new Date().toISOString(),
        link_preview: linkPreview
      })
      .eq('id', messageId);

    if (!error) {
      setEditingMessageId(null);
      setEditMessageContent('');
      showToast('Message edited successfully!');
    } else {
      showToast(error.message, 'error');
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    const { error } = await supabase
      .from('reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji
      });

    if (error) {
      showToast('Failed to add reaction', 'error');
    }
  };

  const removeReaction = async (reactionId: string) => {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('id', reactionId);

    if (error) {
      showToast('Failed to remove reaction', 'error');
    }
  };

  const extractUrl = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const lastDeletedMessageRef = useRef<Message | null>(null);

  const handleDeleteMessage = async () => {
    if (!messageToDeleteId) return;
    
    const messageToDelete = messages.find(m => m.id === messageToDeleteId);
    if (!messageToDelete) return;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageToDeleteId);

    if (!error) {
      lastDeletedMessageRef.current = messageToDelete;
      setMessageToDeleteId(null);
      showToast('Message deleted', 'success', {
        label: 'Undo',
        onClick: async () => {
          if (lastDeletedMessageRef.current) {
            const { error: restoreError } = await supabase
              .from('messages')
              .insert([{
                room_id: lastDeletedMessageRef.current.room_id,
                user_id: lastDeletedMessageRef.current.user_id,
                content: lastDeletedMessageRef.current.content,
                audio_url: lastDeletedMessageRef.current.audio_url,
                image_url: lastDeletedMessageRef.current.image_url,
                file_url: lastDeletedMessageRef.current.file_url,
                file_name: lastDeletedMessageRef.current.file_name,
                file_size: lastDeletedMessageRef.current.file_size,
                file_type: lastDeletedMessageRef.current.file_type,
                reply_to_id: lastDeletedMessageRef.current.reply_to_id,
                is_pinned: lastDeletedMessageRef.current.is_pinned,
                created_at: lastDeletedMessageRef.current.created_at // Try to keep original timestamp
              }]);
            
            if (restoreError) {
              showToast('Failed to undo deletion', 'error');
            } else {
              showToast('Message restored!');
              lastDeletedMessageRef.current = null;
            }
          }
        }
      });
    } else {
      showToast(error.message, 'error');
    }
  };

  const handleTyping = async () => {
    if (!activeChannelRef.current) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update presence to typing: true
    await activeChannelRef.current.track({
      user_id: user.id,
      username: profile?.username || user.email?.split('@')[0] || 'user',
      online_at: new Date().toISOString(),
      is_typing: true
    });

    // Set timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(async () => {
      if (activeChannelRef.current) {
        await activeChannelRef.current.track({
          user_id: user.id,
          username: profile?.username || user.email?.split('@')[0] || 'user',
          online_at: new Date().toISOString(),
          is_typing: false
        });
      }
      typingTimeoutRef.current = null;
    }, 3000);
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data: memberData, error: memberError } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user.id);
      
      if (memberError) throw memberError;
      
      if (memberData && memberData.length > 0) {
        const roomIds = memberData.map(m => m.room_id);
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .in('id', roomIds)
          .order('created_at', { ascending: false });
        
        if (roomsError) throw roomsError;

        // For DMs, we need the other user's profile
        const directRoomIds = roomsData.filter(r => r.is_direct).map(r => r.id);
        
        // Fetch unread counts for DMs
        const { data: unreadMessages } = await supabase
          .from('messages')
          .select('room_id')
          .neq('user_id', user.id)
          .eq('is_read', false)
          .in('room_id', roomIds);

        const unreadCounts = (unreadMessages || []).reduce((acc: Record<string, number>, msg) => {
          acc[msg.room_id] = (acc[msg.room_id] || 0) + 1;
          return acc;
        }, {});

        // Fetch last message timestamp for each room
        const { data: lastMessages } = await supabase
          .from('messages')
          .select('room_id, created_at')
          .in('room_id', roomIds)
          .order('created_at', { ascending: false });

        const lastMessageMap = (lastMessages || []).reduce((acc: Record<string, string>, msg) => {
          if (!acc[msg.room_id]) {
            acc[msg.room_id] = msg.created_at;
          }
          return acc;
        }, {});

        let dmProfiles: Record<string, Profile> = {};
        if (directRoomIds.length > 0) {
          const { data: dmMemberData, error: dmMemberError } = await supabase
            .from('room_members')
            .select('room_id, user_id')
            .in('room_id', directRoomIds)
            .neq('user_id', user.id);
          
          if (!dmMemberError && dmMemberData) {
            const otherUserIds = dmMemberData.map(m => m.user_id);
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .in('id', otherUserIds);
            
            if (profileData) {
              const profileMap = Object.fromEntries(profileData.map(p => [p.id, p]));
              dmMemberData.forEach(m => {
                if (profileMap[m.user_id]) {
                  dmProfiles[m.room_id] = profileMap[m.user_id];
                }
              });
            }
          }
        }

        const formattedRooms = roomsData.map(room => ({
          ...room,
          other_user_profile: dmProfiles[room.id],
          unread_count: unreadCounts[room.id] || 0,
          last_message_at: lastMessageMap[room.id] || room.created_at
        }));

        // Sort rooms based on sortBy preference
        const sortedRooms = [...formattedRooms].sort((a, b) => {
          if (sortBy === 'unread') {
            // Unread messages first
            if (a.unread_count !== b.unread_count) {
              return (b.unread_count || 0) - (a.unread_count || 0);
            }
          }
          // Then by last message activity
          const timeA = new Date(a.last_message_at || a.created_at).getTime();
          const timeB = new Date(b.last_message_at || b.created_at).getTime();
          return timeB - timeA;
        });

        setRooms(sortedRooms);
        if (sortedRooms.length > 0 && !activeRoom) {
          setActiveRoom(sortedRooms[0]);
        }
      } else {
        setRooms([]);
      }
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      showToast('Failed to load your rooms', 'error');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setDmSearchResults([]);
      return;
    }

    try {
      setIsSearchingDMs(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;
      setDmSearchResults(data || []);
    } catch (error: any) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearchingDMs(false);
    }
  };

  const handleStartDM = async (targetUser: Profile) => {
    if (!user || !targetUser || targetUser.id === user.id) return;

    try {
      // 1. Find all rooms where current user is a member
      const { data: myRooms, error: myRoomsError } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user.id);
      
      if (myRoomsError) throw myRoomsError;
      
      const myRoomIds = myRooms?.map(m => m.room_id) || [];
      
      if (myRoomIds.length > 0) {
        // 2. Find if any of these rooms also have the target user as a member
        const { data: commonRooms, error: commonError } = await supabase
          .from('room_members')
          .select('room_id')
          .in('room_id', myRoomIds)
          .eq('user_id', targetUser.id);
          
        if (commonError) throw commonError;
        
        const commonRoomIds = commonRooms?.map(m => m.room_id) || [];
        
        if (commonRoomIds.length > 0) {
          // 3. Check if any of these common rooms are direct messages
          const { data: existingRoom, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .in('id', commonRoomIds)
            .eq('is_direct', true)
            .maybeSingle();
            
          if (roomError) throw roomError;
          
          if (existingRoom) {
            setActiveRoom({ ...existingRoom, other_user_profile: targetUser });
            setShowMembers(false);
            setIsMobileMenuOpen(false);
            return;
          }
        }
      }

      // 4. Create new DM room if none exists
      // Use a random 6-char code to satisfy potential VARCHAR(6) limit
      const dmCode = generateRoomCode();

      const { data: newRoom, error: createError } = await supabase
        .from('rooms')
        .insert({
          name: `DM: ${targetUser.username}`,
          code: dmCode,
          is_direct: true,
          created_by: user.id
        })
        .select()
        .single();

      if (createError) throw createError;
      if (!newRoom) throw new Error('Failed to create room');

      // Add both users to room_members
      const { error: memberError } = await supabase
        .from('room_members')
        .insert([
          { room_id: newRoom.id, user_id: user.id },
          { room_id: newRoom.id, user_id: targetUser.id }
        ]);

      if (memberError) throw memberError;

      const roomWithProfile = { ...newRoom, other_user_profile: targetUser };
      setRooms(prev => [roomWithProfile, ...prev]);
      setActiveRoom(roomWithProfile);
      setShowMembers(false);
      setIsMobileMenuOpen(false);
      showToast(`Started conversation with ${targetUser.username}`);
    } catch (error: any) {
      console.error('Error starting DM:', error);
      showToast(`Failed to start direct message: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  const isFetchingRef = useRef(false);

  const fetchMessages = async (roomId: string, isPolling = false, before?: string) => {
    if (isFetchingRef.current && isPolling) return;
    if (isLoadingMore && before) return;
    
    if (before) setIsLoadingMore(true);
    if (isPolling) isFetchingRef.current = true;

    try {
      let query = supabase
        .from('messages')
        .select(`
          *,
          reactions (*),
          reply_to_message:reply_to_id(*, profiles(*))
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data: messagesData, error: messagesError } = await query;
      
      if (messagesError) throw messagesError;
      
      if (messagesData) {
        const chronMessages = [...messagesData].reverse();
        const userIds = [...new Set(messagesData.map(m => m.user_id))];
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
          
        if (profilesError) throw profilesError;
        
        const messagesWithProfiles = chronMessages.map(m => ({
          ...m,
          profiles: profilesData?.find(p => p.id === m.user_id)
        }));
        
        if (before) {
          const container = messagesContainerRef.current;
          const oldScrollHeight = container?.scrollHeight || 0;

          setMessages(prev => [...messagesWithProfiles, ...prev]);
          setHasMore(messagesData.length === MESSAGES_PER_PAGE);
          
          setTimeout(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - oldScrollHeight;
            }
          }, 0);
        } else {
          // When polling, we only want to add NEW messages, not replace everything
          if (isPolling) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMessages = messagesWithProfiles.filter(m => !existingIds.has(m.id));
              if (newMessages.length === 0) return prev;
              return [...prev, ...newMessages].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          } else {
            setMessages(messagesWithProfiles);
            setHasMore(messagesData.length === MESSAGES_PER_PAGE);
            
            setTimeout(() => {
              if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
              }
            }, 100);
          }
        }

        if (activeRoom?.is_direct) {
          markMessagesAsRead(roomId);
        }
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      if (!isPolling) {
        showToast(`Failed to load message history: ${error.message || 'Unknown error'}`, 'error');
      }
    } finally {
      if (before) setIsLoadingMore(false);
      if (isPolling) isFetchingRef.current = false;
    }
  };

  const fetchMembers = async (roomId: string) => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId);
      
      if (memberError) throw memberError;
      
      if (memberData && memberData.length > 0) {
        const userIds = memberData.map(m => m.user_id);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        
        if (profileError) throw profileError;
        setMembers(profileData || []);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      showToast(`Failed to load room members: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setLoading(true);
    const code = generateRoomCode();
    
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert([{ name: newRoomName, code, created_by: user.id }])
        .select()
        .single();

      if (roomError) throw roomError;

      if (room) {
        const { error: memberError } = await supabase
          .from('room_members')
          .insert([{ user_id: user.id, room_id: room.id }]);
        
        if (memberError) throw memberError;

        setRooms(prev => [...prev, room]);
        setActiveRoom(room);
        setShowCreateModal(false);
        setNewRoomName('');
        showToast(`Room "${room.name}" created successfully!`);
      }
    } catch (error: any) {
      console.error('Error creating room:', error);
      showToast(error.message || 'Failed to create room', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    const trimmedCode = joinCode.trim().toUpperCase();
    if (trimmedCode.length !== 6) {
      showToast('Room code must be exactly 6 characters', 'error');
      return;
    }
    setLoading(true);
    
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', trimmedCode)
        .maybeSingle();

      if (roomError) {
        console.error('Supabase error fetching room:', roomError);
        throw new Error(`Database error: ${roomError.message}`);
      }

      if (!room) {
        throw new Error('Room not found. Please check the code and try again.');
      }

      if (room) {
        // Check if already a member
        const { data: member, error: memberCheckError } = await supabase
          .from('room_members')
          .select('*')
          .eq('user_id', user.id)
          .eq('room_id', room.id)
          .maybeSingle();

        if (memberCheckError) throw memberCheckError;

        if (!member) {
          const { error: joinError } = await supabase
            .from('room_members')
            .insert([{ user_id: user.id, room_id: room.id }]);
          
          if (joinError) throw joinError;
          
          setRooms(prev => [...prev, room]);
          showToast(`Joined room "${room.name}" successfully!`);
        } else {
          showToast(`You are already a member of "${room.name}"`);
        }
        
        setActiveRoom(room);
        setShowJoinModal(false);
        setJoinCode('');
      }
    } catch (error: any) {
      console.error('Error joining room:', error);
      showToast(error.message || 'Failed to join room', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const existingReaction = messages
        .find(m => m.id === messageId)
        ?.reactions?.find(r => r.user_id === user.id && r.emoji === emoji);

      if (existingReaction) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('id', existingReaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reactions')
          .insert([{ message_id: messageId, user_id: user.id, emoji }]);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error toggling reaction:', error);
      showToast(error.message || 'Failed to add reaction', 'error');
    } finally {
      setActiveEmojiPicker(null);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    showToast('Message copied to clipboard');
  };

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId
    });
  };

  const filteredMessages = searchQuery.trim() 
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const handleLogout = () => supabase.auth.signOut();

  // Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks([]);
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      showToast('Could not access microphone. Please check permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = null; // Prevent sending
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      showToast('Recording cancelled');
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    if (!activeRoom) return;
    setIsUploadingVoice(true);

    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { data, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob);

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
          showToast('Storage bucket "voice-messages" is missing. Please create it in Supabase.', 'error');
          setShowStorageGuide(true);
          throw new Error('Bucket "voice-messages" not found.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);

      await handleSendMessage('Voice Message', publicUrl);
    } catch (error: any) {
      console.error('Error uploading voice message:', error);
      showToast(error.message || 'Failed to upload voice message', 'error');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudio = (messageId: string, url: string) => {
    if (playingAudioId === messageId) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudioId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingAudioId(messageId);
    }
  };

  const handleTogglePin = async (message: Message) => {
    if (!activeRoom || activeRoom.created_by !== user?.id) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_pinned: !message.is_pinned })
        .eq('id', message.id);

      if (error) throw error;
      setContextMenu(null);
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      showToast('Failed to toggle pin', 'error');
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    handleTyping();

    const lastWord = val.split(' ').pop();
    if (lastWord?.startsWith('@')) {
      setShowMentions(true);
      setMentionQuery(lastWord.slice(1).toLowerCase());
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions) {
      const filteredMembers = members.filter(m => m.username?.toLowerCase().includes(mentionQuery));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const member = filteredMembers[mentionIndex];
        if (member) {
          const words = newMessage.split(' ');
          words.pop();
          setNewMessage([...words, `@${member.username} `].join(' '));
          setShowMentions(false);
        }
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!activeRoom || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `chat_images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars') // Reusing avatars bucket for simplicity
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await handleSendMessage('', undefined, publicUrl);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showToast('Failed to upload image', 'error');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!activeRoom || !user) return;

    // Max file size 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    setIsUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const filePath = `chat_files/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars') // Reusing avatars bucket for simplicity
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await handleSendMessage('', undefined, undefined, publicUrl, file.name, file.size, file.type);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      showToast('Failed to upload file', 'error');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSendMessage = async (content: string = newMessage, audioUrl?: string, imageUrl?: string, fileUrl?: string, fileName?: string, fileSize?: number, fileType?: string) => {
    console.log('handleSendMessage triggered', { content, audioUrl, imageUrl, fileUrl });
    const textContent = typeof content === 'string' ? content : newMessage;
    
    if (!textContent.trim() && !audioUrl && !imageUrl && !fileUrl) {
      console.log('Empty message, returning');
      return;
    }
    
    if (!activeRoom) {
      console.log('No active room, returning');
      showToast('Please select a room first', 'error');
      return;
    }

    if (!user) {
      console.log('No user, returning');
      showToast('You must be logged in to send messages', 'error');
      return;
    }

    const currentReplyTo = replyingTo;
    if (!audioUrl && !imageUrl && !fileUrl) {
      setNewMessage('');
      setReplyingTo(null);
    }
    
    try {
      const url = extractUrl(textContent);
      
      console.log('Inserting message into Supabase...');
      const { data, error } = await supabase
        .from('messages')
        .insert([{ 
          room_id: activeRoom.id, 
          user_id: user.id, 
          content: textContent,
          audio_url: audioUrl,
          image_url: imageUrl,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          reply_to_id: currentReplyTo?.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Message sent successfully', data);
      scrollToBottom(true);

      if (url && data) {
        fetchLinkPreview(url).then(async (preview) => {
          if (preview) {
            try {
              await supabase
                .from('messages')
                .update({ link_preview: preview })
                .eq('id', data.id);
            } catch (err) {
              console.error('Failed to update link preview (column might be missing):', err);
            }
          }
        }).catch(err => console.error('Link preview fetch failed:', err));
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      showToast(error.message || 'Failed to send message. Please check your connection.', 'error');
      if (!audioUrl) setNewMessage(textContent);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-200 overflow-hidden relative transition-colors duration-300">
      {/* Missing Credentials Warning */}
      {!hasValidSupabase && (
        <div className="fixed top-0 left-0 right-0 z-[110] bg-red-600 text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Supabase credentials missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your secrets.
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast 
                message={t.message} 
                type={t.type} 
                action={t.action}
                onClose={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} 
              />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Storage Troubleshooting Modal */}
      <AnimatePresence>
        {showStorageGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl transition-colors duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-indigo-400" />
                  Fix Voice Messages
                </h3>
                <button 
                  onClick={() => setShowStorageGuide(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm">
                <p>To enable voice messages, you need to create a storage bucket in your Supabase project:</p>
                
                <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs overflow-x-auto">
                  <p className="text-indigo-400"># Step 1</p>
                  <p>Go to Supabase Dashboard &gt; Storage</p>
                  <p className="text-indigo-400 mt-2"># Step 2</p>
                  <p>Create bucket named: <span className="text-slate-900 dark:text-white font-bold">voice-messages</span></p>
                  <p className="text-indigo-400 mt-2"># Step 3</p>
                  <p>Set bucket to <span className="text-slate-900 dark:text-white font-bold">PUBLIC</span></p>
                </div>

                <button
                  onClick={() => {
                    copyToClipboard(`INSERT INTO storage.buckets (id, name, public) VALUES ('voice-messages', 'voice-messages', true);`);
                    showToast('SQL copied! Run this in Supabase SQL Editor.');
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Copy SQL Fix
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.1, right: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -100) setIsMobileMenuOpen(false);
              }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/5 flex flex-col z-50 lg:hidden shadow-2xl transition-colors duration-300"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">ChitChat</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
                    aria-label="Toggle theme"
                  >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      setShowCreateModal(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 transition-all group"
                  >
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Create</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowJoinModal(true);
                      setIsMobileMenuOpen(false);
                    }}
                    aria-label="Join room"
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all group"
                  >
                    <Search className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Join</span>
                  </button>
                </div>

                {/* Sort Section */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Sort By</span>
                  <button 
                    onClick={() => setSortBy(prev => prev === 'newest' ? 'unread' : 'newest')}
                    aria-label={`Sort by ${sortBy === 'unread' ? 'newest' : 'unread'}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/50 text-[10px] font-bold text-indigo-400 hover:bg-slate-800 transition-all border border-indigo-500/20"
                  >
                    <Filter className="w-3 h-3" />
                    <span className="uppercase">{sortBy === 'unread' ? 'Unread First' : 'Newest First'}</span>
                  </button>
                </div>

                {/* Navigation Section */}
                <div className="space-y-1">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    Navigation
                  </div>
                  <button 
                    onClick={() => {
                      setShowMembers(!showMembers);
                      setIsMobileMenuOpen(false);
                    }}
                    aria-label="Show members"
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                      showMembers ? "bg-indigo-500/10 text-indigo-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    )}
                  >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Members</span>
                  </button>
                </div>

                {/* Rooms Section */}
                <div className="space-y-1">
                  <div className="px-3 py-2 flex items-center justify-between group">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Rooms</span>
                  </div>
                  <div className="space-y-1">
                    {groupRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => {
                          setActiveRoom(room);
                          setIsMobileMenuOpen(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setRoomContextMenu({ x: e.clientX, y: e.clientY, roomId: room.id });
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative",
                          activeRoom?.id === room.id 
                            ? "bg-indigo-500/10 text-indigo-400" 
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        )}
                      >
                        <Hash className={cn(
                          "w-4 h-4 transition-colors",
                          activeRoom?.id === room.id ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-400"
                        )} />
                        <span className="font-medium truncate">{room.name}</span>
                        {room.unread_count && room.unread_count > 0 ? (
                          <div className="ml-auto bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-indigo-500/20">
                            {room.unread_count}
                          </div>
                        ) : activeRoom?.id === room.id && (
                          <motion.div 
                            layoutId="activeRoomMobile"
                            className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct Messages Section */}
                <div className="space-y-1">
                  <div className="px-3 py-2 flex items-center justify-between group">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Direct Messages</span>
                    <button 
                      onClick={() => setShowNewDMModal(true)}
                      className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {directMessages.map((dm) => (
                      <button
                        key={dm.id}
                        onClick={() => {
                          setActiveRoom(dm);
                          setIsMobileMenuOpen(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setRoomContextMenu({ x: e.clientX, y: e.clientY, roomId: dm.id });
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative",
                          activeRoom?.id === dm.id 
                            ? "bg-indigo-500/10 text-indigo-400" 
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        )}
                      >
                        <div className="relative">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                            {dm.other_user_profile?.avatar_url ? (
                              <img src={dm.other_user_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              dm.other_user_profile?.username?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900",
                            onlineUsers.has(dm.other_user_profile?.id || '') ? "bg-emerald-500" : "bg-slate-500"
                          )} />
                        </div>
                        <span className="font-medium truncate">{dm.other_user_profile?.username || 'Unknown'}</span>
                        {dm.unread_count && dm.unread_count > 0 ? (
                          <div className="ml-auto bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-indigo-500/20">
                            {dm.unread_count}
                          </div>
                        ) : activeRoom?.id === dm.id && (
                          <motion.div 
                            layoutId="activeRoomMobile"
                            className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* User Profile Section inside Mobile Drawer */}
              <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-white/5 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setShowProfileModal(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20 hover:bg-indigo-500/30 transition-all overflow-hidden"
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      profile?.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()
                    )}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                    setShowProfileModal(true);
                    setIsMobileMenuOpen(false);
                  }}>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile?.username || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={handleLogout} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-400 transition-all">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex w-16 bg-white dark:bg-[#020617] border-r border-slate-200 dark:border-white/5 flex-col items-center py-4 gap-4 flex-shrink-0 transition-colors duration-300">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 cursor-pointer hover:rounded-xl transition-all">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div className="w-8 h-[2px] bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div 
          onClick={toggleTheme}
          className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer hover:rounded-xl transition-all"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
        </div>
        <div 
          onClick={() => setShowCreateModal(true)}
          className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer hover:rounded-xl transition-all"
        >
          <Plus className="w-6 h-6" />
        </div>
      </aside>

      <aside className="hidden lg:flex w-64 bg-slate-50 dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/5 flex-col flex-shrink-0 transition-colors duration-300">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">ChitChat</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-6 py-4">
          {/* Navigation Section */}
          <div className="space-y-1">
            <div className="px-3 py-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Navigation</span>
            </div>
            <div className="space-y-0.5">
              <button 
                onClick={() => setShowMembers(!showMembers)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                  showMembers 
                    ? "bg-indigo-500/10 text-indigo-400" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )}
              >
                <Users className={cn(
                  "w-4 h-4 transition-colors",
                  showMembers ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-400"
                )} />
                <span className="font-medium">Members</span>
                {showMembers && (
                  <motion.div 
                    layoutId="activeNavDesktop"
                    className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                  />
                )}
              </button>
              <button 
                onClick={() => setShowJoinModal(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all group"
              >
                <Search className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />
                <span className="font-medium">Join Room</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all group">
                <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />
                <span className="font-medium">Settings</span>
              </button>
            </div>
          </div>

          {/* Sort Section */}
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Sort By</span>
            <button 
              onClick={() => setSortBy(prev => prev === 'newest' ? 'unread' : 'newest')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/50 text-[10px] font-bold text-indigo-400 hover:bg-slate-800 transition-all border border-indigo-500/20"
            >
              <Filter className="w-3 h-3" />
              <span className="uppercase">{sortBy === 'unread' ? 'Unread First' : 'Newest First'}</span>
            </button>
          </div>

          {/* Rooms Section */}
          <div className="space-y-1">
            <div className="px-3 py-2 flex items-center justify-between group">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rooms</span>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {groupRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                    activeRoom?.id === room.id 
                      ? "bg-indigo-500/10 text-indigo-400" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <Hash className={cn(
                    "w-4 h-4 transition-colors",
                    activeRoom?.id === room.id ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-400"
                  )} />
                  <span className="font-medium truncate">{room.name}</span>
                  {room.unread_count && room.unread_count > 0 ? (
                    <div className="ml-auto bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-indigo-500/20">
                      {room.unread_count}
                    </div>
                  ) : activeRoom?.id === room.id && (
                    <motion.div 
                      layoutId="activeRoomDesktop"
                      className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                    />
                  )}
                </button>
              ))}
              {groupRooms.length === 0 && !loading && (
                <div className="px-3 py-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">No rooms yet</p>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>Create One</Button>
                </div>
              )}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div className="space-y-1">
            <div className="px-3 py-2 flex items-center justify-between group">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Direct Messages</span>
              <button 
                onClick={() => setShowNewDMModal(true)}
                className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => setActiveRoom(dm)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                    activeRoom?.id === dm.id 
                      ? "bg-indigo-500/10 text-indigo-400" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <div className="relative">
                    <div className="w-5 h-5 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                      {dm.other_user_profile?.avatar_url ? (
                        <img src={dm.other_user_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        dm.other_user_profile?.username?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900",
                      onlineUsers.has(dm.other_user_profile?.id || '') ? "bg-emerald-500" : "bg-slate-500"
                    )} />
                  </div>
                  <span className="font-medium truncate">{dm.other_user_profile?.username || 'Unknown'}</span>
                  {dm.unread_count && dm.unread_count > 0 ? (
                    <div className="ml-auto bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-indigo-500/20">
                      {dm.unread_count}
                    </div>
                  ) : activeRoom?.id === dm.id && (
                    <motion.div 
                      layoutId="activeRoomDesktop"
                      className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                    />
                  )}
                </button>
              ))}
              {directMessages.length === 0 && !loading && (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-slate-500">No direct messages</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-white/5 transition-colors duration-300">
          <div className="flex items-center gap-3 px-2">
            <button 
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20 hover:bg-indigo-500/30 transition-all overflow-hidden"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile?.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()
              )}
            </button>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowProfileModal(true)}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{profile?.username || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main 
        className={cn(
          "flex-1 flex flex-col w-full min-w-0 relative transition-colors duration-300",
          !chatWallpaper && chatTheme === 'default' && "bg-white dark:bg-[#020617]",
          !chatWallpaper && chatTheme === 'minimalist' && "bg-slate-50 dark:bg-black",
          !chatWallpaper && chatTheme === 'dark-blue' && "bg-blue-50 dark:bg-blue-950",
          !chatWallpaper && chatTheme === 'forest' && "bg-emerald-50 dark:bg-emerald-950"
        )}
        style={{
          backgroundImage: chatWallpaper ? `url(${chatWallpaper})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Mobile Global Header - Always visible on mobile */}
        <header className="lg:hidden h-16 px-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-[#020617]/50 backdrop-blur-md z-30 sticky top-0 transition-colors duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            {activeRoom ? (
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900 dark:text-white truncate text-sm">{activeRoom.name}</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">Code: <span className="font-mono text-indigo-400">{activeRoom.code}</span></p>
                    <button 
                      onClick={() => copyToClipboard(activeRoom.code)}
                      className="p-0.5 text-slate-500 hover:text-indigo-400 transition-colors"
                      title="Copy Room Code"
                    >
                      {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      const shareText = `Join my room "${activeRoom.name}" on ChitChat! Code: ${activeRoom.code}`;
                      navigator.clipboard.writeText(shareText);
                      setCopied(true);
                      showToast('Share message copied!');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-600">Share</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-200 tracking-tight">ChitChat</span>
              </div>
            )}
          </div>
          
          {activeRoom && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Search messages"
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (showSearch) setSearchQuery('');
                }}
                className={cn(
                  "text-slate-500 dark:text-slate-400",
                  showSearch ? 'text-indigo-400 bg-indigo-500/10' : ''
                )}
              >
                <Search className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Show members"
                onClick={() => setShowMembers(!showMembers)}
                className={cn(
                  "text-slate-500 dark:text-slate-400",
                  showMembers ? 'text-indigo-400 bg-indigo-500/10' : ''
                )}
              >
                <User className="w-5 h-5" />
              </Button>
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label="Show room menu"
                  onClick={() => setShowMobileRoomMenu(!showMobileRoomMenu)}
                  className="text-slate-500 dark:text-slate-400"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
                
                <AnimatePresence>
                  {showMobileRoomMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-20" 
                        onClick={() => setShowMobileRoomMenu(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 py-1 overflow-hidden transition-colors duration-300"
                      >
                        <button
                          onClick={() => {
                            setShowSearch(!showSearch);
                            if (showSearch) setSearchQuery('');
                            setShowMobileRoomMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Search className="w-4 h-4" />
                          {showSearch ? 'Hide Search' : 'Search Messages'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMembers(!showMembers);
                            setShowMobileRoomMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          {showMembers ? 'Hide Members' : 'Show Members'}
                        </button>
                        <button
                          onClick={() => {
                            setEditRoomName(activeRoom.name);
                            setShowRoomSettingsModal(true);
                            setShowMobileRoomMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Room Settings
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </header>

        {activeRoom ? (
          <>
            {/* Mobile Search Bar */}
            <AnimatePresence>
              {showSearch && activeRoom && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="lg:hidden px-4 py-2 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-[#020617]/50 transition-colors duration-300"
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages..."
                      aria-label="Search messages"
                      className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-10 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors duration-300"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desktop Header */}
            <header className="hidden lg:flex h-16 px-6 border-b border-slate-200 dark:border-white/5 items-center justify-between bg-white/50 dark:bg-[#020617]/50 backdrop-blur-md z-10 transition-colors duration-300">
              <div className="flex items-center gap-3 min-w-0">
                {activeRoom.is_direct ? (
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-400 font-bold overflow-hidden">
                      {activeRoom.other_user_profile?.avatar_url ? (
                        <img src={activeRoom.other_user_profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        activeRoom.other_user_profile?.username?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#020617]",
                      onlineUsers.has(activeRoom.other_user_profile?.id || '') ? "bg-emerald-500" : "bg-slate-400"
                    )} />
                  </div>
                ) : (
                  <Hash className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-white truncate">
                    {activeRoom.is_direct ? activeRoom.other_user_profile?.username : activeRoom.name}
                  </h2>
                  {!activeRoom.is_direct ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/5">
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate font-medium">Code: <span className="font-mono text-indigo-600 dark:text-indigo-400">{activeRoom.code}</span></p>
                        <button 
                          onClick={() => copyToClipboard(activeRoom.code)}
                          className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                          title="Copy Room Code"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          const shareText = `Join my room "${activeRoom.name}" on ChitChat! Code: ${activeRoom.code}`;
                          navigator.clipboard.writeText(shareText);
                          setCopied(true);
                          showToast('Share message copied!');
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="px-3 py-1 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all flex items-center gap-1.5"
                        title="Copy Share Message"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Share</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 truncate">{activeRoom.other_user_profile?.status || 'Direct Message'}</p>
                  )}
                </div>
              </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex items-center transition-all duration-300 overflow-hidden",
                    showSearch ? "w-48 sm:w-64 opacity-100" : "w-0 opacity-0"
                  )}>
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search messages..."
                        className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setShowSearch(!showSearch);
                      if (showSearch) setSearchQuery('');
                    }}
                    className={cn(
                      showSearch ? 'text-indigo-400 bg-indigo-500/10' : ''
                    )}
                  >
                    <Search className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowMembers(!showMembers)}
                    className={cn(
                      showMembers ? 'text-indigo-400 bg-indigo-500/10' : ''
                    )}
                  >
                    <User className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setEditRoomName(activeRoom.name);
                      setShowRoomSettingsModal(true);
                    }}
                    title="Room Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
            </header>

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
            >
              {isLoadingMore && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Pinned Messages Section */}
              {messages.some(m => m.is_pinned) && (
                <div className="mb-8 space-y-2">
                  <div className="flex items-center gap-2 px-2 mb-3">
                    <Pin className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">Pinned Messages</h3>
                  </div>
                  <div className="grid gap-2">
                    {messages.filter(m => m.is_pinned).map(pinned => (
                      <motion.div 
                        key={`pinned-${pinned.id}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex items-start gap-3 group/pinned relative overflow-hidden"
                      >
                        <div className="absolute inset-y-0 left-0 w-1 bg-amber-500/30" />
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-[10px] font-bold text-amber-500 flex-shrink-0">
                          {pinned.profiles?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">{pinned.profiles?.username}</span>
                            <span className="text-[9px] text-slate-600">{format(new Date(pinned.created_at), 'MMM d, HH:mm')}</span>
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                            {pinned.content || (pinned.image_url ? '📷 Shared an image' : '🎤 Voice message')}
                          </p>
                        </div>
                        {activeRoom.created_by === user.id && (
                          <button 
                            onClick={() => handleTogglePin(pinned)}
                            className="opacity-0 group-hover/pinned:opacity-100 p-1.5 text-slate-500 hover:text-amber-400 transition-all"
                            title="Unpin"
                          >
                            <PinOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  <div className="h-px bg-white/5 my-6" />
                </div>
              )}

              {searchQuery && (
                <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/10 px-4 py-2 rounded-xl mb-4">
                  <p className="text-xs text-indigo-400 font-medium">
                    Found {filteredMessages.length} results for "{searchQuery}"
                  </p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div ref={ref} className="h-1" />
              <AnimatePresence initial={false}>
                {filteredMessages.map((msg, index) => {
                  const isMe = msg.user_id === user.id;
                  const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                  const isSameUser = prevMsg && prevMsg.user_id === msg.user_id;
                  const timeDiff = prevMsg ? (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 1000 / 60 : 0;
                  const shouldGroup = isSameUser && timeDiff < 5;

                  return (
                    <motion.div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3 group relative",
                        isMe ? "flex-row-reverse" : "flex-row",
                        shouldGroup ? "mt-0.5" : "mt-6"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold border overflow-hidden transition-opacity",
                        isMe 
                          ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" 
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400",
                        shouldGroup ? "opacity-0" : "opacity-100"
                      )}>
                        {msg.profiles?.avatar_url ? (
                          <img src={msg.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          msg.profiles?.username?.[0]?.toUpperCase() || '?'
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={cn(
                        "flex flex-col max-w-[80%]",
                        isMe ? "items-end" : "items-start"
                      )}>
                        {/* Header: Name - Only show if not grouped */}
                        {!shouldGroup && (
                          <div className={cn(
                            "flex items-center gap-2 mb-1 px-1",
                            isMe ? "flex-row-reverse" : "flex-row"
                          )}>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {isMe ? 'You' : (msg.profiles?.username || 'Unknown')}
                            </span>
                          </div>
                        )}

                        {/* Bubble */}
                        <div 
                          className="relative group/bubble"
                          onContextMenu={(e) => handleContextMenu(e, msg.id)}
                        >
                          <div className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg transition-all",
                            isMe 
                              ? cn(
                                  "bg-indigo-600 text-white",
                                  shouldGroup ? "rounded-tr-2xl" : "rounded-tr-none"
                                )
                              : cn(
                                  "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50",
                                  shouldGroup ? "rounded-tl-2xl" : "rounded-tl-none"
                                )
                          )}>
                            {msg.reply_to_message && (
                              <div 
                                className="mb-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border-l-2 border-indigo-500 text-[10px] opacity-80 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                onClick={() => {
                                  const el = document.getElementById(`msg-${msg.reply_to_id}`);
                                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                              >
                                <div className="font-bold text-indigo-400 mb-0.5">
                                  {msg.reply_to_message.profiles?.username || 'Someone'}
                                </div>
                                <div className="truncate italic">
                                  {msg.reply_to_message.content || (msg.reply_to_message.image_url ? '📷 Image' : (msg.reply_to_message.audio_url ? '🎤 Voice' : 'Message'))}
                                </div>
                              </div>
                            )}

                            {msg.audio_url ? (
                              <div className="flex items-center gap-3 min-w-[200px] py-1">
                                <button
                                  onClick={() => toggleAudio(msg.id, msg.audio_url!)}
                                  className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                    isMe ? "bg-white/20 hover:bg-white/30" : "bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400"
                                  )}
                                >
                                  {playingAudioId === msg.id ? (
                                    <Pause className="w-5 h-5 fill-current" />
                                  ) : (
                                    <Play className="w-5 h-5 fill-current ml-0.5" />
                                  )}
                                </button>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] opacity-70 font-mono uppercase tracking-widest">
                                    <span>Voice Message</span>
                                    <Volume2 className="w-3 h-3" />
                                  </div>
                                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div 
                                      className={cn("h-full", isMe ? "bg-white/40" : "bg-indigo-500/40")}
                                      animate={{ width: playingAudioId === msg.id ? '100%' : '0%' }}
                                      transition={{ duration: 5, ease: "linear" }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : editingMessageId === msg.id ? (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <textarea
                                  value={editMessageContent}
                                  onChange={(e) => setEditMessageContent(e.target.value)}
                                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none min-h-[60px] transition-colors duration-300"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => handleEditMessage(msg.id)}
                                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white rounded-md hover:bg-indigo-400"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {msg.is_pinned && (
                                  <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                    <Pin className="w-3 h-3 text-amber-400 fill-amber-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Pinned</span>
                                  </div>
                                )}
                                {msg.image_url && (
                                  <div className="rounded-xl overflow-hidden mb-1 border border-white/10">
                                    <img 
                                      src={msg.image_url} 
                                      alt="Shared image" 
                                      className="max-w-full max-h-[300px] object-contain cursor-pointer hover:scale-[1.02] transition-transform"
                                      onClick={() => window.open(msg.image_url, '_blank')}
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                )}
                                {msg.file_url && msg.file_name && (
                                  <a 
                                    href={msg.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "flex items-center gap-3 p-3 mb-2 rounded-xl border transition-colors max-w-sm",
                                      isMe 
                                        ? "bg-indigo-500/20 border-indigo-400/30 hover:bg-indigo-500/30" 
                                        : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-slate-800"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                      isMe ? "bg-indigo-400/20 text-indigo-300" : "bg-indigo-500/10 text-indigo-500"
                                    )}>
                                      <Paperclip className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={cn("text-sm font-medium truncate", isMe ? "text-white" : "text-slate-900 dark:text-white")}>{msg.file_name}</p>
                                      <p className={cn("text-xs", isMe ? "text-indigo-200" : "text-slate-500")}>{(msg.file_size || 0) > 1024 * 1024 ? `${((msg.file_size || 0) / (1024 * 1024)).toFixed(2)} MB` : `${Math.round((msg.file_size || 0) / 1024)} KB`}</p>
                                    </div>
                                  </a>
                                )}
                                {msg.content && (
                                  <div className="markdown-body prose prose-slate dark:prose-invert prose-sm max-w-none">
                                    <ReactMarkdown components={{
                                      text: ({ children }) => {
                                        const text = Array.isArray(children) ? children.join('') : (children as string);
                                        return <HighlightedText query={searchQuery}>{text}</HighlightedText>;
                                      },
                                    }}>{msg.content}</ReactMarkdown>
                                  </div>
                                )}
                                
                                {/* Reactions Display */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                  <div className={cn("flex flex-wrap gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                                    {Object.entries(msg.reactions.reduce((acc: Record<string, string[]>, r) => {
                                      if (!acc[r.emoji]) acc[r.emoji] = [];
                                      acc[r.emoji].push(r.id);
                                      return acc;
                                    }, {})).map(([emoji, ids]) => (
                                      <button
                                        key={emoji}
                                        onClick={() => handleToggleReaction(msg.id, emoji)}
                                        className={cn(
                                          "px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all",
                                          msg.reactions?.some(r => r.emoji === emoji && r.user_id === user.id)
                                            ? "bg-indigo-500/20 border border-indigo-500/30"
                                            : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                                        )}
                                      >
                                        <span>{emoji}</span>
                                        <span className="font-bold">{ids.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                
                                {msg.updated_at && (
                                  <span className="text-[9px] opacity-50 italic">(edited)</span>
                                )}
                                {msg.link_preview && (
                                  <LinkPreview preview={msg.link_preview} />
                                )}
                              </div>
                            )}
                            
                            {/* Message Footer (Time & Read Receipts) */}
                            <div className={cn(
                              "flex items-center gap-1 mt-1 text-[10px]",
                              isMe ? "justify-end text-indigo-200" : "justify-end text-slate-400 dark:text-slate-500"
                            )}>
                              <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                              {isMe && activeRoom?.is_direct && (
                                msg.is_read ? (
                                  <CheckCheck className="w-3 h-3 text-indigo-300" />
                                ) : (
                                  <Check className="w-3 h-3 opacity-70" />
                                )
                              )}
                            </div>
                          </div>

                          {/* Message Actions Trigger */}
                          <div className={cn(
                            "absolute top-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity z-10 flex gap-1",
                            isMe ? "right-full mr-2" : "left-full ml-2"
                          )}>
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setActiveEmojiPicker(activeEmojiPicker === msg.id ? null : msg.id)}
                              className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                            
                            {isMe && !msg.audio_url && (new Date().getTime() - new Date(msg.created_at).getTime()) < 15 * 60 * 1000 && (
                              <button
                                onClick={() => {
                                  setPendingEditMessageId(msg.id);
                                  setShowEditConfirmation(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800"
                                title="Edit Message"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}

                            {isMe && (
                              <button
                                onClick={() => setMessageToDeleteId(msg.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800"
                                title="Delete Message"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            
                            <AnimatePresence>
                              {activeEmojiPicker === msg.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                  className={cn(
                                    "absolute bottom-full mb-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 flex gap-1",
                                    isMe ? "right-0" : "left-0"
                                  )}
                                >
                                  {COMMON_EMOJIS.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleToggleReaction(msg.id, emoji)}
                                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-lg"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => setShowFullEmojiPicker(msg.id)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                                    title="More emojis"
                                  >
                                    <Plus className="w-5 h-5" />
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Full Emoji Picker Modal */}
                        <AnimatePresence>
                          {showFullEmojiPicker === msg.id && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowFullEmojiPicker(null)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                              />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative z-10"
                              >
                                <EmojiPicker 
                                  theme={theme === 'dark' ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                  onEmojiClick={(emojiData) => {
                                    handleToggleReaction(msg.id, emojiData.emoji);
                                    setShowFullEmojiPicker(null);
                                    setActiveEmojiPicker(null);
                                  }}
                                />
                              </motion.div>
                            </div>
                          )}
                        </AnimatePresence>
                        
                        {/* Reactions Display */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={cn(
                            "flex flex-wrap gap-1 mt-2",
                            isMe ? "justify-end" : "justify-start"
                          )}>
                            {Object.entries(
                              msg.reactions.reduce((acc, r) => {
                                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([emoji, count]) => {
                              const hasReacted = msg.reactions?.some(r => r.user_id === user.id && r.emoji === emoji);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border",
                                    hasReacted 
                                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400" 
                                      : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-500 hover:border-slate-300 dark:hover:border-white/10"
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span>{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <AnimatePresence>
                {!isAtBottom && hasUnread && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20"
                  >
                    <button
                      onClick={() => scrollToBottom(true)}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-full shadow-2xl shadow-indigo-500/40 text-xs font-bold flex items-center gap-2 hover:bg-indigo-500 transition-all border border-indigo-400/30 backdrop-blur-sm"
                    >
                      <ChevronRight className="w-4 h-4 rotate-90" />
                      New Messages
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className={cn(
              "p-6",
              chatWallpaper && "bg-white/50 dark:bg-black/50 backdrop-blur-md border-t border-slate-200/50 dark:border-white/10"
            )}>
              <div className="relative">
                {/* Typing Indicator */}
                <AnimatePresence>
                  {typingUsers.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute -top-6 left-2 flex items-center gap-2"
                    >
                      <div className="flex gap-1">
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 italic">
                        {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute inset-0 z-10 bg-white dark:bg-[#0f172a] border border-indigo-500/30 rounded-2xl px-6 flex items-center justify-between shadow-2xl shadow-indigo-500/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{formatDuration(recordingDuration)}</span>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Recording...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={cancelRecording}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                          title="Cancel Recording"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={stopRecording}
                          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                          title="Stop and Send"
                        >
                          <Square className="w-5 h-5 fill-current" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {replyingTo && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl flex items-center justify-between z-20"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-1 h-8 bg-indigo-500 rounded-full flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Replying to {replyingTo.profiles?.username}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{replyingTo.content || (replyingTo.image_url ? '📷 Image' : (replyingTo.audio_url ? '🎤 Voice' : 'Message'))}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }} 
                  className="relative flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-500 hover:text-indigo-400 transition-all"
                        title="Attach File"
                        disabled={isUploadingFile}
                      >
                        <Paperclip className={cn("w-5 h-5", isUploadingFile && "animate-pulse")} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 text-slate-500 hover:text-indigo-400 transition-all"
                        title="Upload Image"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <input 
                        type="file" 
                        ref={imageInputRef}
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      id="message-input"
                      value={newMessage}
                      onChange={handleMessageChange}
                      onKeyDown={handleInputKeyDown}
                      placeholder={activeRoom.is_direct ? `Message @${activeRoom.other_user_profile?.username}` : `Message #${activeRoom.name}`}
                      disabled={isRecording || isUploadingFile}
                      className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl pl-24 pr-12 py-4 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-2xl disabled:opacity-50"
                      autoComplete="off"
                    />
                    
                    <AnimatePresence>
                      {showMentions && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50"
                        >
                          {members.filter(m => m.username?.toLowerCase().includes(mentionQuery)).length > 0 ? (
                            members.filter(m => m.username?.toLowerCase().includes(mentionQuery)).map((member, idx) => (
                              <button
                                key={member.id}
                                type="button"
                                className={cn(
                                  "w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors",
                                  mentionIndex === idx && "bg-slate-100 dark:bg-slate-800"
                                )}
                                onClick={() => {
                                  const words = newMessage.split(' ');
                                  words.pop();
                                  setNewMessage([...words, `@${member.username} `].join(' '));
                                  setShowMentions(false);
                                  document.getElementById('message-input')?.focus();
                                }}
                              >
                                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                                  {member.avatar_url ? (
                                    <img src={member.avatar_url} alt={member.username} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    member.username?.[0]?.toUpperCase()
                                  )}
                                </div>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{member.username}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">No members found</div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button 
                      type="button"
                      onClick={startRecording}
                      disabled={isUploadingVoice}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-indigo-400 transition-all"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  </div>
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || isUploadingVoice}
                    className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 flex-shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-xl">
              <MessageSquare className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome to ChitChat</h2>
              <p className="text-slate-600 dark:text-slate-500 leading-relaxed">Select a room from the sidebar or create a new one to start talking with your friends.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[280px]">
              <Button onClick={() => setShowJoinModal(true)} variant="outline" className="w-full">Join Room</Button>
              <Button onClick={() => setShowCreateModal(true)} className="w-full">Create Room</Button>
            </div>
          </div>
        )}
      </main>

      {/* Right Members Panel */}
      <AnimatePresence>
        {showMembers && activeRoom && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: window.innerWidth < 1024 ? '100%' : 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className={cn(
              "bg-white dark:bg-[#0f172a] border-l border-slate-200 dark:border-white/5 flex flex-col flex-shrink-0 overflow-hidden lg:static fixed inset-y-0 right-0 z-40",
              window.innerWidth < 1024 ? "w-full" : "w-64"
            )}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Members — {members.length}
                </h3>
                <button onClick={() => setShowMembers(false)} className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-400 text-xs font-bold overflow-hidden">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            member.username?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${onlineUsers.has(member.id) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors flex items-center gap-2">
                          {member.username || 'Unknown'}
                          <span className={cn(
                            "text-[10px] font-medium",
                            onlineUsers.has(member.id) ? "text-emerald-500" : "text-slate-400"
                          )}>
                            {onlineUsers.has(member.id) ? 'Online' : 'Offline'}
                          </span>
                          {activeRoom.created_by === member.id && (
                            <Crown className="w-3 h-3 text-amber-400 fill-amber-400/20" />
                          )}
                          {member.id === user.id && (
                            <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">You</span>
                          )}
                        </span>
                        {activeRoom.created_by === member.id && (
                          <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">Owner</span>
                        )}
                        {member.status && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-[120px]">{member.status}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {member.id !== user.id && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() => handleStartDM(member)}
                          title={`Message ${member.username}`}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <div className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        onlineUsers.has(member.id) 
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                          : "bg-slate-600"
                      )} title={onlineUsers.has(member.id) ? "Online" : "Offline"} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal title="Create Room" onClose={() => setShowCreateModal(false)}>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (newRoomName.trim()) handleCreateRoom();
              }} 
              className="space-y-4"
            >
              <Input 
                label="Room Name" 
                placeholder="e.g. Design Team" 
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full" isLoading={loading} disabled={!newRoomName.trim()}>
                Create Room
              </Button>
            </form>
          </Modal>
        )}

        {showJoinModal && (
          <Modal title="Join Room" onClose={() => setShowJoinModal(false)}>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (joinCode.trim()) handleJoinRoom();
              }} 
              className="space-y-4"
            >
              <Input 
                label="Room Code" 
                placeholder="Enter 6-character code" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                autoFocus
              />
              <Button type="submit" className="w-full" isLoading={loading} disabled={!joinCode.trim()}>
                Join Room
              </Button>
            </form>
          </Modal>
        )}

        {showProfileModal && (
          <Modal title={isCropping ? "Crop Avatar" : "Edit Profile"} onClose={() => {
            setShowProfileModal(false);
            setAvatarFile(null);
            setAvatarPreview(null);
            setIsCropping(false);
            setImageToCrop(null);
          }}>
            {isCropping && imageToCrop ? (
              <div className="space-y-6">
                <div className="relative h-64 w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <Cropper
                    image={imageToCrop}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Zoom</span>
                    <span>{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => {
                      setIsCropping(false);
                      setImageToCrop(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleCropSave}>
                    Apply Crop
                  </Button>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editUsername.trim()) handleUpdateProfile();
                }} 
                className="space-y-6"
              >
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500/30 flex items-center justify-center text-4xl text-indigo-400 font-bold overflow-hidden shadow-xl transition-colors duration-300">
                    {avatarPreview || profile?.avatar_url ? (
                      <img 
                        src={avatarPreview || profile?.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      editUsername?.[0]?.toUpperCase() || user.email[0].toUpperCase()
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-3xl backdrop-blur-[2px]">
                    <Camera className="w-8 h-8 text-white" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const validation = validateImage(file);
                          if (!validation.isValid) {
                            showToast(validation.error || 'Invalid image', 'error');
                            return;
                          }

                          setAvatarFileName(file.name);
                          const reader = new FileReader();
                          reader.addEventListener('load', () => {
                            setImageToCrop(reader.result as string);
                            setIsCropping(true);
                          });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Click to change avatar</p>
              </div>

              <Input 
                label="Username" 
                placeholder="Your display name" 
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
              <Input 
                label="Status" 
                placeholder="e.g. 🌙 Sleeping, 💻 Working" 
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              />

              <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Notifications</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl bg-slate-100 dark:bg-white/5",
                        globalNotificationsEnabled ? "text-indigo-500" : "text-slate-400"
                      )}>
                        {globalNotificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Global Notifications</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Enable or disable all alerts</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGlobalNotificationsEnabled(!globalNotificationsEnabled)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        globalNotificationsEnabled ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                        globalNotificationsEnabled ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-3 h-3" /> Snooze Notifications
                      </label>
                      {snoozeUntil && Date.now() < snoozeUntil && (
                        <button 
                          onClick={() => setSnoozeUntil(null)}
                          className="text-[10px] font-bold text-red-400 uppercase tracking-wider hover:text-red-300"
                        >
                          Cancel Snooze
                        </button>
                      )}
                    </div>
                    
                    {snoozeUntil && Date.now() < snoozeUntil ? (
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <span className="text-[11px] text-indigo-400 font-medium">
                            Snoozed until {format(new Date(snoozeUntil), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        {[30, 60, 120, 480].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              const until = Date.now() + mins * 60 * 1000;
                              setSnoozeUntil(until);
                              showToast(`Notifications snoozed for ${mins < 60 ? mins + 'm' : mins / 60 + 'h'}`);
                            }}
                            className="py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400 transition-all"
                          >
                            {mins < 60 ? mins + 'm' : mins / 60 + 'h'}
                          </button>
                        ))}
                        <div className="col-span-4 mt-2">
                          <Input
                            type="number"
                            placeholder="Custom minutes"
                            onChange={(e) => {
                              const mins = parseInt(e.target.value);
                              if (!isNaN(mins) && mins > 0) {
                                const until = Date.now() + mins * 60 * 1000;
                                setSnoozeUntil(until);
                                showToast(`Notifications snoozed for ${mins}m`);
                              }
                            }}
                            className="text-[10px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Volume2 className="w-3 h-3" /> Notification Sound
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(NOTIFICATION_SOUNDS).map((sound) => (
                        <button
                          key={sound}
                          type="button"
                          onClick={() => {
                            setNotificationSound(sound);
                            // Preview sound
                            const soundUrl = NOTIFICATION_SOUNDS[sound as keyof typeof NOTIFICATION_SOUNDS];
                            if (soundUrl) {
                              new Audio(soundUrl).play().catch(() => {});
                            }
                          }}
                          className={cn(
                            "flex-1 min-w-[80px] flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                            notificationSound === sound 
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500" 
                              : "bg-slate-50 dark:bg-white/5 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                          )}
                        >
                          <span className="capitalize">{sound}</span>
                          {notificationSound === sound && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full justify-start gap-3 h-10 text-xs"
                    onClick={requestNotificationPermission}
                    disabled={notificationPermission === 'granted'}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      notificationPermission === 'granted' ? "bg-emerald-500" : "bg-amber-500"
                    )} />
                    {notificationPermission === 'granted' ? 'Browser Notifications Enabled' : 'Enable Browser Notifications'}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Appearance</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Palette className="w-3 h-3" /> Theme
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'default', label: 'Default' },
                        { id: 'minimalist', label: 'Minimalist' },
                        { id: 'dark-blue', label: 'Dark Blue' },
                        { id: 'forest', label: 'Forest' }
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setChatTheme(theme.id)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border",
                            chatTheme === theme.id 
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500" 
                              : "bg-slate-50 dark:bg-white/5 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                          )}
                        >
                          <span>{theme.label}</span>
                          {chatTheme === theme.id && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" /> Custom Wallpaper URL
                    </label>
                    <Input 
                      placeholder="https://example.com/image.jpg" 
                      value={chatWallpaper}
                      onChange={(e) => setChatWallpaper(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400">Leave empty to use the selected theme's background.</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 space-y-2">
                <Button type="submit" className="w-full" isLoading={isUploadingAvatar}>
                  {isUploadingAvatar ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setShowProfileModal(false)}>Cancel</Button>
              </div>
            </form>
            )}
          </Modal>
        )}

        {showEditConfirmation && pendingEditMessageId && (
          <Modal title="Edit Message" onClose={() => setShowEditConfirmation(false)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">Are you sure you want to edit this message?</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setShowEditConfirmation(false)}>Cancel</Button>
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                  const msg = messages.find(m => m.id === pendingEditMessageId);
                  if (msg) {
                    setEditingMessageId(msg.id);
                    setEditMessageContent(msg.content);
                  }
                  setShowEditConfirmation(false);
                }}>Edit</Button>
              </div>
            </div>
          </Modal>
        )}

        {showRoomSettingsModal && activeRoom && (
          <Modal title="Room Settings" onClose={() => {
            setShowRoomSettingsModal(false);
            setIsDeleting(false);
            setIsLeaving(false);
          }}>
            <div className="space-y-6">
              {!isDeleting && !isLeaving ? (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editRoomName.trim() && activeRoom.created_by === user.id && !activeRoom.is_direct) handleUpdateRoom();
                  }}
                  className="space-y-6"
                >
                  {!activeRoom.is_direct && (
                    <Input 
                      label="Room Name" 
                      placeholder="Enter new room name" 
                      value={editRoomName}
                      onChange={(e) => setEditRoomName(e.target.value)}
                      autoFocus
                      disabled={activeRoom.created_by !== user.id}
                    />
                  )}

                  <div className={cn("border-slate-100 dark:border-white/5", !activeRoom.is_direct && "pt-4 border-t")}>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Room Notifications</p>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          mutedRooms.has(activeRoom.id) ? "text-red-500" : "text-emerald-500"
                        )}>
                          {mutedRooms.has(activeRoom.id) ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {mutedRooms.has(activeRoom.id) ? 'Muted' : 'Active'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {mutedRooms.has(activeRoom.id) ? 'You won\'t receive alerts for this room' : 'You will receive alerts for this room'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRoomMute(activeRoom.id)}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative",
                          mutedRooms.has(activeRoom.id) ? "bg-slate-300 dark:bg-slate-700" : "bg-indigo-500"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                          mutedRooms.has(activeRoom.id) ? "left-1" : "left-6"
                        )} />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Pinned Messages</p>
                      <div className="space-y-2">
                        {messages.filter(m => m.is_pinned).length === 0 ? (
                          <p className="text-sm text-slate-500 italic">No pinned messages.</p>
                        ) : (
                          messages.filter(m => m.is_pinned).map(msg => (
                            <div key={msg.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                              <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{msg.content || 'Image/File'}</p>
                              <button onClick={() => {
                                document.getElementById(`msg-${msg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setShowRoomSettingsModal(false);
                              }} className="text-xs text-indigo-500 font-bold">View</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Notification Sound</p>
                      <div className="flex items-center gap-2">
                        <select
                          value={roomSounds[activeRoom.id] || 'default'}
                          onChange={(e) => {
                            const sound = e.target.value;
                            setRoomSounds(prev => ({
                              ...prev,
                              [activeRoom.id]: sound === 'default' ? '' : sound
                            }));
                          }}
                          className="flex-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="default">Default (Global)</option>
                          {Object.keys(NOTIFICATION_SOUNDS).filter(key => key !== 'none').map(sound => (
                            <option key={sound} value={sound}>{sound.charAt(0).toUpperCase() + sound.slice(1)}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => playNotificationSound(activeRoom.id)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                          title="Preview Sound"
                        >
                          <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {!activeRoom.is_direct && (
                      activeRoom.created_by === user.id ? (
                        <>
                          <Button type="submit" className="w-full">Update Name</Button>
                          <Button type="button" variant="outline" className="w-full text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10" onClick={() => setIsDeleting(true)}>
                            Delete Room
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="outline" className="w-full text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10" onClick={() => setIsLeaving(true)}>
                          Leave Room
                        </Button>
                      )
                    )}
                  </div>
                </form>
              ) : isDeleting ? (
                <div className="space-y-4 text-center">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-sm text-red-400">
                      Are you sure you want to delete <strong>{activeRoom.name}</strong>? This action cannot be undone and all messages will be lost.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="ghost" className="flex-1" onClick={() => setIsDeleting(false)}>Cancel</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDeleteRoom}>Delete</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-sm text-red-400">
                      Are you sure you want to leave <strong>{activeRoom.name}</strong>?
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="ghost" className="flex-1" onClick={() => setIsLeaving(false)}>Cancel</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleLeaveRoom}>Leave</Button>
                  </div>
                </div>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setShowRoomSettingsModal(false)}>Close</Button>
            </div>
          </Modal>
        )}

        {messageToDeleteId && (
          <Modal title="Delete Message" onClose={() => setMessageToDeleteId(null)}>
            <div className="space-y-6">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">
                  Are you sure you want to delete this message? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setMessageToDeleteId(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDeleteMessage}>Delete</Button>
              </div>
            </div>
          </Modal>
        )}

        {showNewDMModal && (
          <Modal title="New Direct Message" onClose={() => {
            setShowNewDMModal(false);
            setDmSearchQuery('');
            setDmSearchResults([]);
          }}>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search Users</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Search by username..."
                    value={dmSearchQuery}
                    onChange={(e) => setDmSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {isSearchingDMs ? (
                  <div className="py-8 text-center">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Searching users...</p>
                  </div>
                ) : dmSearchResults.length > 0 ? (
                  dmSearchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        handleStartDM(result);
                        setShowNewDMModal(false);
                        setDmSearchQuery('');
                        setDmSearchResults([]);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-400 text-sm font-bold overflow-hidden">
                        {result.avatar_url ? (
                          <img src={result.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          result.username?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-400 transition-colors">
                          {result.username}
                        </span>
                        {result.status && (
                          <span className="text-[10px] text-slate-500 italic truncate max-w-[180px]">
                            {result.status}
                          </span>
                        )}
                      </div>
                      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <Send className="w-4 h-4 text-indigo-500" />
                      </div>
                    </button>
                  ))
                ) : dmSearchQuery ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No users found matching "{dmSearchQuery}"</p>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-500 italic">Type a username to find people to message</p>
                  </div>
                )}
              </div>

              <Button variant="ghost" className="w-full" onClick={() => setShowNewDMModal(false)}>Cancel</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Room Context Menu */}
      <AnimatePresence>
        {roomContextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ 
              position: 'fixed', 
              top: roomContextMenu.y, 
              left: roomContextMenu.x,
              zIndex: 1000
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 min-w-[160px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                markRoomAsUnread(roomContextMenu.roomId);
                setRoomContextMenu(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <History className="w-4 h-4" />
              Mark as Unread
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ 
              position: 'fixed', 
              top: contextMenu.y, 
              left: contextMenu.x,
              zIndex: 1000
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 min-w-[160px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const msg = messages.find(m => m.id === contextMenu.messageId);
              if (!msg) return null;
              const isMe = msg.user_id === user.id;

              return (
                <>
                  <button
                    onClick={() => {
                      handleCopyMessage(msg.content);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Text
                  </button>

                  <button
                    onClick={() => {
                      setActiveEmojiPicker(contextMenu.messageId);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Smile className="w-4 h-4" />
                    Add Reaction
                  </button>

                  {activeRoom.created_by === user.id && (
                    <button
                      onClick={() => {
                        handleTogglePin(msg);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-white/5"
                    >
                      {msg.is_pinned ? (
                        <>
                          <PinOff className="w-4 h-4 text-amber-400" />
                          Unpin Message
                        </>
                      ) : (
                        <>
                          <Pin className="w-4 h-4 text-amber-400" />
                          Pin Message
                        </>
                      )}
                    </button>
                  )}

                  <div className="px-4 py-2 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">React</p>
                    <div className="grid grid-cols-4 gap-1">
                      {COMMON_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            handleToggleReaction(msg.id, emoji);
                            setContextMenu(null);
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowFullEmojiPicker(msg.id);
                          setContextMenu(null);
                        }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 flex items-center justify-center"
                        title="More emojis"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {isMe && !msg.audio_url && (new Date().getTime() - new Date(msg.created_at).getTime()) < 15 * 60 * 1000 && (
                    <button
                      onClick={() => {
                        setPendingEditMessageId(msg.id);
                        setShowEditConfirmation(true);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Message
                    </button>
                  )}

                  {isMe && (
                    <button
                      onClick={() => {
                        setMessageToDeleteId(msg.id);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Message
                    </button>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Modal = ({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
    />
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
    >
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{title}</h3>
      {children}
    </motion.div>
  </div>
);
