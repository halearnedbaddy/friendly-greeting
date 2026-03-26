import { useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useToast } from "@/hooks/use-toast";

interface StorefrontChatWidgetProps {
  storeSlug: string;
  storeName?: string;
}

export function StorefrontChatWidget({ storeSlug, storeName }: StorefrontChatWidgetProps) {
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSent(false);
    const res = await api.sendStoreChatMessage?.(storeSlug, message.trim(), customerName.trim() || undefined, customerEmail.trim() || undefined);
    setSending(false);
    if (res?.success) {
      setMessage("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } else {
      toast({ title: "Failed to send", description: res?.error || "Please try again", variant: "destructive" });
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition flex items-center justify-center"
        aria-label="Chat with store"
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold">Chat with {storeName || "Store"}</h3>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
              <X size={18} />
            </button>
          </div>
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Have a question? Send a message and the store will get back to you.
            </p>
            {!user && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Your name (optional)</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Name"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Your email (optional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
              />
            </div>
            {sent && (
              <p className="text-sm text-green-600">Message sent! The store will respond soon.</p>
            )}
          </div>
          <div className="p-4 border-t border-border">
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Send size={16} />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
