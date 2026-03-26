-- =====================================================
-- FINANCIAL TABLES - Seller expenses, tax reports, etc.
-- Adapted for PayLoom: seller_id = auth.users.id, order_id = transactions.id (TEXT)
-- =====================================================

-- Seller Expenses (manual entry)
CREATE TABLE IF NOT EXISTS public.seller_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    vendor_name VARCHAR(255),

    receipt_url VARCHAR(500),
    receipt_filename VARCHAR(255),

    expense_date DATE NOT NULL,
    is_tax_deductible BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'active',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_expenses_seller ON public.seller_expenses(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_expenses_category ON public.seller_expenses(category);
CREATE INDEX IF NOT EXISTS idx_seller_expenses_date ON public.seller_expenses(expense_date DESC);
ALTER TABLE public.seller_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their expenses"
ON public.seller_expenses FOR ALL
USING (seller_id = auth.uid());

-- Recurring Expenses
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    vendor_name VARCHAR(255),

    frequency VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    next_occurrence DATE NOT NULL,
    auto_create BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_seller ON public.recurring_expenses(seller_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next ON public.recurring_expenses(next_occurrence);
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their recurring expenses"
ON public.recurring_expenses FOR ALL
USING (seller_id = auth.uid());

-- Tax Reports
CREATE TABLE IF NOT EXISTS public.tax_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    report_type VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER,

    total_sales NUMERIC(12,2) DEFAULT 0,
    total_refunds NUMERIC(12,2) DEFAULT 0,
    total_expenses NUMERIC(12,2) DEFAULT 0,
    taxable_income NUMERIC(12,2) DEFAULT 0,
    sales_tax_collected NUMERIC(12,2) DEFAULT 0,

    status VARCHAR(50) DEFAULT 'draft',
    report_pdf_url VARCHAR(500),
    generated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(seller_id, report_type, year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_tax_reports_seller ON public.tax_reports(seller_id);
CREATE INDEX IF NOT EXISTS idx_tax_reports_period ON public.tax_reports(year DESC, quarter DESC NULLS LAST);
ALTER TABLE public.tax_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their tax reports"
ON public.tax_reports FOR ALL
USING (seller_id = auth.uid());

-- Accounting Integrations (QuickBooks, Xero, etc.)
CREATE TABLE IF NOT EXISTS public.accounting_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    company_id VARCHAR(255),
    company_name VARCHAR(255),

    auto_sync BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    sync_frequency VARCHAR(50) DEFAULT 'daily',

    status VARCHAR(50) DEFAULT 'active',
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(seller_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_accounting_integrations_seller ON public.accounting_integrations(seller_id);
ALTER TABLE public.accounting_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their accounting integrations"
ON public.accounting_integrations FOR ALL
USING (seller_id = auth.uid());

-- Financial Snapshots (daily aggregates for analytics)
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
    id SERIAL PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,

    daily_revenue NUMERIC(12,2) DEFAULT 0,
    daily_refunds NUMERIC(12,2) DEFAULT 0,
    daily_net_revenue NUMERIC(12,2) DEFAULT 0,
    daily_commission NUMERIC(12,2) DEFAULT 0,
    daily_payment_fees NUMERIC(12,2) DEFAULT 0,
    daily_expenses NUMERIC(12,2) DEFAULT 0,
    daily_gross_profit NUMERIC(12,2) DEFAULT 0,
    daily_net_profit NUMERIC(12,2) DEFAULT 0,
    daily_orders INTEGER DEFAULT 0,
    daily_refund_count INTEGER DEFAULT 0,
    mtd_revenue NUMERIC(12,2) DEFAULT 0,
    ytd_revenue NUMERIC(12,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(seller_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_seller_date ON public.financial_snapshots(seller_id, snapshot_date DESC);
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view their snapshots"
ON public.financial_snapshots FOR ALL
USING (seller_id = auth.uid());

-- Triggers
CREATE TRIGGER update_seller_expenses_updated_at
  BEFORE UPDATE ON public.seller_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tax_reports_updated_at
  BEFORE UPDATE ON public.tax_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_accounting_integrations_updated_at
  BEFORE UPDATE ON public.accounting_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
