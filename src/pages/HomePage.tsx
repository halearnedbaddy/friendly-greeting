import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

export function HomePage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('pls-visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.pls-animate').forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="pls-wrap">
      {/* NAV */}
      <nav className={`pls-nav${navScrolled ? ' pls-nav-scrolled' : ''}`}>
        <div className="pls-container pls-nav-content">
          <Link to="/" className="pls-logo">
            <div className="pls-logo-icon">P</div>
            <span>PayLoom</span>
          </Link>
          <div className="pls-nav-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>FAQ</a>
          </div>
          <div className="pls-nav-actions">
            <Link to="/login" className="pls-btn pls-btn-secondary">Sign In</Link>
            <Link to="/signup" className="pls-btn pls-btn-primary">Get Started Free</Link>
          </div>
          <button className="pls-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="pls-mobile-menu">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('pricing'); }}>Pricing</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>FAQ</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
            <Link to="/signup" className="pls-btn pls-btn-primary" onClick={() => setMobileMenuOpen(false)}>Get Started Free</Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pls-hero">
        <div className="pls-container pls-hero-content">
          <div className="pls-hero-text">
            <div className="pls-hero-badge">
              <span className="pls-badge-dot" />
              Powered by M-Pesa • Trusted by 10,000+ Sellers
            </div>
            <h1>
              Sell Anything Online.<br />
              <span className="pls-highlight">Get Paid to YOUR M-Pesa.</span><br />
              Instantly.
            </h1>
            <p>
              Create beautiful payment links and stores in 60 seconds. Customers pay
              directly to your M-Pesa. We verify payments automatically and track delivery.
              No commissions. No delays.
            </p>
            <div className="pls-hero-actions">
              <Link to="/signup" className="pls-btn pls-btn-primary pls-btn-large pls-btn-icon">
                <span>Create Free Payment Link →</span>
              </Link>
              <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }} className="pls-btn pls-btn-secondary pls-btn-large">
                Watch 60-Second Demo
              </a>
            </div>
            <div className="pls-trust-bar">
              <div className="pls-trust-item">
                <svg fill="currentColor" viewBox="0 0 20 20" width="20" height="20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                10,000+ Sellers
              </div>
              <div className="pls-trust-item">
                <svg fill="currentColor" viewBox="0 0 20 20" width="20" height="20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                KES 50M+ Processed
              </div>
              <div className="pls-trust-item">
                <svg fill="currentColor" viewBox="0 0 20 20" width="20" height="20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                Powered by M-Pesa
              </div>
            </div>
          </div>

          {/* Phone Mockup */}
          <div className="pls-hero-visual">
            <div className="pls-phone-mockup">
              <div className="pls-phone-frame">
                <div className="pls-phone-notch" />
                <div className="pls-phone-screen">
                  <div className="pls-screen-content">
                    <div className="pls-app-header">
                      <div className="pls-app-title">My Sales</div>
                      <div className="pls-app-badge">Active</div>
                    </div>
                    <div className="pls-payment-link-preview">
                      <div className="pls-link-header">
                        <div className="pls-link-icon">🔗</div>
                        <div className="pls-link-info">
                          <h4>Premium Headphones</h4>
                          <p>Payment Link</p>
                        </div>
                      </div>
                      <div className="pls-link-amount">KES 4,500</div>
                      <div className="pls-link-actions">
                        <button className="pls-mini-btn pls-mini-btn-primary">Share Link</button>
                        <button className="pls-mini-btn pls-mini-btn-secondary">Copy URL</button>
                      </div>
                    </div>
                    <div className="pls-store-preview">
                      <div className="pls-product-grid">
                        {[
                          { emoji: '👟', name: 'Sneakers', price: 'KES 3,200' },
                          { emoji: '👕', name: 'T-Shirt', price: 'KES 1,500' },
                          { emoji: '⌚', name: 'Watch', price: 'KES 5,800' },
                          { emoji: '🎒', name: 'Backpack', price: 'KES 2,900' },
                        ].map((p, i) => (
                          <div key={i} className="pls-product-card">
                            <div className="pls-product-image">{p.emoji}</div>
                            <div className="pls-product-name">{p.name}</div>
                            <div className="pls-product-price">{p.price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="pls-problem-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">The Problem</span>
            <h2>Tired of Manual Payment Tracking?</h2>
          </div>
          <div className="pls-problem-grid">
            {[
              { icon: '📱', text: 'Sending M-Pesa number via WhatsApp to every customer' },
              { icon: '⏰', text: 'Asking "Did you pay?" every 5 minutes and waiting' },
              { icon: '✅', text: 'Manually confirming each M-Pesa transaction' },
              { icon: '❓', text: 'Customers asking "Where\'s my order?" constantly' },
              { icon: '📉', text: 'Lost sales from unprofessional, messy setup' },
              { icon: '💸', text: 'No proper tracking of who paid and who didn\'t' },
            ].map((p, i) => (
              <div key={i} className="pls-problem-card pls-animate">
                <div className="pls-problem-icon">{p.icon}</div>
                <div className="pls-problem-text">{p.text}</div>
              </div>
            ))}
          </div>
          <div className="pls-solution-transition">
            <h3>There's a Better Way ↓</h3>
          </div>
          <div className="pls-solution-box pls-animate">
            <h4>PayLoom gives you professional payment links and stores.</h4>
            <p>
              You get paid directly. We verify automatically. Customers track delivery.
              No middleman. No commission. No headaches.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="pls-how-it-works-v2">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">Simple &amp; Fast</span>
            <h2>From Setup to Sale in 3 Minutes</h2>
            <p>No coding. No complexity. Just results.</p>
          </div>
          <div className="pls-steps-grid">
            {[
              { num: '1', title: 'Add Your M-Pesa', desc: 'Configure your payment methods: Personal M-Pesa number, Business Till, PayBill, or Bank account. Takes 30 seconds.', visual: 'M-Pesa: 254712345678\nTill: 987654\nBank: KCB 1234567890' },
              { num: '2', title: 'Create & Share', desc: 'Build a payment link or full store. Share on WhatsApp, Instagram, SMS, anywhere. Beautiful, professional, instant.', visual: 'payloom.co/yourname\nCopy → Share → Done!' },
              { num: '3', title: 'Get Paid Directly', desc: 'Customer pays to YOUR M-Pesa. Money hits your account instantly. We verify and track everything automatically.', visual: 'You received KES 4,500\nfrom 2547XXXXXXXX' },
            ].map((step, i) => (
              <div key={i} className="pls-step-card pls-animate">
                <div className="pls-step-number"><span>{step.num}</span></div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <div className="pls-step-visual">{step.visual}</div>
              </div>
            ))}
          </div>
          <div className="pls-money-flow pls-animate">
            <div className="pls-flow-diagram">
              <div className="pls-flow-box">CUSTOMER</div>
              <div className="pls-flow-arrow">→</div>
              <div className="pls-flow-box">Pays to YOUR M-Pesa</div>
              <div className="pls-flow-arrow">→</div>
              <div className="pls-flow-box">YOU GET MONEY</div>
            </div>
            <div className="pls-flow-note">
              <strong>💡 Important: We NEVER hold your money.</strong>
              Customers pay directly to you. We just verify the M-Pesa codes and track orders. That's it.
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="pls-features-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">Two Powerful Features</span>
            <h2>Everything You Need to Sell Online</h2>
            <p>Choose your selling style. Payment links for quick sales or full stores for your catalog.</p>
          </div>
          <div className="pls-feature-blocks">
            {/* Payment Links */}
            <div className="pls-feature-block pls-animate">
              <div className="pls-feature-visual">
                <div className="pls-feature-visual-box">
                  <div className="pls-feature-mockup">🔗</div>
                </div>
              </div>
              <div className="pls-feature-content">
                <h3>⚡ Instant Payment Links</h3>
                <p className="pls-feature-subtitle">Perfect for freelancers and quick sales</p>
                <p>Create a payment link in 10 seconds. No store needed.</p>
                <ul className="pls-feature-list">
                  <li>Set your price (or let customers choose)</li>
                  <li>Add product image and description</li>
                  <li>Share anywhere (WhatsApp, Instagram, SMS)</li>
                  <li>Customer pays to YOUR M-Pesa</li>
                  <li>Automatic payment verification</li>
                  <li>Send unlimited links</li>
                </ul>
                <div className="pls-feature-example">
                  <strong>Perfect for:</strong> Freelancers, consultants, tutors, service providers, one-time sales
                </div>
                <Link to="/signup" className="pls-btn pls-btn-primary">Try Payment Links Free →</Link>
              </div>
            </div>

            {/* Online Stores */}
            <div className="pls-feature-block pls-animate">
              <div className="pls-feature-content">
                <h3>🏪 Complete Online Store</h3>
                <p className="pls-feature-subtitle">Your full product catalog with checkout</p>
                <p>Build a professional store in 5 minutes. No coding.</p>
                <ul className="pls-feature-list">
                  <li>Unlimited products with images</li>
                  <li>Shopping cart and checkout</li>
                  <li>Custom store URL (yourname.payloom.co)</li>
                  <li>Organized categories</li>
                  <li>Inventory management</li>
                  <li>Customer order tracking</li>
                </ul>
                <div className="pls-feature-example">
                  <strong>Perfect for:</strong> Fashion, electronics, food, crafts, beauty products, any business with multiple items
                </div>
                <Link to="/signup" className="pls-btn pls-btn-primary">Build Your Store Free →</Link>
              </div>
              <div className="pls-feature-visual">
                <div className="pls-feature-visual-box">
                  <div className="pls-feature-mockup">🏪</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VERIFICATION */}
      <section className="pls-verification-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">The Magic</span>
            <h2>Automatic Payment Verification</h2>
            <p>No More "Did You Pay?" Messages</p>
          </div>
          <div className="pls-verification-visual pls-animate">
            <div className="pls-verification-flow">
              {[
                { num: '1', title: 'Customer pays to your M-Pesa', desc: 'They get M-Pesa code (e.g., QGH7XYZ123)' },
                { num: '2', title: 'Customer enters code on your payment link', desc: 'Simple form with transaction code and phone number' },
                { num: '3', title: "We check M-Pesa's system automatically", desc: 'Verify: Correct amount, correct recipient, real transaction' },
                { num: '4', title: '✓ Approved! Both get SMS confirmation', desc: 'All happens in 2 seconds. No manual checking needed.' },
              ].map((s, i) => (
                <div key={i} className="pls-verification-step">
                  <div className="pls-verification-step-number">{s.num}</div>
                  <div className="pls-verification-step-content">
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pls-comparison-table">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Before PayLoom</th>
                    <th className="pls-highlight-cell">With PayLoom</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Payment Confirmation', 'Wait & ask customer', 'Instant verification'],
                    ['Proof of Payment', 'Request screenshots', 'Auto-verified'],
                    ['Manual Checking', 'Check every transaction', 'M-Pesa API check'],
                    ['Time to Confirm', '5-30 minutes', '2 seconds'],
                  ].map(([feat, before, after], i) => (
                    <tr key={i}>
                      <td>{feat}</td>
                      <td>{before}</td>
                      <td className="pls-highlight-cell">{after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* TRACKING */}
      <section className="pls-tracking-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">Customer Experience</span>
            <h2>Give Customers Peace of Mind</h2>
            <p>Professional Order Tracking</p>
          </div>
          <div className="pls-tracking-demo pls-animate">
            <div className="pls-tracking-header">
              <h4>Track Your Order</h4>
              <p className="pls-order-id">#ORDER-78945</p>
            </div>
            <div className="pls-tracking-timeline">
              {[
                { status: 'done', title: '✓ Order Placed', time: 'Feb 23, 2:45 PM', desc: 'Your order was received' },
                { status: 'done', title: '✓ Payment Verified', time: 'Feb 23, 2:46 PM', desc: 'M-Pesa payment confirmed' },
                { status: 'current', title: '⏳ Seller Processing', time: 'In progress', desc: 'Preparing your order' },
                { status: 'pending', title: '○ Out for Delivery', time: 'Pending', desc: 'Expected: Feb 24-25' },
                { status: 'pending', title: '○ Delivered', time: 'Pending', desc: '' },
              ].map((item, i) => (
                <div key={i} className={`pls-tracking-item pls-tracking-${item.status}`}>
                  <h5>{item.title}</h5>
                  <p className="pls-tracking-time">{item.time}</p>
                  {item.desc && <p className="pls-tracking-desc">{item.desc}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="pls-pricing-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">Pricing</span>
            <h2>Simple, Transparent Pricing</h2>
            <p>No transaction fees. No commissions. Just a flat monthly subscription — you keep 100% of every sale.</p>
          </div>
          <div className="pls-pricing-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              {
                name: '🆓 FREE STARTER', desc: 'Forever Free', amount: 'KES 0', period: '/month', popular: false,
                features: ['20 products', 'M-Pesa + card payments', 'Custom branding included', 'Order management + SMS alerts', 'Basic sales dashboard', 'Community support', 'No transaction fees — ever'],
                cta: 'Start Free', ctaStyle: 'pls-btn-secondary'
              },
              {
                name: '💼 SELLER', desc: 'Most Popular', amount: 'KES 899', period: '/month', popular: true,
                features: ['100 products', 'Advanced analytics & insights', 'Discount codes & promos', 'Email & SMS marketing (500/mo)', 'Priority 24hr support', 'No transaction fees — flat fee only'],
                cta: 'Start Free Trial', ctaStyle: 'pls-btn-primary',
                annual: 'KES 8,990/year (2 months free)'
              },
              {
                name: '🚀 BUSINESS', desc: 'Best Value', amount: 'KES 2,499', period: '/month', popular: false, bestValue: true,
                features: ['Unlimited products', 'Custom domain (yourstore.co.ke)', 'Team accounts (up to 3 staff)', 'Inventory management', 'White-label (no PayLoom branding)', 'Financial reports & tax tools', 'No transaction fees — flat fee only'],
                cta: 'Start Free Trial', ctaStyle: 'pls-btn-primary',
                annual: 'KES 24,990/year (2 months free)'
              },
              {
                name: '🏢 ENTERPRISE', desc: 'Custom Pricing', amount: 'Custom', period: '', popular: false,
                features: ['All Business features', 'API access for integrations', 'Dedicated account manager', 'SLA guarantees', 'Custom integrations (ERP, QuickBooks)', 'Unlimited team accounts', 'Negotiated flat contract pricing'],
                cta: 'Contact Sales', ctaStyle: 'pls-btn-secondary'
              },
            ].map((plan: any, i) => (
              <div key={i} className={`pls-pricing-card${plan.popular ? ' pls-pricing-popular' : ''}${plan.bestValue ? ' pls-pricing-best-value' : ''} pls-animate`}>
                <div className="pls-pricing-header">
                  <div className="pls-pricing-name">{plan.name}</div>
                  <div className="pls-pricing-desc">{plan.desc}</div>
                </div>
                <div className="pls-pricing-price">
                  <div className="pls-pricing-amount">{plan.amount}</div>
                  {plan.period && <div className="pls-pricing-period">{plan.period}</div>}
                </div>
                {plan.annual && (
                  <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '12px', textAlign: 'center' as const }}>
                    {plan.annual}
                  </div>
                )}
                <ul className="pls-pricing-features-list">
                  {plan.features.map((f: string, j: number) => <li key={j}>{f}</li>)}
                </ul>
                <Link to="/signup" className={`pls-btn ${plan.ctaStyle} pls-btn-large pls-pricing-cta`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          <div className="pls-pricing-alternative pls-animate">
            <p>💡 All plans include M-Pesa & card payments with zero transaction fees. Annual plans save you 2 months!</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="pls-testimonials-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">Success Stories</span>
            <h2>Join 10,000+ Sellers Making Money with PayLoom</h2>
            <p>Real stories from sellers growing their business</p>
          </div>
          <div className="pls-testimonials-grid">
            {[
              { text: "I sell jewelry on Instagram. PayLoom's links are perfect! I just comment the link, customer pays, and money is in my M-Pesa instantly. So professional!", name: 'Sarah Mwikali', role: 'Handmade Jewelry, Nairobi', sales: 'KES 180K+ in sales', initials: 'SM' },
              { text: 'Built my entire fashion store in 20 minutes. My customers love how easy it is to browse and pay. Sales have tripled since switching to PayLoom!', name: 'James Kariuki', role: 'Fashion Retailer, Kisumu', sales: '500+ orders processed', initials: 'JK' },
              { text: "As a freelance designer, payment links have changed my life. No more chasing clients. I send the link, they pay immediately. Simple!", name: 'Grace Lumumba', role: 'Graphic Designer, Mombasa', sales: 'Freelancer since 2023', initials: 'GL' },
            ].map((t, i) => (
              <div key={i} className="pls-testimonial-card pls-animate">
                <div className="pls-testimonial-stars">★★★★★</div>
                <p className="pls-testimonial-text">"{t.text}"</p>
                <div className="pls-testimonial-author">
                  <div className="pls-author-avatar">{t.initials}</div>
                  <div className="pls-author-info">
                    <h4>{t.name}</h4>
                    <p>{t.role}</p>
                    <p className="pls-author-sales">{t.sales}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="pls-comparison-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">Comparison</span>
            <h2>Why Sellers Choose PayLoom</h2>
          </div>
          <div className="pls-comparison-grid pls-animate">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="pls-th-payloom">PayLoom</th>
                  <th>Marketplace Platforms</th>
                  <th>Manual WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Get paid directly', '✓', '✗', '✓'],
                  ['Instant payout', '✓', '14-30 days', '✓'],
                  ['Commission', '0%', '15-25%', '0%'],
                  ['Professional storefront', '✓', '✓', '✗'],
                  ['Auto payment verification', '✓', '✓', '✗'],
                  ['Order tracking', '✓', '✓', '✗'],
                  ['Setup time', '5 minutes', '2-3 days', '0 minutes'],
                  ['Monthly cost', 'KES 500', 'Free + 20%', 'Free'],
                ].map(([feat, pl, jj, wa], i) => (
                  <tr key={i}>
                    <td>{feat}</td>
                    <td className={pl === '✓' ? 'pls-check' : ''}>{pl}</td>
                    <td className={jj === '✗' ? 'pls-cross' : ''}>{jj}</td>
                    <td className={wa === '✗' ? 'pls-cross' : wa === '✓' ? 'pls-check' : ''}>{wa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="pls-faq-section">
        <div className="pls-container">
          <div className="pls-section-header pls-animate">
            <span className="pls-section-tag">FAQ</span>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="pls-faq-grid">
            <div>
              {[
                { q: 'How do I get my money?', a: "Customers pay directly to YOUR M-Pesa, Till, or bank account. We never touch your money." },
                { q: "What if someone doesn't pay?", a: "Customers can't access the order tracking without entering a valid M-Pesa code. We verify every transaction through M-Pesa's system." },
                { q: 'How does verification work?', a: "Customer enters their M-Pesa transaction code. We check M-Pesa's database in 2 seconds to confirm: real transaction, correct amount, correct recipient." },
                { q: 'Can I use my personal M-Pesa?', a: 'Yes! Most sellers use their personal M-Pesa number. You can also add Till, PayBill, or bank accounts.' },
              ].map((f, i) => (
                <div key={i} className="pls-faq-item pls-animate">
                  <div className="pls-faq-question">{f.q}</div>
                  <div className="pls-faq-answer">{f.a}</div>
                </div>
              ))}
            </div>
            <div>
              {[
                { q: "What's the catch?", a: 'No catch. We charge KES 500/month for unlimited orders (or KES 30 per transaction). No commissions, no hidden fees.' },
                { q: 'Do I need documents to register?', a: 'Nope. Just your phone number and name. Start selling in 60 seconds.' },
                { q: 'What if customer says they paid but didn\'t?', a: "Our M-Pesa verification catches this. If the code is fake or used elsewhere, it won't verify. You're protected from fraud." },
                { q: 'Can customers pay with cards?', a: 'Currently M-Pesa only (personal, Till, PayBill). Card payments coming soon in Premium plan.' },
              ].map((f, i) => (
                <div key={i} className="pls-faq-item pls-animate">
                  <div className="pls-faq-question">{f.q}</div>
                  <div className="pls-faq-answer">{f.a}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pls-faq-cta pls-animate">
            <p>Still have questions?</p>
            <Link to="/info/contact" className="pls-btn pls-btn-secondary">Chat with Support</Link>
            <Link to="/signup" className="pls-btn pls-btn-primary" style={{ marginLeft: '1rem' }}>Book a Demo Call</Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="pls-final-cta">
        <div className="pls-container pls-final-cta-content">
          <h2>Start Selling in the Next 60 Seconds</h2>
          <p>
            Join 10,000+ sellers already making money with PayLoom. No credit card required.
            No commitment. Just results.
          </p>
          <div className="pls-final-cta-actions">
            <Link to="/signup" className="pls-btn pls-btn-white pls-btn-large">
              Create Your First Payment Link →
            </Link>
            <Link to="/signup" className="pls-btn pls-btn-outline pls-btn-large">
              Build Your Store Instead
            </Link>
          </div>
          <div className="pls-final-trust">
            <div className="pls-final-trust-item">✓ Free forever under 10 orders/month</div>
            <div className="pls-final-trust-item">✓ Upgrade anytime, cancel anytime</div>
            <div className="pls-final-trust-item">✓ 24/7 support via WhatsApp</div>
          </div>
        </div>
      </section>

      {/* FOOTER — existing footer preserved */}
      <footer className="pls-footer">
        <div className="pls-container">
          <div className="pls-footer-grid">
            <div>
              <div className="pls-footer-brand">
                <div className="pls-logo-icon">P</div>
                <span>PayLoom Instants</span>
              </div>
              <p className="pls-footer-description">
                Empowering African sellers with instant payment links and beautiful online stores.
                Get paid faster, sell smarter, grow bigger.
              </p>
              <div className="pls-footer-social">
                <a href="https://x.com/payloom" target="_blank" rel="noopener noreferrer" className="pls-social-icon" aria-label="X (Twitter)">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" width="16" height="16"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"/></svg>
                </a>
                <a href="https://linkedin.com/company/payloom" target="_blank" rel="noopener noreferrer" className="pls-social-icon" aria-label="LinkedIn">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" width="16" height="16"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 112 102.2 112c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/></svg>
                </a>
                <a href="https://facebook.com/payloom" target="_blank" rel="noopener noreferrer" className="pls-social-icon" aria-label="Facebook">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" width="16" height="16"><path d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.4 194.2 504.5V334.2H141.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H287V510.1C413.8 494.8 512 386.9 512 256h0z"/></svg>
                </a>
                <a href="https://instagram.com/payloom" target="_blank" rel="noopener noreferrer" className="pls-social-icon" aria-label="Instagram">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" width="16" height="16"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>
                </a>
              </div>

              <div className="pls-newsletter">
                <h4>Stay in the loop</h4>
                <p>Get tips, updates & seller success stories.</p>
                <form
                  className="pls-newsletter-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                    const email = input?.value?.trim();
                    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      input.value = '';
                      alert('🎉 Subscribed! Check your inbox.');
                    }
                  }}
                >
                  <input type="email" placeholder="Enter your email" required maxLength={255} />
                  <button type="submit" className="pls-btn pls-btn-primary">Subscribe</button>
                </form>
              </div>
            </div>

            {[
              { title: 'Product', links: [
                { label: 'Payment Links', to: '/info/payment-links' },
                { label: 'Online Stores', to: '/info/online-stores' },
                { label: 'Pricing', to: '/info/pricing' },
                { label: 'Features', to: '/info/features' },
                { label: 'Mobile App', to: '/info/mobile-app' },
              ]},
              { title: 'Resources', links: [
                { label: 'Help Center', to: '/info/help' },
                { label: 'Tutorials', to: '/info/tutorials' },
                { label: 'Example Stores', to: '/info/example-stores' },
                { label: 'Blog', to: '/info/blog' },
                { label: 'Community', to: '/info/community' },
              ]},
              { title: 'Company', links: [
                { label: 'About Us', to: '/info/about' },
                { label: 'Careers', to: '/info/careers' },
                { label: 'Press', to: '/info/press' },
                { label: 'Partners', to: '/info/partners' },
                { label: 'Contact', to: '/info/contact' },
              ]},
              { title: 'Legal', links: [
                { label: 'Privacy Policy', to: '/legal' },
                { label: 'Terms of Service', to: '/legal' },
                { label: 'Refund Policy', to: '/legal' },
                { label: 'Security', to: '/legal' },
              ]},
            ].map((section, i) => (
              <div key={i} className="pls-footer-section">
                <h4>{section.title}</h4>
                <ul className="pls-footer-links">
                  {section.links.map((link, j) => (
                    <li key={j}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pls-footer-bottom">
            <div>© 2026 PayLoom Instants. All rights reserved.</div>
            <div>Empowering sellers across Africa 🚀</div>
          </div>
        </div>
      </footer>
      <PWAInstallPrompt />
    </div>
  );
}
