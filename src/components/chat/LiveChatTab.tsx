import { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  Send,
  Loader2,
  Settings,
  MessageSquarePlus,
  BarChart3,
  ChevronDown,
  Check,
  Zap,
} from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  customer_name?: string;
  customer_email?: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  last_message_at?: string;
  created_at: string;
}

interface Message {
  id: string;
  sender_type: string;
  sender_name?: string;
  message: string;
  content?: string;
  created_at: string;
}

type SubTab = "conversations" | "canned" | "widget" | "analytics";

export function LiveChatTab() {
  const [subTab, setSubTab] = useState<SubTab>("conversations");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [convo, setConvo] = useState<(Conversation & { messages?: Message[] }) | null>(null);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCannedPicker, setShowCannedPicker] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Canned responses
  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [showNewCanned, setShowNewCanned] = useState(false);
  const [newCannedTitle, setNewCannedTitle] = useState("");
  const [newCannedContent, setNewCannedContent] = useState("");
  const [newCannedShortcut, setNewCannedShortcut] = useState("");

  // Widget settings
  const [_widgetSettings, setWidgetSettings] = useState<any>(null);
  const [widgetWelcome, setWidgetWelcome] = useState("");
  const [widgetCompany, setWidgetCompany] = useState("");

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);

  const loadConversations = async () => {
    setLoading(true);
    const res = await api.getChatConversations?.({ status: statusFilter || undefined });
    setLoading(false);
    if (res?.success && res.data) setConversations(Array.isArray(res.data) ? res.data : []);
  };

  const loadConversation = async (id: string) => {
    setSelectedId(id);
    const res = await api.getChatConversation?.(id);
    if (res?.success && res.data) {
      setConvo(res.data);
      api.markChatMessagesRead?.(id);
    }
  };

  const loadCanned = async () => {
    const res = await api.getChatCannedResponses?.();
    if (res?.success && res.data) setCannedResponses(res.data);
  };

  const loadWidget = async () => {
    const res = await api.getChatWidgetSettings?.();
    if (res?.success && res.data) {
      setWidgetSettings(res.data);
      setWidgetWelcome(res.data.welcome_message || "");
      setWidgetCompany(res.data.company_name || "");
    }
  };

  const loadAnalytics = async () => {
    const res = await api.getChatAnalytics?.();
    if (res?.success && res.data) setAnalytics(res.data);
  };

  useEffect(() => {
    if (subTab === "conversations") {
      loadConversations();
      loadCanned(); // Load for canned picker
    }
  }, [subTab, statusFilter]);

  useEffect(() => {
    if (selectedId) loadConversation(selectedId);
    else setConvo(null);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo?.messages]);

  useEffect(() => {
    if (subTab === "canned") loadCanned();
  }, [subTab]);

  useEffect(() => {
    if (subTab === "widget") loadWidget();
  }, [subTab]);

  useEffect(() => {
    if (subTab === "analytics") loadAnalytics();
  }, [subTab]);

  const handleSend = async () => {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    const res = await api.sendChatMessage?.(selectedId, message.trim());
    setSending(false);
    if (res?.success) {
      setMessage("");
      loadConversation(selectedId);
      loadConversations();
    }
  };

  const handleUseCanned = (content: string) => {
    setMessage(content);
    setShowCannedPicker(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedId) return;
    const res = await api.updateChatConversationStatus?.(selectedId, status);
    if (res?.success) {
      loadConversation(selectedId);
      loadConversations();
      setShowStatusMenu(false);
    }
  };

  const handleCreateCanned = async () => {
    if (!newCannedTitle.trim() || !newCannedContent.trim()) return;
    const res = await api.createChatCannedResponse?.({
      title: newCannedTitle,
      content: newCannedContent,
      shortcut: newCannedShortcut || undefined,
    });
    if (res?.success) {
      setShowNewCanned(false);
      setNewCannedTitle("");
      setNewCannedContent("");
      setNewCannedShortcut("");
      loadCanned();
    } else {
      alert(res?.error || "Failed to create");
    }
  };

  const handleSaveWidget = async () => {
    const res = await api.updateChatWidgetSettings?.({
      welcome_message: widgetWelcome,
      company_name: widgetCompany,
    });
    if (res?.success) loadWidget();
  };

  const msgText = (m: Message) => m.content || m.message || "";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground">Live Chat</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {[
          { id: "conversations" as SubTab, label: "Conversations", icon: MessageCircle },
          { id: "canned" as SubTab, label: "Canned Responses", icon: MessageSquarePlus },
          { id: "widget" as SubTab, label: "Widget Settings", icon: Settings },
          { id: "analytics" as SubTab, label: "Analytics", icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
              subTab === id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Conversations */}
      {subTab === "conversations" && (
        <div className="grid md:grid-cols-3 gap-4 h-[500px]">
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded border border-border text-sm"
              >
                <option value="">All</option>
                <option value="waiting">Waiting</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">No conversations yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => loadConversation(c.id)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-muted/50 transition",
                        selectedId === c.id && "bg-primary/10 border-l-4 border-l-primary"
                      )}
                    >
                      <p className="font-medium truncate">{c.customer_name || "Guest"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.customer_email || "—"}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px]",
                          c.status === "active" && "bg-green-100 text-green-800",
                          c.status === "waiting" && "bg-yellow-100 text-yellow-800",
                          c.status === "resolved" && "bg-blue-100 text-blue-800",
                          c.status === "closed" && "bg-gray-100 text-gray-600"
                        )}>
                          {c.status}
                        </span>
                        {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : new Date(c.created_at).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="md:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
            {convo ? (
              <>
                <div className="p-3 border-b border-border flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <p className="font-medium">{convo.customer_name || "Customer"}</p>
                    <p className="text-sm text-muted-foreground">{convo.customer_email || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm"
                      >
                        {convo.status} <ChevronDown size={14} />
                      </button>
                      {showStatusMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                          {["waiting", "active", "resolved", "closed"].map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(s)}
                              className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 capitalize"
                            >
                              {convo.status === s && <Check size={14} />}
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(convo.messages || []).map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.sender_type === "seller" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-2",
                          m.sender_type === "seller"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-xs opacity-80">{m.sender_name || (m.sender_type === "seller" ? "You" : "Customer")}</p>
                        <p className="text-sm">{msgText(m)}</p>
                        <p className="text-xs opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {convo.status !== "closed" && convo.status !== "resolved" && (
                  <div className="p-3 border-t border-border flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type a message..."
                        className="w-full px-4 py-2 rounded-lg border border-border bg-background"
                      />
                      <button
                        onClick={() => setShowCannedPicker(!showCannedPicker)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                        title="Canned responses"
                      >
                        <Zap size={18} className="text-muted-foreground" />
                      </button>
                      {showCannedPicker && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                          {cannedResponses.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">No canned responses. Add some in Canned Responses tab.</p>
                          ) : (
                            cannedResponses.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => handleUseCanned(r.content)}
                                className="w-full text-left p-3 hover:bg-muted border-b border-border last:border-0"
                              >
                                <p className="font-medium text-sm">{r.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={sending || !message.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                    >
                      {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canned Responses */}
      {subTab === "canned" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewCanned(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <MessageSquarePlus size={18} />
              Add Response
            </button>
          </div>
          {showNewCanned && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">New Canned Response</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  value={newCannedTitle}
                  onChange={(e) => setNewCannedTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border"
                  placeholder="e.g. Shipping info"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content *</label>
                <textarea
                  value={newCannedContent}
                  onChange={(e) => setNewCannedContent(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border"
                  rows={4}
                  placeholder="Type your quick reply..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shortcut (optional)</label>
                <input
                  value={newCannedShortcut}
                  onChange={(e) => setNewCannedShortcut(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border"
                  placeholder="e.g. /shipping"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateCanned} disabled={!newCannedTitle.trim() || !newCannedContent.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                  Save
                </button>
                <button onClick={() => setShowNewCanned(false)} className="px-4 py-2 bg-muted rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-4">
            {cannedResponses.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-start">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.content}</p>
                  {r.shortcut && <span className="text-xs text-muted-foreground">/{r.shortcut}</span>}
                </div>
              </div>
            ))}
            {cannedResponses.length === 0 && !showNewCanned && (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                <MessageSquarePlus size={48} className="mx-auto mb-2 opacity-50" />
                <p>No canned responses. Add quick replies to save time while chatting.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Widget Settings */}
      {subTab === "widget" && (
        <div className="bg-card border border-border rounded-xl p-6 max-w-2xl space-y-6">
          <h3 className="font-semibold">Chat Widget</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Welcome Message</label>
            <textarea
              value={widgetWelcome}
              onChange={(e) => setWidgetWelcome(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border"
              rows={3}
              placeholder="Hi! How can we help you today?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input
              value={widgetCompany}
              onChange={(e) => setWidgetCompany(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border"
              placeholder="Your store name"
            />
          </div>
          <button onClick={handleSaveWidget} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            Save Settings
          </button>
        </div>
      )}

      {/* Analytics */}
      {subTab === "analytics" && (
        <div className="space-y-6">
          {analytics?.summary && (
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Total Conversations</p>
                <p className="text-2xl font-bold">{analytics.summary.total_conversations}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-bold">{analytics.summary.new_conversations}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{analytics.summary.resolved_conversations}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold">{analytics.summary.total_messages}</p>
              </div>
            </div>
          )}
          {(!analytics || !analytics.summary) && (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
              <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
              <p>No analytics data yet. Start chatting with customers to see metrics.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
