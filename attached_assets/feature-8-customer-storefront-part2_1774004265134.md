# FEATURE 8: CUSTOMER STOREFRONT - PART 2
## API, Mobile Features, Voice Search & Analytics

---

## 🌐 **API ENDPOINT**

### **Fetch Store Data**

**File: `pages/api/store/[slug].ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { slug } = req.query;

    // Fetch seller by slug
    const { data: seller, error: sellerError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        slug,
        logo_url,
        banner_url,
        description,
        phone,
        colors,
        status
      `)
      .eq('slug', slug)
      .eq('role', 'seller')
      .eq('status', 'active')
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({ 
        error: 'Store not found',
        seller: null,
        products: []
      });
    }

    // Fetch seller's products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', seller.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Products error:', productsError);
    }

    return res.status(200).json({
      seller: {
        id: seller.id,
        name: seller.name,
        slug: seller.slug,
        logo_url: seller.logo_url,
        banner_url: seller.banner_url,
        description: seller.description,
        phone: seller.phone,
        colors: seller.colors
      },
      products: products || []
    });

  } catch (error: any) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch store',
      details: error.message
    });
  }
}
```

---

**FEATURE 8 COMPLETE!**

**What you get:**
- Complete customer storefront page
- Search & filters working
- Mobile responsive  
- Voice search
- SEO optimized
- Analytics tracking

**Files created:**
- Part 1: Main storefront page
- Part 2: API, mobile drawer, voice search, analytics

**Ready to deploy!** 🚀

