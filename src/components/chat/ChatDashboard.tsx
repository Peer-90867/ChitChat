import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { customAlphabet } from 'nanoid';

const generateRoomCode = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

export const ChatDashboard = ({ user }: { user: any }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMobileRoomMenu, setShowMobileRoomMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editRoomName, setEditRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    if (activeRoom) {
      setMessages([]);
      setMembers([]);
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
            
            setMessages(prev => {
              // Prevent duplicate messages if the user sent it themselves and it's already in state
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, { ...newMessage, profiles: profileData }];
            });
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
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const onlineIds = new Set<string>();
          Object.keys(state).forEach((key) => {
            onlineIds.add(key);
          });
          setOnlineUsers(onlineIds);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) {
      setProfile(data);
      setEditUsername(data.username || '');
    }
  };

  const handleUpdateProfile = async () => {
    if (!editUsername.trim()) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ username: editUsername, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, username: editUsername } : null);
      setShowProfileModal(false);
      showToast('Profile updated successfully!');
    } else {
      showToast(error.message, 'error');
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

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('room_members')
      .select('rooms (*)')
      .eq('user_id', user.id);
    
    if (data) {
      const formattedRooms = data.map((item: any) => item.rooms);
      setRooms(formattedRooms);
      if (formattedRooms.length > 0 && !activeRoom) {
        setActiveRoom(formattedRooms[0]);
      }
    }
    setLoading(false);
  };

  const fetchMessages = async (roomId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles (*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
  };

  const fetchMembers = async (roomId: string) => {
    const { data } = await supabase
      .from('room_members')
      .select('profiles (*)')
      .eq('room_id', roomId);
    
    if (data) {
      setMembers(data.map((item: any) => item.profiles));
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom) return;

    const content = newMessage;
    setNewMessage('');

    const { error } = await supabase
      .from('messages')
      .insert([{ 
        room_id: activeRoom.id, 
        user_id: user.id, 
        content 
      }]);

    if (error) console.error(error);
  };

  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden relative">
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
              className="fixed inset-y-0 left-0 w-[280px] bg-[#0f172a] border-r border-white/5 flex flex-col z-50 lg:hidden shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg tracking-tight text-white">ChitChat</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
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
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all group"
                  >
                    <Search className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Join</span>
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
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => {
                          setActiveRoom(room);
                          setIsMobileMenuOpen(false);
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
                        {activeRoom?.id === room.id && (
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
              <div className="p-4 bg-slate-900/50 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setShowProfileModal(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20 hover:bg-indigo-500/30 transition-all"
                  >
                    {profile?.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                    setShowProfileModal(true);
                    setIsMobileMenuOpen(false);
                  }}>
                    <p className="text-sm font-bold text-white truncate">{profile?.username || 'User'}</p>
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
      <aside className="hidden lg:flex w-16 bg-[#020617] border-r border-white/5 flex-col items-center py-4 gap-4 flex-shrink-0">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 cursor-pointer hover:rounded-xl transition-all">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div className="w-8 h-[2px] bg-slate-800 rounded-full" />
        <div 
          onClick={() => setShowCreateModal(true)}
          className="w-12 h-12 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-slate-700 cursor-pointer hover:rounded-xl transition-all"
        >
          <Plus className="w-6 h-6" />
        </div>
      </aside>

      <aside className="hidden lg:flex w-64 bg-[#0f172a] border-r border-white/5 flex-col flex-shrink-0">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">ChitChat</span>
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
              {rooms.map((room) => (
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
                  {activeRoom?.id === room.id && (
                    <motion.div 
                      layoutId="activeRoomDesktop"
                      className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                    />
                  )}
                </button>
              ))}
              {rooms.length === 0 && !loading && (
                <div className="px-3 py-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">No rooms yet</p>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>Create One</Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="p-4 bg-slate-900/50 border-t border-white/5">
          <div className="flex items-center gap-3 px-2">
            <button 
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20 hover:bg-indigo-500/30 transition-all"
            >
              {profile?.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </button>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowProfileModal(true)}>
              <p className="text-sm font-semibold text-slate-200 truncate">{profile?.username || 'User'}</p>
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
      <main className="flex-1 flex flex-col bg-[#020617] w-full min-w-0 relative">
        {/* Mobile Global Header - Always visible on mobile */}
        <header className="lg:hidden h-16 px-4 border-b border-white/5 flex items-center justify-between bg-[#020617]/50 backdrop-blur-md z-30 sticky top-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            {activeRoom ? (
              <div className="min-w-0">
                <h2 className="font-bold text-white truncate text-sm">{activeRoom.name}</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded-lg border border-white/5">
                    <p className="text-[10px] text-slate-400 truncate font-medium">Code: <span className="font-mono text-indigo-400">{activeRoom.code}</span></p>
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
                <span className="font-bold text-slate-200 tracking-tight">ChitChat</span>
              </div>
            )}
          </div>
          
          {activeRoom && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowMembers(!showMembers)}
                className={cn(
                  "text-slate-400",
                  showMembers ? 'text-indigo-400 bg-indigo-500/10' : ''
                )}
              >
                <User className="w-5 h-5" />
              </Button>
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowMobileRoomMenu(!showMobileRoomMenu)}
                  className="text-slate-400"
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
                        className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-30 py-1 overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            setShowMembers(!showMembers);
                            setShowMobileRoomMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
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
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                            activeRoom.created_by === user.id ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 cursor-not-allowed"
                          )}
                          disabled={activeRoom.created_by !== user.id}
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
            {/* Desktop Header */}
            <header className="hidden lg:flex h-16 px-6 border-b border-white/5 items-center justify-between bg-[#020617]/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 min-w-0">
                <Hash className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-white truncate">{activeRoom.name}</h2>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-800/50 px-2.5 py-1 rounded-xl border border-white/5">
                      <p className="text-xs text-slate-400 truncate font-medium">Code: <span className="font-mono text-indigo-400">{activeRoom.code}</span></p>
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
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                  className={cn(
                    activeRoom.created_by !== user.id ? 'opacity-50 cursor-not-allowed' : ''
                  )}
                  disabled={activeRoom.created_by !== user.id}
                  title={activeRoom.created_by !== user.id ? "Only the owner can change settings" : "Room Settings"}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex-shrink-0 flex items-center justify-center text-indigo-400 font-bold">
                      {msg.profiles?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{msg.profiles?.username || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed max-w-2xl">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-6">
              <form onSubmit={handleSendMessage} className="relative">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message #${activeRoom.name}`}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 pr-16 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600 shadow-2xl"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800 shadow-xl">
              <MessageSquare className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to ChitChat</h2>
              <p className="text-slate-500 leading-relaxed">Select a room from the sidebar or create a new one to start talking with your friends.</p>
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
              "bg-[#0f172a] border-l border-white/5 flex flex-col flex-shrink-0 overflow-hidden lg:static fixed inset-y-0 right-0 z-40",
              window.innerWidth < 1024 ? "w-full" : "w-64"
            )}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Members — {members.length}
                </h3>
                <button onClick={() => setShowMembers(false)} className="lg:hidden text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 text-xs font-bold">
                        {member.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors flex items-center gap-2">
                          {member.username || 'Unknown'}
                          {member.id === user.id && (
                            <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">You</span>
                          )}
                        </span>
                        {activeRoom.created_by === member.id && (
                          <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest">Admin</span>
                        )}
                      </div>
                    </div>
                    <div className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      onlineUsers.has(member.id) 
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                        : "bg-slate-600"
                    )} title={onlineUsers.has(member.id) ? "Online" : "Offline"} />
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
            <div className="space-y-4">
              <Input 
                label="Room Name" 
                placeholder="e.g. Design Team" 
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                autoFocus
              />
              <Button className="w-full" onClick={handleCreateRoom} isLoading={loading} disabled={!newRoomName.trim()}>
                Create Room
              </Button>
            </div>
          </Modal>
        )}

        {showJoinModal && (
          <Modal title="Join Room" onClose={() => setShowJoinModal(false)}>
            <div className="space-y-4">
              <Input 
                label="Room Code" 
                placeholder="Enter 6-character code" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                autoFocus
              />
              <Button className="w-full" onClick={handleJoinRoom} isLoading={loading} disabled={!joinCode.trim()}>
                Join Room
              </Button>
            </div>
          </Modal>
        )}

        {showProfileModal && (
          <Modal title="Edit Profile" onClose={() => setShowProfileModal(false)}>
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-indigo-500/30 flex items-center justify-center text-3xl text-indigo-400 font-bold">
                  {editUsername?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </div>
              </div>
              <Input 
                label="Username" 
                placeholder="Your display name" 
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
              <div className="pt-2">
                <Button className="w-full" onClick={handleUpdateProfile}>Save Changes</Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setShowProfileModal(false)}>Cancel</Button>
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
                <>
                  <Input 
                    label="Room Name" 
                    placeholder="Enter new room name" 
                    value={editRoomName}
                    onChange={(e) => setEditRoomName(e.target.value)}
                    autoFocus
                    disabled={activeRoom.created_by !== user.id}
                  />
                  <div className="space-y-2">
                    {activeRoom.created_by === user.id ? (
                      <>
                        <Button className="w-full" onClick={handleUpdateRoom}>Update Name</Button>
                        <Button variant="outline" className="w-full text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10" onClick={() => setIsDeleting(true)}>
                          Delete Room
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" className="w-full text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10" onClick={() => setIsLeaving(true)}>
                        Leave Room
                      </Button>
                    )}
                  </div>
                </>
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
      </AnimatePresence>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-red-500/10 border-red-500/20 text-red-400"
            )}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
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
      className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl"
    >
      <h3 className="text-xl font-bold text-white mb-6">{title}</h3>
      {children}
    </motion.div>
  </div>
);
