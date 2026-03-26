import { useState, useEffect } from "react";
import {
  HelpCircle,
  Plus,
  Send,
  Loader2,
  MessageSquare,
  User,
  BookOpen,
  CheckSquare,
  FileText,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  subject: string;
  ticket_number?: string;
  category?: string;
  priority: string;
  status: string;
  description?: string;
  created_at: string;
}

interface SupportMessage {
  id: string;
  sender_id: string;
  is_staff: boolean;
  sender_type?: string;
  message: string;
  created_at: string;
}

type SubTab = "help" | "tickets" | "account" | "onboarding" | "resources" | "status";

const TAB_MAP: Partial<Record<string, SubTab>> = {
  support: "help",
  "support-help": "help",
  "support-tickets": "tickets",
  "support-account-manager": "account",
  "support-onboarding": "onboarding",
  "support-resources": "resources",
  "support-status": "status",
};

const SUBTABS: { id: SubTab; label: string; icon: typeof HelpCircle }[] = [
  { id: "help", label: "Help Center", icon: BookOpen },
  { id: "tickets", label: "Tickets", icon: MessageSquare },
  { id: "account", label: "Account Manager", icon: User },
  { id: "onboarding", label: "Onboarding", icon: CheckSquare },
  { id: "resources", label: "Resources", icon: FileText },
  { id: "status", label: "System Status", icon: AlertCircle },
];

export function SupportTab({ activeTab = "support" }: { activeTab?: string }) {
  const [subTab, setSubTab] = useState<SubTab>(TAB_MAP[activeTab] ?? "help");

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<(Ticket & { messages?: SupportMessage[] }) | null>(null);
  const [message, setMessage] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newMessage, setNewMessage] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("");
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateValue, setRateValue] = useState(0);
  const [rateComment, setRateComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Help Center
  const [kbQuery, setKbQuery] = useState("");
  const [kbArticles, setKbArticles] = useState<any[]>([]);
  const [_kbCategories, setKbCategories] = useState<string[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [kbLoading, setKbLoading] = useState(false);

  // Account Manager
  const [accountManager, setAccountManager] = useState<any | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showMeetingRequest, setShowMeetingRequest] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDesc, setMeetingDesc] = useState("");
  const [meetingDate, setMeetingDate] = useState("");

  // Onboarding
  const [checklist, setChecklist] = useState<any | null>(null);
  const [onboardingSteps] = useState([
    { id: "complete_profile", label: "Complete your profile" },
    { id: "add_first_product", label: "Add your first product" },
    { id: "setup_payment", label: "Set up payment" },
    { id: "customize_store", label: "Customize your store" },
    { id: "add_shipping_method", label: "Add shipping method" },
    { id: "create_category", label: "Create a category" },
    { id: "preview_store", label: "Preview your store" },
    { id: "first_sale", label: "Make your first sale" },
    { id: "enable_marketing", label: "Enable marketing" },
    { id: "connect_domain", label: "Connect your domain" },
  ]);

  // Resources & Status
  const [resources, setResources] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<{ overall_status: string; components: any[] } | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    const res = await api.getSupportTickets?.({ status: ticketStatusFilter || undefined });
    setLoading(false);
    if (res?.success && res.data) setTickets(Array.isArray(res.data) ? res.data : []);
  };

  const loadTicket = async (id: string) => {
    setSelectedId(id);
    const res = await api.getSupportTicket?.(id);
    if (res?.success && res.data) setTicket(res.data);
  };

  const loadKb = async () => {
    setKbLoading(true);
    const [articlesRes, categoriesRes] = await Promise.all([
      api.searchKnowledgeBase?.({ q: kbQuery || undefined, category: undefined }),
      api.getKBCategories?.(),
    ]);
    setKbLoading(false);
    if (articlesRes?.success && articlesRes.data) setKbArticles(Array.isArray(articlesRes.data) ? articlesRes.data : []);
    if (categoriesRes?.success && categoriesRes.data) setKbCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
  };

  const loadArticle = async (slug: string) => {
    const res = await api.getKBArticle?.(slug);
    if (res?.success && res.data) setSelectedArticle(res.data);
  };

  const loadAccountManager = async () => {
    const [managerRes, meetingsRes] = await Promise.all([
      api.getAccountManager?.(),
      api.getAccountManagerMeetings?.(),
    ]);
    if (managerRes?.success && managerRes.data) setAccountManager(managerRes.data);
    else setAccountManager(null);
    if (meetingsRes?.success && meetingsRes.data) setMeetings(meetingsRes.data);
  };

  const loadOnboarding = async () => {
    const res = await api.getOnboardingChecklist?.();
    if (res?.success && res.data) setChecklist(res.data);
  };

  const loadResources = async () => {
    const res = await api.getSupportResources?.();
    if (res?.success && res.data) setResources(res.data);
  };

  const loadStatus = async () => {
    const res = await api.getSystemStatus?.();
    if (res?.success && res.data) setSystemStatus(res.data);
  };

  useEffect(() => {
    const mapped = TAB_MAP[activeTab];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  useEffect(() => {
    if (subTab === "tickets") loadTickets();
  }, [subTab, ticketStatusFilter]);

  useEffect(() => {
    if (selectedId) loadTicket(selectedId);
    else setTicket(null);
  }, [selectedId]);

  useEffect(() => {
    if (subTab === "help") loadKb();
  }, [subTab, kbQuery]);

  useEffect(() => {
    if (subTab === "account") loadAccountManager();
  }, [subTab]);

  useEffect(() => {
    if (subTab === "onboarding") loadOnboarding();
  }, [subTab]);

  useEffect(() => {
    if (subTab === "resources") loadResources();
  }, [subTab]);

  useEffect(() => {
    if (subTab === "status") loadStatus();
  }, [subTab]);

  const handleCreateTicket = async () => {
    if (!newSubject.trim()) return;
    setSending(true);
    const res = await api.createSupportTicket?.({
      subject: newSubject.trim(),
      description: newDescription.trim() || undefined,
      category: newCategory,
      message: newMessage.trim() || undefined,
    });
    setSending(false);
    if (res?.success && res.data) {
      setShowNew(false);
      setNewSubject("");
      setNewDescription("");
      setNewMessage("");
      loadTickets();
      loadTicket(res.data.id);
      setSubTab("tickets");
    } else {
      alert(res?.error || "Failed to create ticket");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    const res = await api.addSupportMessage?.(selectedId, message.trim());
    setSending(false);
    if (res?.success) {
      setMessage("");
      loadTicket(selectedId);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedId) return;
    const res = await api.closeSupportTicket?.(selectedId);
    if (res?.success) {
      loadTickets();
      setSelectedId(null);
      setTicket(null);
    }
  };

  const handleRateTicket = async () => {
    if (!selectedId || rateValue < 1 || rateValue > 5) return;
    const res = await api.rateSupportTicket?.(selectedId, rateValue, rateComment);
    if (res?.success) {
      setShowRateModal(false);
      setRateValue(0);
      setRateComment("");
      loadTicket(selectedId);
    }
  };

  const handleCompleteStep = async (stepId: string) => {
    const res = await api.completeOnboardingStep?.(stepId);
    if (res?.success) loadOnboarding();
  };

  const handleRequestMeeting = async () => {
    if (!meetingTitle.trim()) return;
    setSending(true);
    const res = await api.requestAccountManagerMeeting?.({
      title: meetingTitle,
      description: meetingDesc || undefined,
      preferred_date: meetingDate || undefined,
    });
    setSending(false);
    if (res?.success) {
      setShowMeetingRequest(false);
      setMeetingTitle("");
      setMeetingDesc("");
      setMeetingDate("");
      loadAccountManager();
    } else {
      alert(res?.error || "Failed to request meeting");
    }
  };

  const handleArticleFeedback = async (articleId: string, helpful: boolean) => {
    await api.submitArticleFeedback?.(articleId, helpful);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground">Support</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {SUBTABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
              subTab === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Help Center */}
      {subTab === "help" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="search"
              value={kbQuery}
              onChange={(e) => setKbQuery(e.target.value)}
              placeholder="Search knowledge base..."
              className="flex-1 px-4 py-2 rounded-lg border border-border"
            />
            <button onClick={() => loadKb()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
              Search
            </button>
          </div>
          {selectedArticle ? (
            <div className="bg-card border border-border rounded-xl p-6">
              <button onClick={() => setSelectedArticle(null)} className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                ← Back
              </button>
              <h3 className="text-xl font-semibold mb-2">{selectedArticle.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedArticle.category} • {selectedArticle.difficulty || "beginner"}
              </p>
              <div className="prose prose-sm max-w-none mb-6 whitespace-pre-wrap">{selectedArticle.content || ""}</div>
              <p className="text-sm text-muted-foreground mb-2">Was this helpful?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleArticleFeedback(selectedArticle.id, true)}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-green-100 text-green-800 text-sm"
                >
                  <ThumbsUp size={16} /> Yes
                </button>
                <button
                  onClick={() => handleArticleFeedback(selectedArticle.id, false)}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-red-100 text-red-800 text-sm"
                >
                  <ThumbsDown size={16} /> No
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {kbLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : kbArticles.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                  <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No articles found. Try a different search or browse categories.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {kbArticles.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => a.slug && loadArticle(a.slug)}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/50 transition"
                    >
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.excerpt}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tickets */}
      {subTab === "tickets" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <select
              value={ticketStatusFilter}
              onChange={(e) => setTicketStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_response">Waiting Response</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <Plus size={18} />
              New Ticket
            </button>
          </div>

          {showNew && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Create Support Ticket</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  className="w-full px-4 py-2 rounded-lg border border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-border">
                  <option value="technical">Technical</option>
                  <option value="billing">Billing</option>
                  <option value="account">Account</option>
                  <option value="products">Products</option>
                  <option value="orders">Orders</option>
                  <option value="shipping">Shipping</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border border-border"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateTicket} disabled={sending || !newSubject.trim() || !newDescription.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                  {sending ? "Creating..." : "Create Ticket"}
                </button>
                <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-muted rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-3 border-b border-border font-medium">Your Tickets</div>
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : tickets.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <HelpCircle size={32} className="mx-auto mb-2 opacity-50" />
                    No tickets yet. Create one to get help.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {tickets.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => loadTicket(t.id)}
                        className={cn("w-full text-left p-4 hover:bg-muted/50 transition", selectedId === t.id && "bg-primary/10")}
                      >
                        <p className="font-medium truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.ticket_number || t.id.slice(0, 8)} • {t.status} • {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
              {ticket ? (
                <>
                  <div className="p-4 border-b border-border flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {ticket.ticket_number && `${ticket.ticket_number} • `}Status: {ticket.status} • Created {new Date(ticket.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {ticket.status !== "closed" && (
                        <>
                          <button onClick={() => setShowRateModal(true)} className="px-3 py-1 text-sm bg-muted rounded-lg">
                            Rate
                          </button>
                          <button onClick={handleCloseTicket} className="px-3 py-1 text-sm bg-muted rounded-lg">
                            Close
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {ticket.description && (
                    <div className="p-4 border-b border-border bg-muted/30">
                      <p className="text-sm">{ticket.description}</p>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                    {(ticket.messages || []).map((m) => (
                      <div key={m.id} className={cn("rounded-lg p-3", m.is_staff ? "bg-primary/10 ml-8" : "bg-muted mr-8")}>
                        <p className="text-xs font-medium mb-1">{m.is_staff ? "Support" : "You"}</p>
                        <p className="text-sm">{m.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {ticket.status !== "closed" && (
                    <div className="p-3 border-t border-border flex gap-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Add a message..."
                        className="flex-1 px-4 py-2 rounded-lg border border-border"
                      />
                      <button onClick={handleSendMessage} disabled={sending || !message.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                        {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <HelpCircle size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Select a ticket or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showRateModal && selectedId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4">
                <h3 className="font-semibold mb-4">Rate your support experience</h3>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRateValue(n)}
                      className={cn("w-10 h-10 rounded-full border-2 text-lg font-medium", rateValue >= n ? "border-primary bg-primary text-primary-foreground" : "border-border")}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <textarea value={rateComment} onChange={(e) => setRateComment(e.target.value)} placeholder="Optional comment" className="w-full px-4 py-2 rounded-lg border border-border mb-4" rows={2} />
                <div className="flex gap-2">
                  <button onClick={handleRateTicket} disabled={rateValue < 1} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                    Submit
                  </button>
                  <button onClick={() => setShowRateModal(false)} className="px-4 py-2 bg-muted rounded-lg">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Account Manager */}
      {subTab === "account" && (
        <div className="space-y-6">
          {accountManager ? (
            <>
              <div className="bg-card border border-border rounded-xl p-6 flex flex-wrap gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  {accountManager.avatar_url ? (
                    <img src={accountManager.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User size={40} className="text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold">{accountManager.name}</h3>
                  <p className="text-muted-foreground">{accountManager.title || "Account Manager"}</p>
                  <p className="text-sm mt-1">{accountManager.email}</p>
                  {accountManager.phone && <p className="text-sm">{accountManager.phone}</p>}
                  {accountManager.bio && <p className="text-sm mt-2">{accountManager.bio}</p>}
                  <button
                    onClick={() => setShowMeetingRequest(true)}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                  >
                    Request Meeting
                  </button>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Upcoming Meetings</h4>
                {meetings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No upcoming meetings</p>
                ) : (
                  <div className="space-y-2">
                    {meetings.map((m) => (
                      <div key={m.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-sm text-muted-foreground">{new Date(m.scheduled_at).toLocaleString()}</p>
                        </div>
                        <span className="text-sm px-2 py-1 rounded bg-muted">{m.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <User size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">No Account Manager Assigned</h3>
              <p className="text-muted-foreground text-sm">
                Dedicated account managers are available for Business and Enterprise tiers. Upgrade your plan or create a support ticket for assistance.
              </p>
            </div>
          )}

          {showMeetingRequest && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="font-semibold mb-4">Request Meeting</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title *</label>
                    <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea value={meetingDesc} onChange={(e) => setMeetingDesc(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-border" rows={3} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Preferred Date</label>
                    <input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-border" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleRequestMeeting} disabled={sending || !meetingTitle.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                    {sending ? "Requesting..." : "Request"}
                  </button>
                  <button onClick={() => setShowMeetingRequest(false)} className="px-4 py-2 bg-muted rounded-lg">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Onboarding */}
      {subTab === "onboarding" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Get Started</h3>
          {checklist && (
            <div className="mb-6">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${checklist.completion_percentage || 0}%` }} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{checklist.completion_percentage || 0}% complete</p>
            </div>
          )}
          <div className="space-y-2">
            {onboardingSteps.map((step) => {
              const completed = checklist?.completed_steps?.includes(step.id);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    completed ? "bg-green-50 border-green-200" : "bg-card border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {completed ? (
                      <CheckSquare size={24} className="text-green-600" />
                    ) : (
                      <div className="w-6 h-6 rounded border-2 border-border" />
                    )}
                    <span className={completed ? "line-through text-muted-foreground" : ""}>{step.label}</span>
                  </div>
                  {!completed && (
                    <button
                      onClick={() => handleCompleteStep(step.id)}
                      className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-lg"
                    >
                      Mark complete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resources */}
      {subTab === "resources" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.length === 0 ? (
            <div className="col-span-full bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
              <FileText size={48} className="mx-auto mb-2 opacity-50" />
              <p>No resources available</p>
            </div>
          ) : (
            resources.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card border border-border rounded-xl p-4 block hover:bg-muted/50 transition"
              >
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.resource_type} • {r.duration_minutes ? `${r.duration_minutes} min` : ""}</p>
              </a>
            ))
          )}
        </div>
      )}

      {/* System Status */}
      {subTab === "status" && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">System Status</h3>
          {systemStatus ? (
            <>
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-6",
                systemStatus.overall_status === "operational" && "bg-green-100 text-green-800",
                systemStatus.overall_status === "degraded" && "bg-yellow-100 text-yellow-800",
                systemStatus.overall_status === "major_outage" && "bg-red-100 text-red-800"
              )}>
                <AlertCircle size={20} />
                <span className="font-medium capitalize">{systemStatus.overall_status.replace("_", " ")}</span>
              </div>
              <div className="space-y-2">
                {(systemStatus.components || []).map((c: any) => (
                  <div key={c.id || c.component_name} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>{c.component_name}</span>
                    <span className={cn(
                      "text-sm font-medium capitalize",
                      c.status === "operational" && "text-green-600",
                      c.status === "degraded" && "text-yellow-600",
                      c.status === "partial_outage" && "text-orange-600",
                      c.status === "major_outage" && "text-red-600"
                    )}>
                      {c.status?.replace("_", " ")}
                    </span>
                  </div>
                ))}
                {(!systemStatus.components || systemStatus.components.length === 0) && (
                  <p className="text-muted-foreground text-sm">All systems operational</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
