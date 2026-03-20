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
  Search,
  ChevronRight,
  MoreVertical,
  Menu,
  X,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { nanoid } from 'nanoid';

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
  const [showMembers, setShowMembers] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      fetchMessages(activeRoom.id);
      fetchMembers(activeRoom.id);
      
      // Subscribe to real-time messages
      const channel = supabase
        .channel(`room:${activeRoom.id}`)
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
            // Fetch profile for the new message
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newMessage.user_id)
              .single();
            
            setMessages(prev => [...prev, { ...newMessage, profiles: profile }]);
          }
        )
        .subscribe();

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
    } else {
      alert(error.message);
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
    const code = nanoid(6).toUpperCase();
    
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{ name: newRoomName, code, created_by: user.id }])
      .select()
      .single();

    if (room) {
      await supabase.from('room_members').insert([{ user_id: user.id, room_id: room.id }]);
      setRooms(prev => [...prev, room]);
      setActiveRoom(room);
      setShowCreateModal(false);
      setNewRoomName('');
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joinCode.toUpperCase())
      .single();

    if (room) {
      // Check if already a member
      const { data: member } = await supabase
        .from('room_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('room_id', room.id)
        .single();

      if (!member) {
        await supabase.from('room_members').insert([{ user_id: user.id, room_id: room.id }]);
        setRooms(prev => [...prev, room]);
      }
      setActiveRoom(room);
      setShowJoinModal(false);
      setJoinCode('');
    } else {
      alert('Invalid room code');
    }
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
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Far Left Server Bar - Hidden on mobile, shown in drawer */}
      <aside className={cn(
        "w-16 bg-[#020617] border-r border-white/5 flex flex-col items-center py-4 gap-4 flex-shrink-0 z-50 transition-transform lg:translate-x-0 lg:static fixed inset-y-0 left-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 cursor-pointer hover:rounded-xl transition-all">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div className="w-8 h-[2px] bg-slate-800 rounded-full" />
        <div className="w-12 h-12 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-slate-700 cursor-pointer hover:rounded-xl transition-all">
          <Plus className="w-6 h-6" />
        </div>
      </aside>

      {/* Room Sidebar - Drawer on mobile */}
      <aside className={cn(
        "w-64 bg-[#0f172a] border-r border-white/5 flex flex-col flex-shrink-0 z-50 transition-transform lg:translate-x-0 lg:static fixed inset-y-0 left-16",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-[calc(100%+64px)]"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">ChitChat</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-6 py-4">
          {/* Navigation Section */}
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Navigation
            </div>
            <button 
              onClick={() => {
                setShowMembers(!showMembers);
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group",
                showMembers ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              )}
            >
              <User className="w-4 h-4" />
              <span className="flex-1 text-left font-medium">Users online</span>
            </button>
            <button 
              onClick={() => {
                // History logic could go here
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200 group"
            >
              <History className="w-4 h-4" />
              <span className="flex-1 text-left font-medium">History</span>
            </button>
            <button 
              onClick={() => {
                setShowProfileModal(true);
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-slate-800 text-slate-400 hover:text-slate-200 group"
            >
              <Settings className="w-4 h-4" />
              <span className="flex-1 text-left font-medium">Settings</span>
            </button>
            <button 
              onClick={() => {
                handleLogout();
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              className="w-full lg:hidden flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-red-500/10 text-slate-400 hover:text-red-400 group"
            >
              <LogOut className="w-4 h-4" />
              <span className="flex-1 text-left font-medium">Logout</span>
            </button>
          </div>

          {/* Rooms Section */}
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Rooms
              <div className="flex gap-1">
                <button onClick={() => setShowJoinModal(true)} className="p-1 hover:text-indigo-400 transition-colors" title="Join Room">
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowCreateModal(true)} className="p-1 hover:text-indigo-400 transition-colors" title="Create Room">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => {
                  setActiveRoom(room);
                  if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                  activeRoom?.id === room.id 
                  ? 'bg-indigo-600/10 text-indigo-400' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Hash className={`w-4 h-4 ${activeRoom?.id === room.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="flex-1 text-left truncate font-medium">{room.name}</span>
                <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${activeRoom?.id === room.id ? 'opacity-100' : ''}`} />
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

        {/* User Profile Section */}
        <div className="p-4 bg-slate-900/50 border-t border-white/5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold hover:border-indigo-500/50 transition-all"
            >
              {profile?.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </button>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowProfileModal(true)}>
              <p className="text-sm font-bold text-white truncate">{profile?.username || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-[#020617] w-full min-w-0">
        {activeRoom ? (
          <>
            {/* Header */}
            <header className="h-16 px-4 lg:px-6 border-b border-white/5 flex items-center justify-between bg-[#020617]/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-white"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <Hash className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-white truncate">{activeRoom.name}</h2>
                  <p className="text-[10px] lg:text-xs text-slate-500 truncate">Code: <span className="font-mono text-indigo-400">{activeRoom.code}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-1 lg:gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowMembers(!showMembers)}
                  className={cn(
                    "hidden sm:inline-flex",
                    showMembers ? 'text-indigo-400 bg-indigo-500/10' : ''
                  )}
                >
                  <User className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex"><Settings className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="sm:hidden"><MoreVertical className="w-5 h-5" /></Button>
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
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800">
              <MessageSquare className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl font-bold text-white">Select a room to start chatting</h2>
              <p className="text-slate-500">Join an existing room with a code or create your own private space.</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setShowJoinModal(true)} variant="outline">Join Room</Button>
              <Button onClick={() => setShowCreateModal(true)}>Create Room</Button>
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
                  <div key={member.id} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 text-xs font-bold">
                      {member.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                      {member.username || 'Unknown'}
                    </span>
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
              <Button className="w-full" onClick={handleCreateRoom}>Create Room</Button>
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
                onChange={(e) => setJoinCode(e.target.value)}
                autoFocus
              />
              <Button className="w-full" onClick={handleJoinRoom}>Join Room</Button>
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
