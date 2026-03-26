import { useState, useEffect } from "react";
import { Star, MessageSquare, CheckCircle, XCircle, Loader2, Send, Settings, HelpCircle } from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  product_id: string;
  rating: number;
  title?: string;
  content: string;
  customer_name?: string;
  created_at: string;
  status: string;
  seller_response?: string;
  seller_responded_at?: string;
  images?: string[];
  helpful_count?: number;
  not_helpful_count?: number;
  is_verified_purchase?: boolean;
  products?: { id: string; name: string; images?: string[] };
}

interface AnalyticsSummary {
  total_reviews: number;
  average_rating: string;
  rating_distribution: Record<number, number>;
  with_photos: number;
  with_videos: number;
  response_rate: string;
}

export function ReviewsTab() {
  const [view, setView] = useState<"list" | "analytics" | "requests" | "qa">("list");
  const [filters, setFilters] = useState({
    status: "all",
    rating: "",
    sort: "recent",
    page: 1,
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [analytics, setAnalytics] = useState<{ summary: AnalyticsSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [requestableOrders, setRequestableOrders] = useState<{ id: string; item_name?: string; created_at: string }[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [sendingRequests, setSendingRequests] = useState(false);
  const [autoConfig, setAutoConfig] = useState<{ review_auto_request_enabled?: boolean; review_auto_request_delay_days?: number; review_auto_request_method?: string }>({});
  const [savingAutoConfig, setSavingAutoConfig] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const loadReviews = async () => {
    setLoading(true);
    const res = await api.getSellerReviews?.({
      status: filters.status,
      rating: filters.rating || undefined,
      sort: filters.sort,
      page: filters.page,
      limit: 50,
    });
    setLoading(false);
    if (res?.success && res.data) {
      const d = res.data as { reviews?: Review[]; pagination?: typeof pagination };
      setReviews(d.reviews || []);
      setPagination(d.pagination || pagination);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    const res = await api.getSellerReviewAnalytics?.({});
    setAnalyticsLoading(false);
    if (res?.success && res.data) {
      setAnalytics({ summary: res.data.summary });
    }
  };

  useEffect(() => {
    loadReviews();
  }, [filters.status, filters.rating, filters.sort, filters.page]);

  useEffect(() => {
    if (view === "analytics") loadAnalytics();
  }, [view]);

  const loadRequestableOrders = async () => {
    const res = await api.getRequestableOrders?.();
    if (res?.success && Array.isArray(res.data)) setRequestableOrders(res.data);
  };

  const loadAutoConfig = async () => {
    const res = await api.getReviewAutoRequestConfig?.();
    if (res?.success && res.data) setAutoConfig(res.data);
  };

  const loadQuestions = async () => {
    setQuestionsLoading(true);
    const res = await api.getSellerQuestions?.();
    setQuestionsLoading(false);
    if (res?.success && Array.isArray(res.data)) setQuestions(res.data);
  };

  useEffect(() => {
    if (view === "requests") {
      loadRequestableOrders();
      loadAutoConfig();
    }
  }, [view]);

  useEffect(() => {
    if (view === "qa") loadQuestions();
  }, [view]);

  const handleSendRequests = async () => {
    const ids = Array.from(selectedOrderIds);
    if (!ids.length) return;
    setSendingRequests(true);
    const res = await api.sendReviewRequests?.(ids);
    setSendingRequests(false);
    if (res?.success) {
      setSelectedOrderIds(new Set());
      loadRequestableOrders();
    } else {
      alert(res?.error || "Failed to send");
    }
  };

  const handleSaveAutoConfig = async () => {
    setSavingAutoConfig(true);
    await api.updateReviewAutoRequestConfig?.({
      enabled: autoConfig.review_auto_request_enabled,
      delay_days: autoConfig.review_auto_request_delay_days ?? 7,
      send_via: autoConfig.review_auto_request_method || "email",
    });
    setSavingAutoConfig(false);
    loadAutoConfig();
  };

  const handleAnswerQuestion = async (questionId: string) => {
    if (!answerText.trim() || answerText.length < 5) return;
    setAnsweringId(questionId);
    const res = await api.answerProductQuestion?.(questionId, answerText.trim());
    setAnsweringId(null);
    setAnswerText("");
    if (res?.success) loadQuestions();
  };

  const handleApprove = async (id: string) => {
    setUpdatingId(id);
    await api.updateReviewStatus?.(id, "approved");
    setUpdatingId(null);
    loadReviews();
  };

  const handleReject = async (id: string) => {
    setUpdatingId(id);
    await api.updateReviewStatus?.(id, "rejected");
    setUpdatingId(null);
    loadReviews();
  };

  const handleRespond = async (id: string) => {
    if (!responseText.trim()) return;
    setRespondingId(id);
    await api.respondToReview?.(id, responseText.trim());
    setRespondingId(null);
    setResponseText("");
    loadReviews();
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={16}
          className={cn(s <= rating ? "text-amber-500 fill-amber-500" : "text-gray-200")}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Reviews</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView("list")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All Reviews
          </button>
          <button
            onClick={() => setView("analytics")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              view === "analytics"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Analytics
          </button>
          <button
            onClick={() => setView("requests")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              view === "requests"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Review Requests
          </button>
          <button
            onClick={() => setView("qa")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition",
              view === "qa"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Q&A
          </button>
        </div>
      </div>

      {view === "requests" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Settings size={18} />
              Auto request reviews
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!autoConfig.review_auto_request_enabled}
                  onChange={(e) => setAutoConfig({ ...autoConfig, review_auto_request_enabled: e.target.checked })}
                  className="rounded"
                />
                Enable automatic review requests
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Delay (days after delivery):</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={autoConfig.review_auto_request_delay_days ?? 7}
                  onChange={(e) => setAutoConfig({ ...autoConfig, review_auto_request_delay_days: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 rounded border border-border bg-background text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Method:</span>
                <select
                  value={autoConfig.review_auto_request_method || "email"}
                  onChange={(e) => setAutoConfig({ ...autoConfig, review_auto_request_method: e.target.value })}
                  className="px-2 py-1 rounded border border-border bg-background text-sm"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <button
                onClick={handleSaveAutoConfig}
                disabled={savingAutoConfig}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                {savingAutoConfig ? <Loader2 size={16} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Send size={18} />
              Send review requests
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Select completed orders to send review requests.</p>
            {requestableOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No orders eligible for review requests.</p>
            ) : (
              <>
                <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                  {requestableOrders.map((o) => (
                    <label key={o.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(o.id)}
                        onChange={(e) => {
                          const next = new Set(selectedOrderIds);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          setSelectedOrderIds(next);
                        }}
                      />
                      <span className="text-sm">{o.item_name || o.id}</span>
                      <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleSendRequests}
                  disabled={selectedOrderIds.size === 0 || sendingRequests}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {sendingRequests ? <Loader2 size={16} className="animate-spin" /> : `Send to ${selectedOrderIds.size} order(s)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {view === "qa" && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <HelpCircle size={18} />
            Product questions
          </h3>
          {questionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No unanswered questions.
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{q.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {q.products?.name && <span>{q.products.name} • </span>}
                        {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {answeringId === q.id ? (
                      <div className="flex-1 max-w-md space-y-2">
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Write your answer (min 5 characters)..."
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAnswerQuestion(q.id)}
                            disabled={answerText.length < 5}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                          >
                            Post
                          </button>
                          <button
                            onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                            className="px-4 py-2 bg-muted rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAnsweringId(q.id)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <MessageSquare size={16} />
                        Answer
                      </button>
                    )}
                  </div>
                  {q.answers?.length > 0 && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      {q.answers.map((a: any) => (
                        <p key={a.id} className="text-sm">{a.answer}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "analytics" && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : analytics?.summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-2xl font-bold">{analytics.summary.total_reviews}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                  <p className="text-2xl font-bold flex items-center gap-1">
                    {analytics.summary.average_rating}
                    <Star size={20} className="fill-amber-500 text-amber-500" />
                  </p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                  <p className="text-2xl font-bold">{analytics.summary.response_rate}%</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">With Photos</p>
                  <p className="text-2xl font-bold">{analytics.summary.with_photos}</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Rating Distribution</h3>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-3">
                      <span className="w-8 text-sm">{star}★</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              analytics.summary.total_reviews > 0
                                ? ((analytics.summary.rating_distribution?.[star] ?? 0) /
                                    analytics.summary.total_reviews) *
                                    100
                                : 0
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-10 text-right">
                        {analytics.summary.rating_distribution?.[star] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No analytics data yet.
            </div>
          )}
        </div>
      )}

      {view === "list" && (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="all">All Reviews</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={filters.rating}
              onChange={(e) => setFilters({ ...filters, rating: e.target.value, page: 1 })}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">All Ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="recent">Most Recent</option>
              <option value="rating_high">Highest Rating</option>
              <option value="rating_low">Lowest Rating</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              No reviews yet. Reviews will appear here when customers leave feedback.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "bg-card border rounded-xl p-6",
                    r.status === "pending" && "border-l-4 border-l-amber-500",
                    r.status === "approved" && "border-l-4 border-l-green-500",
                    r.status === "rejected" && "border-l-4 border-l-red-500"
                  )}
                >
                  <div className="flex flex-wrap justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground">
                        {(r.customer_name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{r.customer_name || "Anonymous"}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                          {r.is_verified_purchase && (
                            <span className="ml-2 text-xs text-primary">✓ Verified</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        r.status === "pending" && "bg-amber-100 text-amber-800",
                        r.status === "approved" && "bg-green-100 text-green-800",
                        r.status === "rejected" && "bg-red-100 text-red-800"
                      )}
                    >
                      {r.status}
                    </span>
                  </div>

                  {r.products && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-lg">
                      {Array.isArray(r.products?.images) && r.products.images[0] ? (
                        <img
                          src={r.products.images[0]}
                          alt=""
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : null}
                      <span className="text-sm font-medium">{r.products?.name}</span>
                    </div>
                  )}

                  <div className="mb-2">{renderStars(r.rating)}</div>
                  {r.title && <h3 className="font-semibold mb-1">{r.title}</h3>}
                  <p className="text-muted-foreground">{r.content}</p>

                  {r.images && Array.isArray(r.images) && r.images.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {r.images.map((img, i) => (
                        <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded" />
                      ))}
                    </div>
                  )}

                  {r.seller_response ? (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Your response</p>
                      <p>{r.seller_response}</p>
                      {r.seller_responded_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(r.seller_responded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    respondingId === r.id ? (
                      <div className="mt-4 space-y-2">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Write your response..."
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespond(r.id)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                          >
                            Post Response
                          </button>
                          <button
                            onClick={() => {
                              setRespondingId(null);
                              setResponseText("");
                            }}
                            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRespondingId(r.id)}
                        className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <MessageSquare size={16} />
                        Respond
                      </button>
                    )
                  )}

                  {r.status === "pending" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={updatingId === r.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {updatingId === r.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={updatingId === r.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {updatingId === r.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <XCircle size={16} />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page <= 1}
                className="px-4 py-2 rounded-lg border border-border disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm">
                Page {filters.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= pagination.pages}
                className="px-4 py-2 rounded-lg border border-border disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
