import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Send, Check, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string | null;
  message: string;
  status: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  is_admin: boolean;
}

interface DisputeMessagingProps {
  disputeId: string;
  userType: 'CUSTOMER' | 'SELLER' | 'ADMIN';
}

export function DisputeMessaging({ disputeId, userType }: DisputeMessagingProps) {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    // Subscribe to real-time messages
    const channel = supabase
      .channel(`dispute-msgs-${disputeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_messages',
          filter: `dispute_id=eq.${disputeId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mark as read if from other party
          if (newMsg.sender_id !== user?.id) {
            markAsRead(newMsg.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [disputeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as unknown as Message[]);
    }
    setLoading(false);
  };

  const markAsRead = async (messageId: string) => {
    await (supabase as any)
      .from('dispute_messages')
      .update({ status: 'READ', read_at: new Date().toISOString() } as any)
      .eq('id', messageId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      const { error } = await (supabase as any)
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          sender_type: userType,
          sender_name: user.name || 'User',
          message: newMessage,
          status: 'SENT',
          is_admin: userType === 'ADMIN',
        } as any);

      if (error) throw error;

      // Trigger SMS notification via edge function
      try {
        await supabase.functions.invoke('sms-notifications', {
          body: {
            action: 'dispute_message',
            disputeId,
            senderType: userType,
            message: newMessage.substring(0, 100),
          }
        });
      } catch {
        // SMS is best-effort
      }

      setNewMessage('');
      toast({ title: 'Message sent', description: 'Recipient will be notified via SMS' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (msg: Message) => {
    if (msg.sender_id !== user?.id) return null;
    if (msg.status === 'READ' || msg.read_at) return <CheckCheck size={12} className="text-primary" />;
    if (msg.status === 'DELIVERED' || msg.delivered_at) return <CheckCheck size={12} className="text-muted-foreground" />;
    return <Check size={12} className="text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Messages */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto bg-muted/20">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Start the conversation.</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg p-3 ${
                isMine
                  ? 'bg-primary text-primary-foreground'
                  : msg.is_admin
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-foreground border border-amber-200'
                    : 'bg-card text-card-foreground border border-border'
              }`}>
                {!isMine && (
                  <p className={`text-xs font-medium mb-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {msg.sender_name || msg.sender_type} {msg.is_admin && '(Admin)'}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {getStatusIcon(msg)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2 bg-card">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition flex items-center gap-2"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
