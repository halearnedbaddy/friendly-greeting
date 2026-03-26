import { useState, useEffect } from "react";
import { Star, Loader2, ThumbsUp, ThumbsDown, Flag } from "lucide-react";
import { api } from "@/services/api";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cn } from "@/lib/utils";

interface ReviewSummary {
  total_reviews: number;
  average_rating: string;
  rating_distribution: Record<
    number,
    { count: number; percentage: string }
  >;
}

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  customer_name?: string;
  created_at: string;
  is_verified_purchase?: boolean;
  seller_response?: string;
  images?: string[];
  helpful_count?: number;
  not_helpful_count?: number;
}

interface ReviewWidgetProps {
  storeSlug: string;
  productId: string;
}

interface ReviewableOrder {
  id: string;
  created_at: string;
  item_name?: string;
}

export function ReviewWidget({ storeSlug, productId }: ReviewWidgetProps) {
  const { user } = useSupabaseAuth();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ rating: "", sort: "recent" as string, page: 1 });
  const [_loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewableOrders, setReviewableOrders] = useState<ReviewableOrder[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ order_id: "", rating: 5, title: "", content: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [helpfulLoading, setHelpfulLoading] = useState<string | null>(null);
  const [reportReviewId, setReportReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!storeSlug || !productId) return;
      setLoading(true);
      const res = await api.getProductReviewSummary?.(storeSlug, productId);
      setLoading(false);
      if (res?.success && res.data) {
        setSummary(res.data as ReviewSummary);
      }
    }
    load();
  }, [storeSlug, productId]);

  useEffect(() => {
    async function load() {
      if (!storeSlug || !productId) return;
      setReviewsLoading(true);
      const res = await api.getProductReviews?.(storeSlug, productId, {
        rating: filters.rating || undefined,
        sort: filters.sort,
        page: filters.page,
        limit: 10,
      });
      setReviewsLoading(false);
      if (res?.success && res.data) {
        const d = res.data as { reviews?: Review[]; pagination?: typeof pagination };
        setReviews(d.reviews || []);
        setPagination(d.pagination || pagination);
      }
    }
    load();
  }, [storeSlug, productId, filters.rating, filters.sort, filters.page]);

  useEffect(() => {
    if (!user || !storeSlug || !productId || !showReviewForm) return;
    async function load() {
      const res = await api.getReviewableOrders?.(storeSlug, productId);
      if (res?.success && Array.isArray(res.data)) setReviewableOrders(res.data);
    }
    load();
  }, [user, storeSlug, productId, showReviewForm]);

  const handleSubmitReview = async () => {
    if (!reviewForm.order_id || !reviewForm.content || reviewForm.content.length < 10) {
      setSubmitError("Select an order and write at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const res = await api.submitProductReview?.(storeSlug, productId, {
      order_id: reviewForm.order_id,
      rating: reviewForm.rating,
      title: reviewForm.title || undefined,
      content: reviewForm.content,
    });
    setSubmitting(false);
    if (res?.success) {
      setShowReviewForm(false);
      setReviewForm({ order_id: "", rating: 5, title: "", content: "" });
      setLoading(true);
      const sRes = await api.getProductReviewSummary?.(storeSlug, productId);
      if (sRes?.success && sRes.data) setSummary(sRes.data as ReviewSummary);
      setLoading(false);
      const rRes = await api.getProductReviews?.(storeSlug, productId, {
        rating: filters.rating || undefined,
        sort: filters.sort,
        page: 1,
        limit: 10,
      });
      if (rRes?.success && rRes.data) {
        const d = rRes.data as { reviews?: Review[]; pagination?: typeof pagination };
        setReviews(d.reviews || []);
        setPagination(d.pagination || pagination);
      }
      const ordRes = await api.getReviewableOrders?.(storeSlug, productId);
      if (ordRes?.success && Array.isArray(ordRes.data)) setReviewableOrders(ordRes.data);
    } else {
      setSubmitError(res?.error || "Failed to submit review");
    }
  };

  const handleMarkHelpful = async (reviewId: string, isHelpful: boolean) => {
    setHelpfulLoading(reviewId);
    const res = await api.markReviewHelpful?.(reviewId, isHelpful);
    setHelpfulLoading(null);
    if (res?.success) {
      setReviews((prev) =>
        prev.map((r) => {
          if (r.id !== reviewId) return r;
          const h = (r.helpful_count || 0) + (isHelpful ? 1 : 0);
          const n = (r.not_helpful_count || 0) + (isHelpful ? 0 : 1);
          return { ...r, helpful_count: h, not_helpful_count: n };
        })
      );
    }
  };

  const handleReport = async () => {
    if (!reportReviewId) return;
    setReporting(true);
    const res = await api.reportReview?.(reportReviewId, reportReason);
    setReporting(false);
    if (res?.success) {
      setReportReviewId(null);
    } else {
      alert(res?.error || "Failed to report");
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={cn(s <= rating ? "text-amber-500 fill-amber-500" : "text-gray-200")}
        />
      ))}
    </div>
  );

  const displaySummary = summary ?? {
    total_reviews: 0,
    average_rating: "0",
    rating_distribution: {} as Record<number, { count: number; percentage: string }>,
  };

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-bold">Customer Reviews</h3>
        {user && !showReviewForm && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Write a Review
          </button>
        )}
      </div>

      {showReviewForm && user && (
        <div className="mb-8 p-6 bg-muted/30 rounded-xl border border-border space-y-4">
          <h4 className="font-semibold">Write your review</h4>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Order</label>
            <select
              value={reviewForm.order_id}
              onChange={(e) => setReviewForm({ ...reviewForm, order_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">Select order to review</option>
              {reviewableOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.item_name || o.id} – {new Date(o.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                  className="p-1"
                >
                  <Star
                    size={24}
                    className={cn(s <= reviewForm.rating ? "text-amber-500 fill-amber-500" : "text-gray-300")}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Title (optional)</label>
            <input
              value={reviewForm.title}
              onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
              placeholder="Summarize your experience"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Review (min 10 characters)</label>
            <textarea
              value={reviewForm.content}
              onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
              placeholder="Share your experience with this product..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmitReview}
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin inline" /> : "Submit Review"}
            </button>
            <button
              onClick={() => {
                setShowReviewForm(false);
                setSubmitError("");
              }}
              className="px-4 py-2 bg-muted rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[200px_1fr] gap-8 mb-8">
        <div className="text-center p-4 bg-muted/30 rounded-xl">
          <span className="text-4xl font-bold block">{displaySummary.average_rating}</span>
          <div className="flex justify-center gap-0.5 my-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={18}
                className={cn(
                  s <= parseFloat(displaySummary.average_rating)
                    ? "text-amber-500 fill-amber-500"
                    : "text-gray-200"
                )}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Based on {displaySummary.total_reviews} review{displaySummary.total_reviews !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const d = displaySummary.rating_distribution?.[star];
            const pct = d ? parseFloat(d.percentage) : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <span className="w-8 text-sm">{star}★</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8">{d?.count ?? 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilters({ ...filters, rating: "", page: 1 })}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition",
            !filters.rating ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          )}
        >
          All
        </button>
        {[5, 4, 3, 2, 1].map((star) => (
          <button
            key={star}
            onClick={() => setFilters({ ...filters, rating: String(star), page: 1 })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              filters.rating === String(star) ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {star}★
          </button>
        ))}
        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm ml-auto"
        >
          <option value="recent">Most Recent</option>
          <option value="helpful">Most Helpful</option>
          <option value="rating_high">Highest Rating</option>
          <option value="rating_low">Lowest Rating</option>
        </select>
      </div>

      {reviewsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((r) => (
            <div key={r.id} className="pb-6 border-b border-border last:border-0">
              <div className="flex items-center gap-2 mb-1">
                {renderStars(r.rating)}
                <span className="text-sm text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                {r.is_verified_purchase && (
                  <span className="text-xs text-primary font-medium">✓ Verified</span>
                )}
              </div>
              {r.title && <h4 className="font-semibold mb-1">{r.title}</h4>}
              <p className="text-muted-foreground text-sm">{r.content}</p>
              {r.images && Array.isArray(r.images) && r.images.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {r.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <p className="text-xs text-muted-foreground">
                  {r.customer_name || "Anonymous"}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <button
                    onClick={() => handleMarkHelpful(r.id, true)}
                    disabled={!!helpfulLoading}
                    className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted transition"
                    title="Helpful"
                  >
                    <ThumbsUp size={12} />
                    {r.helpful_count ?? 0}
                  </button>
                  <button
                    onClick={() => handleMarkHelpful(r.id, false)}
                    disabled={!!helpfulLoading}
                    className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted transition"
                    title="Not helpful"
                  >
                    <ThumbsDown size={12} />
                    {r.not_helpful_count ?? 0}
                  </button>
                  <button
                    onClick={() => setReportReviewId(r.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted transition text-muted-foreground"
                    title="Report"
                  >
                    <Flag size={12} />
                    Report
                  </button>
                </div>
              </div>
              {r.seller_response && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Response from seller
                  </p>
                  <p className="text-sm">{r.seller_response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {displaySummary.total_reviews === 0 && !reviewsLoading && (
        <p className="text-muted-foreground text-sm py-6">No reviews yet. Be the first to share your experience!</p>
      )}

      {reportReviewId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full">
            <h4 className="font-semibold mb-2">Report this review</h4>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-4"
            >
              <option value="spam">Spam</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="fake">Fake review</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleReport}
                disabled={reporting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium"
              >
                {reporting ? <Loader2 size={16} className="animate-spin" /> : "Submit Report"}
              </button>
              <button
                onClick={() => setReportReviewId(null)}
                className="px-4 py-2 bg-muted rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page <= 1}
            className="px-4 py-2 rounded-lg border border-border disabled:opacity-50 text-sm"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">
            Page {filters.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= pagination.pages}
            className="px-4 py-2 rounded-lg border border-border disabled:opacity-50 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
