import { useState, useEffect } from "react";
import { HelpCircle, Send, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface Question {
  id: string;
  question: string;
  created_at: string;
  answers?: { id: string; answer: string; answerer_type?: string; created_at: string }[];
}

interface ProductQAProps {
  storeSlug: string;
  productId: string;
}

export function ProductQA({ storeSlug, productId }: ProductQAProps) {
  const { user } = useSupabaseAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionText, setQuestionText] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!storeSlug || !productId) return;
    setLoading(true);
    const res = await api.getProductQuestions?.(storeSlug, productId);
    setLoading(false);
    if (res?.success && Array.isArray(res.data)) setQuestions(res.data);
  };

  useEffect(() => {
    load();
  }, [storeSlug, productId]);

  const handleAsk = async () => {
    const q = questionText.trim();
    if (!q || q.length < 5) {
      setError("Please enter at least 5 characters.");
      return;
    }
    if (!user) {
      setError("Sign in to ask a question.");
      return;
    }
    setAsking(true);
    setError("");
    const res = await api.askProductQuestion?.(storeSlug, productId, q);
    setAsking(false);
    if (res?.success) {
      setQuestionText("");
      load();
    } else {
      setError(res?.error || "Failed to submit question");
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <HelpCircle size={22} />
        Customer questions
      </h3>

      {user && (
        <div className="mb-6 p-4 bg-muted/30 rounded-xl border border-border">
          <label className="text-sm font-medium block mb-2">Ask a question</label>
          <div className="flex gap-2">
            <input
              value={questionText}
              onChange={(e) => { setQuestionText(e.target.value); setError(""); }}
              placeholder="What would you like to know about this product?"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            <button
              onClick={handleAsk}
              disabled={asking || questionText.trim().length < 5}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Ask
            </button>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>
      )}

      {!user && (
        <p className="text-sm text-muted-foreground mb-6">Sign in to ask a question about this product.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No questions yet. Be the first to ask!</p>
      ) : (
        <div className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="pb-6 border-b border-border last:border-0">
              <p className="font-medium text-foreground">{q.question}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(q.created_at).toLocaleDateString()}
              </p>
              {q.answers && q.answers.length > 0 && (
                <div className="mt-3 pl-4 border-l-4 border-primary space-y-2">
                  {q.answers.map((a) => (
                    <div key={a.id}>
                      <p className="text-sm text-muted-foreground">{a.answer}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.answerer_type === "seller" ? "Seller" : "Customer"} • {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
