import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@/components/icons';

const pages: Record<string, { title: string; subtitle: string; content: React.ReactNode }> = {
  'about': {
    title: 'About Us',
    subtitle: 'The story behind PayLoom Instants',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <p>PayLoom Instants was born in Nairobi with a simple mission: <strong>make selling online as easy as sending a text message.</strong></p>
        <p>We saw thousands of talented entrepreneurs across Kenya selling on WhatsApp, Instagram, and Facebook — but struggling with payments. Customers didn't trust sending money first, and sellers couldn't afford fancy e-commerce platforms.</p>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Our Mission</h3>
        <p>To democratize digital commerce across Africa by providing instant, secure, and affordable payment infrastructure that anyone can use — no technical skills required.</p>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Our Team</h3>
        <p>We're a passionate team of engineers, designers, and business minds based in Nairobi, united by the belief that African entrepreneurs deserve world-class tools. Our team brings experience from leading fintech companies and a deep understanding of the African market.</p>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Our Values</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Simplicity First:</strong> If your grandmother can't use it, we redesign it.</li>
          <li><strong>Trust & Security:</strong> Every shilling is protected. Every transaction is transparent.</li>
          <li><strong>African Innovation:</strong> Built in Africa, for Africa, by Africans.</li>
          <li><strong>Seller Success:</strong> When our sellers grow, we grow.</li>
        </ul>
        <div className="bg-[hsl(270,50%,30%)]/10 rounded-xl p-6 mt-6">
          <p className="font-semibold text-[hsl(270,70%,20%)]">📍 Headquartered in Nairobi, Kenya</p>
          <p className="mt-1">Serving 10,000+ sellers across East Africa</p>
        </div>
      </div>
    ),
  },
  'careers': {
    title: 'Careers',
    subtitle: 'Join us in building the future of African commerce',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <p>We're always looking for talented, passionate people who want to make a real impact on millions of entrepreneurs across Africa.</p>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Why Work at PayLoom?</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Impact:</strong> Your work directly empowers thousands of small businesses.</li>
          <li><strong>Growth:</strong> Fast-moving startup where you'll learn and grow rapidly.</li>
          <li><strong>Culture:</strong> Collaborative, inclusive, and fun environment.</li>
          <li><strong>Flexibility:</strong> Remote-friendly with offices in Nairobi.</li>
        </ul>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Open Positions</h3>
        {[
          { role: 'Senior Backend Engineer', dept: 'Engineering', type: 'Full-time' },
          { role: 'Mobile Developer (React Native)', dept: 'Engineering', type: 'Full-time' },
          { role: 'Product Designer', dept: 'Design', type: 'Full-time' },
          { role: 'Customer Success Lead', dept: 'Operations', type: 'Full-time' },
          { role: 'Content Marketing Manager', dept: 'Marketing', type: 'Full-time / Remote' },
        ].map((job, i) => (
          <div key={i} className="border border-[hsl(var(--border))] rounded-xl p-4 flex justify-between items-center">
            <div>
              <h4 className="font-bold">{job.role}</h4>
              <p className="text-sm opacity-70">{job.dept} • {job.type}</p>
            </div>
            <span className="text-sm font-semibold text-[hsl(270,50%,30%)]">Apply →</span>
          </div>
        ))}
        <p className="pt-4">Don't see a role that fits? Send your CV to <strong>careers@payloom.co</strong> and tell us why you'd be a great addition.</p>
      </div>
    ),
  },
  'press': {
    title: 'Press',
    subtitle: 'PayLoom in the news',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <p>For press inquiries, media kits, and interview requests, contact <strong>press@payloom.co</strong>.</p>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Recent Coverage</h3>
        {[
          { outlet: 'TechCrunch Africa', title: 'PayLoom raises seed round to power African social commerce', date: 'Jan 2026' },
          { outlet: 'Business Daily', title: 'Kenyan fintech PayLoom processes KES 50M+ in first year', date: 'Dec 2025' },
          { outlet: 'Disrupt Africa', title: 'How PayLoom is turning Instagram sellers into e-commerce powerhouses', date: 'Nov 2025' },
        ].map((article, i) => (
          <div key={i} className="border-l-4 border-[hsl(270,50%,30%)] pl-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{article.outlet} • {article.date}</p>
            <p className="font-semibold mt-1">{article.title}</p>
          </div>
        ))}
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Brand Assets</h3>
        <p>Download our logo, brand guidelines, and product screenshots from our media kit.</p>
      </div>
    ),
  },
  'partners': {
    title: 'Partners',
    subtitle: 'Growing together across Africa',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <p>PayLoom partners with leading organizations across payments, logistics, and technology to deliver the best experience for our sellers and buyers.</p>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Payment Partners</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Safaricom M-Pesa:</strong> Instant mobile money payments and payouts.</li>
          <li><strong>Airtel Money:</strong> Alternative mobile money support.</li>
          <li><strong>IntaSend:</strong> Payment gateway infrastructure.</li>
        </ul>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Become a Partner</h3>
        <p>Interested in integrating with PayLoom or exploring partnership opportunities? Reach out at <strong>partners@payloom.co</strong>.</p>
      </div>
    ),
  },
  'contact': {
    title: 'Contact Us',
    subtitle: "We'd love to hear from you",
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { icon: '📧', label: 'Email', value: 'hello@payloom.co' },
            { icon: '📱', label: 'Phone', value: '+254 700 000 000' },
            { icon: '📍', label: 'Address', value: 'Westlands, Nairobi, Kenya' },
            { icon: '🕐', label: 'Hours', value: 'Mon–Fri, 8AM – 6PM EAT' },
          ].map((item, i) => (
            <div key={i} className="bg-[hsl(var(--muted))] rounded-xl p-5">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{item.label}</p>
              <p className="font-semibold mt-1">{item.value}</p>
            </div>
          ))}
        </div>
        <h3 className="text-xl font-bold text-[hsl(270,70%,20%)] pt-4">Quick Links</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>For <strong>seller support:</strong> support@payloom.co</li>
          <li>For <strong>partnerships:</strong> partners@payloom.co</li>
          <li>For <strong>press:</strong> press@payloom.co</li>
          <li>For <strong>security issues:</strong> security@payloom.co</li>
        </ul>
      </div>
    ),
  },
  'pricing': {
    title: 'Pricing',
    subtitle: 'Simple, transparent pricing. No hidden fees.',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="border-2 border-[hsl(var(--border))] rounded-2xl p-6">
            <h3 className="text-lg font-bold">Free Plan</h3>
            <p className="text-3xl font-black text-[hsl(270,70%,20%)] mt-2">KES 0<span className="text-sm font-normal opacity-60">/month</span></p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✅ Unlimited payment links</li>
              <li>✅ Up to 20 products</li>
              <li>✅ Basic analytics</li>
              <li>✅ M-Pesa payouts</li>
              <li>✅ 3.5% transaction fee</li>
            </ul>
          </div>
          <div className="border-2 border-[hsl(270,50%,30%)] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-[hsl(270,50%,30%)] text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
            <h3 className="text-lg font-bold">Pro Plan</h3>
            <p className="text-3xl font-black text-[hsl(270,70%,20%)] mt-2">KES 1,500<span className="text-sm font-normal opacity-60">/month</span></p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✅ Everything in Free</li>
              <li>✅ Unlimited products</li>
              <li>✅ Advanced analytics</li>
              <li>✅ Custom store domain</li>
              <li>✅ 2% transaction fee</li>
              <li>✅ Priority support</li>
            </ul>
          </div>
        </div>
        <p className="text-center opacity-70 pt-4">All plans include instant M-Pesa payouts, secure checkout, and 24/7 support.</p>
      </div>
    ),
  },
  'features': {
    title: 'Features',
    subtitle: 'Everything you need to sell online',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        {[
          { icon: '⚡', title: 'Instant Payment Links', desc: 'Create and share payment links in seconds. Customers pay via M-Pesa with one tap.' },
          { icon: '🏪', title: 'Online Storefront', desc: 'Build a beautiful product catalog with images, categories, and seamless checkout.' },
          { icon: '📊', title: 'Real-Time Analytics', desc: 'Track sales, revenue, and customer behavior with intuitive dashboards.' },
          { icon: '🔒', title: 'Secure Payments', desc: 'Bank-grade encryption and fraud protection for every transaction.' },
          { icon: '📱', title: 'Mobile-First', desc: 'Optimized for mobile devices — where your customers are.' },
          { icon: '💬', title: 'Social Commerce', desc: 'Share on WhatsApp, Instagram, Facebook, and SMS with one click.' },
        ].map((f, i) => (
          <div key={i} className="flex gap-4 items-start">
            <span className="text-3xl">{f.icon}</span>
            <div>
              <h3 className="font-bold text-lg">{f.title}</h3>
              <p className="opacity-80">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  'help': {
    title: 'Help Center',
    subtitle: 'Find answers to common questions',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        {[
          { q: 'How do I create a payment link?', a: 'Sign up, go to your dashboard, click "Create Link", set the amount and description, and share the generated link with your customer.' },
          { q: 'How fast are M-Pesa payouts?', a: 'Payouts are instant. Once a customer pays, the money is sent to your M-Pesa within seconds.' },
          { q: 'What payment methods do customers have?', a: 'Customers can pay via M-Pesa, Airtel Money, Visa, and Mastercard.' },
          { q: 'Is there a transaction limit?', a: 'Individual transactions can be up to KES 150,000. For higher limits, contact our team.' },
          { q: 'How do disputes work?', a: 'Either party can file a dispute within 7 days. Our team reviews evidence and makes a binding decision within 48 hours.' },
        ].map((faq, i) => (
          <details key={i} className="border border-[hsl(var(--border))] rounded-xl overflow-hidden group">
            <summary className="cursor-pointer p-4 font-semibold hover:bg-[hsl(var(--muted))] transition-colors">{faq.q}</summary>
            <p className="px-4 pb-4 opacity-80">{faq.a}</p>
          </details>
        ))}
        <p className="pt-4">Still need help? Email us at <strong>support@payloom.co</strong> or chat with us in your dashboard.</p>
      </div>
    ),
  },
  'tutorials': {
    title: 'Tutorials',
    subtitle: 'Learn how to get the most out of PayLoom',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        {[
          { title: 'Getting Started: Your First Payment Link', time: '3 min read', desc: 'A step-by-step guide to creating and sharing your first payment link.' },
          { title: 'Setting Up Your Online Store', time: '5 min read', desc: 'Add products, set prices, customize your storefront, and start receiving orders.' },
          { title: 'Maximizing Sales on Social Media', time: '4 min read', desc: 'Tips for sharing payment links on WhatsApp, Instagram, and Facebook.' },
          { title: 'Understanding Your Analytics Dashboard', time: '3 min read', desc: 'How to read your sales data and make smarter business decisions.' },
        ].map((t, i) => (
          <div key={i} className="border border-[hsl(var(--border))] rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(270,50%,30%)]">{t.time}</p>
            <h3 className="font-bold text-lg mt-1">{t.title}</h3>
            <p className="opacity-70 mt-1">{t.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  'blog': {
    title: 'Blog',
    subtitle: 'Insights, tips, and stories from the PayLoom team',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        {[
          { title: 'The Rise of Social Commerce in Kenya', date: 'Feb 15, 2026', excerpt: 'How Instagram and WhatsApp are transforming how Kenyans buy and sell products online.' },
          { title: '5 Tips to Boost Your Online Sales', date: 'Feb 8, 2026', excerpt: 'Simple strategies that our top sellers use to double their revenue.' },
          { title: 'Why Payment Links Beat Traditional E-Commerce', date: 'Jan 28, 2026', excerpt: 'For many African entrepreneurs, payment links are the fastest path to digital sales.' },
        ].map((post, i) => (
          <div key={i} className="border-b border-[hsl(var(--border))] pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-50">{post.date}</p>
            <h3 className="font-bold text-xl mt-1">{post.title}</h3>
            <p className="opacity-70 mt-2">{post.excerpt}</p>
            <span className="text-sm font-semibold text-[hsl(270,50%,30%)] mt-2 inline-block">Read more →</span>
          </div>
        ))}
      </div>
    ),
  },
  'community': {
    title: 'Community',
    subtitle: 'Connect with fellow sellers',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        <p>Join thousands of sellers sharing tips, advice, and success stories in the PayLoom community.</p>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { icon: '💬', title: 'WhatsApp Group', desc: 'Daily tips, Q&A, and networking with fellow sellers.' },
            { icon: '📸', title: 'Instagram Community', desc: 'Follow @payloom for product showcases and seller spotlights.' },
            { icon: '🐦', title: 'Twitter/X', desc: 'Latest updates, features, and industry insights.' },
            { icon: '📺', title: 'YouTube', desc: 'Video tutorials and seller success stories.' },
          ].map((c, i) => (
            <div key={i} className="bg-[hsl(var(--muted))] rounded-xl p-5 text-center">
              <span className="text-3xl">{c.icon}</span>
              <h3 className="font-bold mt-2">{c.title}</h3>
              <p className="text-sm opacity-70 mt-1">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  'mobile-app': {
    title: 'Mobile App',
    subtitle: 'PayLoom in your pocket',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed text-center">
        <p className="text-5xl">📱</p>
        <h3 className="text-2xl font-bold text-[hsl(270,70%,20%)]">Coming Soon!</h3>
        <p>We're building a native mobile app for iOS and Android so you can manage your sales, track orders, and chat with customers on the go.</p>
        <p className="opacity-70">In the meantime, PayLoom works perfectly in your mobile browser — just bookmark it!</p>
        <div className="bg-[hsl(270,50%,30%)]/10 rounded-xl p-6 mt-4 inline-block">
          <p className="font-semibold">Get notified when it launches →</p>
          <p className="text-sm opacity-70 mt-1">Email hello@payloom.co with "App Waitlist"</p>
        </div>
      </div>
    ),
  },
  'example-stores': {
    title: 'Example Stores',
    subtitle: 'See what sellers are building with PayLoom',
    content: (
      <div className="space-y-6 text-[15px] leading-relaxed">
        {[
          { name: "Sarah's Jewelry", category: 'Fashion & Accessories', products: 45, desc: 'Handmade jewelry from Nairobi sold across East Africa.' },
          { name: "KisumuFresh", category: 'Food & Agriculture', products: 28, desc: 'Fresh produce delivered from Kisumu farms to your doorstep.' },
          { name: "TechGadgets KE", category: 'Electronics', products: 120, desc: 'Affordable tech accessories with next-day delivery in Nairobi.' },
        ].map((store, i) => (
          <div key={i} className="border border-[hsl(var(--border))] rounded-xl p-5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">{store.name}</h3>
              <p className="text-sm opacity-70">{store.category} • {store.products} products</p>
              <p className="text-sm mt-1">{store.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
};

// Map footer link text to slug
const linkTextToSlug: Record<string, string> = {
  'payment-links': 'features',
  'online-stores': 'features',
  'payment links': 'features',
  'online stores': 'features',
  'help-center': 'help',
  'example-stores': 'example-stores',
  'mobile-app': 'mobile-app',
};

export function InfoPage() {
  const { slug } = useParams<{ slug: string }>();
  const resolved = slug ? (linkTextToSlug[slug] || slug) : 'about';
  const page = pages[resolved];

  if (!page) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-black mb-4">Page Not Found</h1>
          <p className="opacity-70 mb-8">The page you're looking for doesn't exist.</p>
          <Link to="/" className="inline-flex items-center gap-2 text-[hsl(270,50%,30%)] font-semibold hover:underline">
            <ArrowLeftIcon size={18} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] py-8 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 opacity-60 hover:opacity-100 mb-8 font-semibold transition-opacity">
          <ArrowLeftIcon size={18} /> Back to Home
        </Link>

        <div className="bg-[hsl(var(--card))] rounded-2xl shadow-xl p-6 sm:p-12">
          <h1 className="text-3xl sm:text-4xl font-black text-[hsl(270,70%,20%)] mb-2">{page.title}</h1>
          <p className="opacity-60 mb-10">{page.subtitle}</p>
          <div className="text-[hsl(var(--foreground))]">{page.content}</div>
        </div>
      </div>
    </div>
  );
}
