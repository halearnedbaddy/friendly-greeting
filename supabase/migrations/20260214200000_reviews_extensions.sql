-- Review Questions (Q&A on products)
CREATE TABLE IF NOT EXISTS public.review_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id),
    question TEXT NOT NULL,
    is_answered BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.review_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
    answerer_id UUID REFERENCES auth.users(id),
    answerer_type VARCHAR(50),
    answer TEXT NOT NULL,
    helpful_count INTEGER DEFAULT 0,
    is_official BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_product ON public.review_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.review_answers(question_id);
ALTER TABLE public.review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view questions and answers"
ON public.review_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated can ask questions"
ON public.review_questions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Sellers can manage questions for their products"
ON public.review_questions FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON p.store_id = s.id WHERE p.id = product_id AND s.seller_id = auth.uid())
);

CREATE POLICY "Public can view answers"
ON public.review_answers FOR SELECT USING (true);
CREATE POLICY "Sellers and customers can add answers"
ON public.review_answers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Review Analytics (aggregated - populated by job)
CREATE TABLE IF NOT EXISTS public.review_analytics (
    id SERIAL PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_reviews INTEGER DEFAULT 0,
    average_rating NUMERIC(3,2),
    five_star_count INTEGER DEFAULT 0,
    four_star_count INTEGER DEFAULT 0,
    three_star_count INTEGER DEFAULT 0,
    two_star_count INTEGER DEFAULT 0,
    one_star_count INTEGER DEFAULT 0,
    with_photos_count INTEGER DEFAULT 0,
    with_videos_count INTEGER DEFAULT 0,
    verified_purchase_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(seller_id, product_id, date)
);

CREATE INDEX IF NOT EXISTS idx_review_analytics_seller_date ON public.review_analytics(seller_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_review_analytics_product_date ON public.review_analytics(product_id, date DESC);
ALTER TABLE public.review_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view their analytics"
ON public.review_analytics FOR ALL
USING (seller_id = auth.uid());
