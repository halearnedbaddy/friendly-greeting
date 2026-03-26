import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ShieldIcon, FileTextIcon, LockIcon, GlobeIcon } from '@/components/icons';

export function LegalPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-8">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-semibold">
                    <ArrowLeftIcon size={20} /> Back to Home
                </Link>

                <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-12">
                    <h1 className="text-3xl sm:text-4xl font-black text-[#3d1a7a] mb-2">PayLoom Instants - Legal & Security Center</h1>
                    <p className="text-gray-500 mb-10 text-sm">Last updated: March 7, 2026</p>

                    {/* Table of Contents */}
                    <nav className="bg-gray-50 rounded-xl p-5 mb-10">
                        <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Contents</h3>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#terms" className="text-[#5d2ba3] hover:underline">1. Terms of Service</a></li>
                            <li><a href="#privacy" className="text-[#5d2ba3] hover:underline">2. Privacy Policy</a></li>
                            <li><a href="#security" className="text-[#5d2ba3] hover:underline">3. Security Policy</a></li>
                            <li><a href="#payment" className="text-[#5d2ba3] hover:underline">4. Payment & Transaction Terms</a></li>
                            <li><a href="#disputes" className="text-[#5d2ba3] hover:underline">5. Dispute Resolution</a></li>
                            <li><a href="#acceptable-use" className="text-[#5d2ba3] hover:underline">6. Acceptable Use Policy</a></li>
                            <li><a href="#seller-responsibilities" className="text-[#5d2ba3] hover:underline">7. Seller Responsibilities</a></li>
                            <li><a href="#buyer-protection" className="text-[#5d2ba3] hover:underline">8. Buyer Protection</a></li>
                            <li><a href="#contact" className="text-[#5d2ba3] hover:underline">9. Contact Us</a></li>
                        </ul>
                    </nav>

                    <div className="space-y-14">
                        {/* 1. Terms of Service */}
                        <section id="terms">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <FileTextIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">1. Terms of Service</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">1.1 Acceptance of Terms</h3>
                                <p>By accessing or using PayLoom Instants ("the Platform", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the Platform.</p>
                                <p><strong>Important:</strong> PayLoom Instants is a <strong>Software-as-a-Service (SaaS) platform</strong> that provides payment link and online store creation tools. We are NOT a payment processor, financial institution, or money transmitter. All payments flow directly from buyers to sellers through their configured payment methods.</p>
                                <p>PayLoom reserves the right to modify these terms at any time. Material changes will be notified via email 30 days before taking effect. Continued use after changes constitutes acceptance.</p>

                                <h3 className="font-semibold text-gray-800">1.2 Eligibility</h3>
                                <p><strong>Minimum Requirements:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>You must be at least 18 years of age</li>
                                    <li>You must have a valid phone number (Kenyan mobile number required for M-Pesa verification)</li>
                                    <li>You must provide accurate and truthful information during registration</li>
                                    <li>You must be legally capable of entering binding contracts in your jurisdiction</li>
                                </ul>
                                <p><strong>Business Accounts:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Businesses must be legally registered if required by local law</li>
                                    <li>Business representatives must have authority to bind the business to these terms</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">1.3 Account Registration & Security</h3>
                                <p><strong>Account Creation:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>One person/business may maintain only one account</li>
                                    <li>You must provide accurate contact information (name, phone number, email)</li>
                                    <li>You are responsible for maintaining the confidentiality of your login credentials</li>
                                    <li>You must notify us immediately at security@payloom.com of any unauthorized access</li>
                                </ul>
                                <p><strong>Security Responsibilities:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Use a strong, unique password</li>
                                    <li>Enable two-factor authentication when available</li>
                                    <li>Do not share your account credentials with anyone</li>
                                    <li>Log out from shared or public devices</li>
                                </ul>
                                <p><strong>Account Termination:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>You may close your account at any time through your dashboard settings</li>
                                    <li>We may suspend or terminate accounts that violate these terms</li>
                                    <li>Upon termination, you must cease all use of PayLoom branding and links</li>
                                    <li>Outstanding transactions will be processed according to our Dispute Resolution policy</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">1.4 What PayLoom Does (And Doesn't Do)</h3>
                                <p><strong>What We Provide:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>✅ Software tools to create payment links and online stores</li>
                                    <li>✅ Automated M-Pesa transaction verification via API</li>
                                    <li>✅ Order tracking system for customers</li>
                                    <li>✅ SMS notification services</li>
                                    <li>✅ Seller dashboard and analytics</li>
                                    <li>✅ Payment method configuration tools</li>
                                    <li>✅ Customer support</li>
                                </ul>
                                <p><strong>What We Do NOT Do:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>❌ Process or hold customer payments</li>
                                    <li>❌ Act as a payment gateway or processor</li>
                                    <li>❌ Provide escrow or money transmission services</li>
                                    <li>❌ Hold funds on behalf of sellers or buyers</li>
                                    <li>❌ Control or access seller payment accounts</li>
                                    <li>❌ Guarantee delivery or quality of goods/services</li>
                                    <li>❌ Mediate commercial disputes between parties</li>
                                </ul>
                                <p><strong>Key Principle:</strong> Money flows directly from buyer → seller. We verify the transaction occurred, but never touch the funds.</p>

                                <h3 className="font-semibold text-gray-800">1.5 Subscription Plans & Pricing</h3>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <p><strong>FREE Tier:</strong> 10 verified orders/month, unlimited payment links, 1 basic store (up to 20 products), standard email support, PayLoom branding on pages.</p>
                                    <p><strong>BASIC Plan (KES 500/month):</strong> UNLIMITED verified orders, unlimited payment links, 1 professional store (unlimited products), custom subdomain, SMS notifications, priority email support, basic analytics.</p>
                                    <p><strong>PREMIUM Plan (KES 2,000/month):</strong> Everything in Basic + unlimited stores, custom domain, advanced analytics, remove PayLoom branding, WhatsApp integration, bulk CSV upload, API access, priority phone support.</p>
                                    <p><strong>Pay-Per-Transaction:</strong> No monthly fee, KES 30 per verified order, all features included.</p>
                                </div>
                                <p><strong>Billing Terms:</strong> Subscriptions billed monthly in advance. Payment via M-Pesa or card. Auto-renewal unless cancelled. No refunds for partial months.</p>

                                <h3 className="font-semibold text-gray-800">1.6 Platform Fees vs Service Fees</h3>
                                <p><strong>You Keep 100% of Your Sales.</strong> Customers pay directly to YOUR M-Pesa/Till/Bank account. We do NOT take a percentage of your sales or deduct from customer payments.</p>
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
                                    <p><strong>Example:</strong> Customer pays KES 5,000 to your M-Pesa → You receive KES 5,000 (full amount). PayLoom service fee: KES 500/month (subscription) OR KES 30 (per-transaction) — paid separately.</p>
                                </div>

                                <h3 className="font-semibold text-gray-800">1.7 Limitation of Liability</h3>
                                <p>PayLoom's total liability is limited to the total subscription fees you paid in the 12 months preceding the claim. We are not liable for quality/delivery of goods, failed payments due to provider issues, loss of profits, or service interruptions.</p>

                                <h3 className="font-semibold text-gray-800">1.8 Indemnification</h3>
                                <p>You agree to indemnify PayLoom from any claims arising from your violation of these terms, violation of law, products/services you sell, disputes with customers, or tax obligations.</p>

                                <h3 className="font-semibold text-gray-800">1.9 Force Majeure</h3>
                                <p>PayLoom is not liable for delays caused by natural disasters, pandemics, government actions, internet/telecom failures, or third-party provider outages.</p>
                            </div>
                        </section>

                        {/* 2. Privacy Policy */}
                        <section id="privacy">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <LockIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">2. Privacy Policy</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">2.1 Information We Collect</h3>
                                <p><strong>Personal Information:</strong></p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>Account Data:</strong> Name, phone number, email address</li>
                                    <li><strong>Payment Configuration:</strong> M-Pesa numbers, Till numbers, PayBill details, bank account information (stored encrypted)</li>
                                    <li><strong>Store Content:</strong> Product names, descriptions, images, prices</li>
                                    <li><strong>Business Information:</strong> Business name, location (optional)</li>
                                </ul>
                                <p><strong>Transaction Data:</strong> Order details, M-Pesa transaction codes, order status/tracking, SMS delivery logs.</p>
                                <p><strong>Usage Data:</strong> IP address, browser type, device information, pages visited, error logs.</p>

                                <h3 className="font-semibold text-gray-800">2.2 How We Use Your Information</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>✅ Account management and authentication</li>
                                    <li>✅ M-Pesa transaction verification via Safaricom API</li>
                                    <li>✅ Order tracking and status updates</li>
                                    <li>✅ Sending SMS notifications</li>
                                    <li>✅ Processing subscription payments</li>
                                    <li>✅ Detecting and preventing fraud</li>
                                </ul>
                                <p>We do NOT sell your personal information or use it for advertising.</p>

                                <h3 className="font-semibold text-gray-800">2.3 Data Sharing & Disclosure</h3>
                                <p>We share data with service providers (Safaricom for M-Pesa verification, Africa's Talking/Twilio for SMS, cloud hosting) under strict agreements. We share with law enforcement only when required by valid court order.</p>

                                <h3 className="font-semibold text-gray-800">2.4 Data Security</h3>
                                <p>All data transmitted via TLS 1.3. Payment credentials encrypted at rest with AES-256. Multi-factor authentication for admin access. Regular security audits.</p>

                                <h3 className="font-semibold text-gray-800">2.5 Data Retention</h3>
                                <p>Data retained as long as account is active. Transaction records kept 7 years (regulatory requirement). Personal data deleted within 30 days of account closure.</p>

                                <h3 className="font-semibold text-gray-800">2.6 Your Rights (GDPR & Data Protection)</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>✅ Access and download your personal data</li>
                                    <li>✅ Request correction of inaccurate information</li>
                                    <li>✅ Request account and data deletion</li>
                                    <li>✅ Export data in machine-readable format</li>
                                    <li>✅ Opt-out of non-essential data processing</li>
                                </ul>
                                <p>To exercise your rights: Email privacy@payloom.com (response within 30 days).</p>

                                <h3 className="font-semibold text-gray-800">2.7 Cookies & Tracking</h3>
                                <p>We use essential cookies for session management, authentication, and security. Analytics cookies are optional. We do NOT use third-party advertising cookies or cross-site tracking.</p>

                                <h3 className="font-semibold text-gray-800">2.8 Children's Privacy</h3>
                                <p>PayLoom is not intended for users under 18. We do not knowingly collect data from children.</p>

                                <h3 className="font-semibold text-gray-800">2.9 International Data Transfers</h3>
                                <p>Data primarily stored in Kenya/East Africa. International transfers use adequate safeguards (Standard Contractual Clauses).</p>
                            </div>
                        </section>

                        {/* 3. Security Policy */}
                        <section id="security">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <ShieldIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">3. Security Policy</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">3.1 Platform Security Measures</h3>
                                <p><strong>Infrastructure:</strong> Enterprise-grade cloud hosting, DDoS protection via Cloudflare, automated daily backups, 99.9% uptime SLA.</p>
                                <p><strong>Application:</strong> OWASP Top 10 compliance, regular penetration testing, vulnerability scanning, code reviews.</p>
                                <p><strong>Authentication:</strong> Phone-based OTP, bcrypt password hashing, session expiry after 7 days inactivity, account lockout after 5 failed attempts, IP anomaly detection.</p>

                                <h3 className="font-semibold text-gray-800">3.2 Payment Security</h3>
                                <p><strong>Critical:</strong> We do NOT store or handle payment credentials. Customers pay directly to seller accounts. We only verify transactions via M-Pesa API (read-only access). Transaction codes are hashed after verification.</p>

                                <h3 className="font-semibold text-gray-800">3.3 Fraud Prevention</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Suspicious transaction pattern detection</li>
                                    <li>Multiple failed verification attempts flagged</li>
                                    <li>High-value order alerts</li>
                                    <li>Unusual login location detection</li>
                                    <li>Compliance team manual review</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">3.4 Incident Response</h3>
                                <p>In event of breach: immediate containment, user notification within 72 hours, authority coordination, post-incident improvements.</p>

                                <h3 className="font-semibold text-gray-800">3.5 Reporting Security Issues</h3>
                                <p>Email security@payloom.com. We investigate within 48 hours. No legal action against good-faith researchers.</p>
                            </div>
                        </section>

                        {/* 4. Payment & Transaction Terms */}
                        <section id="payment">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <GlobeIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">4. Payment & Transaction Terms</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">4.1 How Payments Work on PayLoom</h3>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li><strong>Seller Setup:</strong> Creates payment link or store, configures payment methods (M-Pesa, Till, Bank), shares link with customers</li>
                                    <li><strong>Customer Purchase:</strong> Selects product, chooses payment method, pays directly to seller's M-Pesa/Till/Bank, receives confirmation code</li>
                                    <li><strong>Verification:</strong> Customer enters M-Pesa code on PayLoom, system verifies via API (amount, recipient, uniqueness)</li>
                                    <li><strong>Fulfillment:</strong> Seller fulfills order, updates status (Processing → Shipped → Delivered)</li>
                                    <li><strong>Completion:</strong> Customer confirms delivery, order marked complete</li>
                                </ol>
                                <p><strong>Key Point:</strong> Money flows directly from customer to seller. PayLoom only verifies the transaction occurred.</p>

                                <h3 className="font-semibold text-gray-800">4.2 Supported Payment Methods</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li><strong>M-Pesa Personal:</strong> Personal M-Pesa number</li>
                                    <li><strong>M-Pesa Till:</strong> Business Till number</li>
                                    <li><strong>M-Pesa PayBill:</strong> Business PayBill with account number</li>
                                    <li><strong>Bank Transfer:</strong> Bank name, account number, branch</li>
                                    <li>Sellers can add up to 5 payment options</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">4.3 Transaction Verification</h3>
                                <p><strong>M-Pesa (Automated):</strong> Uses Safaricom Daraja API, verifies in 1-3 seconds. Checks valid code format, transaction exists, amount matches (±KES 5 tolerance), correct recipient, timestamp within 24 hours, code not reused.</p>
                                <p><strong>Bank Transfer (Manual):</strong> Seller reviews bank statement and confirms receipt in dashboard.</p>

                                <h3 className="font-semibold text-gray-800">4.4 Order Status & Tracking</h3>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li><strong>Pending:</strong> Order created, awaiting payment verification</li>
                                    <li><strong>Payment Verified:</strong> Transaction confirmed</li>
                                    <li><strong>Processing:</strong> Seller preparing order</li>
                                    <li><strong>Shipped:</strong> Order dispatched</li>
                                    <li><strong>Delivered:</strong> Customer received order</li>
                                    <li><strong>Completed:</strong> Transaction finalized</li>
                                    <li><strong>Cancelled / Disputed</strong></li>
                                </ol>

                                <h3 className="font-semibold text-gray-800">4.5 Refunds & Cancellations</h3>
                                <p>Refunds occur when seller cancels before shipping, duplicate payment, dispute resolved in buyer's favor, or order expires (7 days). <strong>PayLoom does NOT process refunds.</strong> Seller refunds customer directly.</p>

                                <h3 className="font-semibold text-gray-800">4.6 Fees & Charges</h3>
                                <p>FREE: First 10 verified orders/month. BASIC: KES 500/month OR KES 30/order. PREMIUM: KES 2,000/month. No hidden fees, no commission on sales, no withdrawal fees.</p>

                                <h3 className="font-semibold text-gray-800">4.7 Currency</h3>
                                <p>Currently supports KES (Kenyan Shillings) only. Multi-currency support planned.</p>
                            </div>
                        </section>

                        {/* 5. Dispute Resolution */}
                        <section id="disputes">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <ShieldIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">5. Dispute Resolution</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">5.1 When to File a Dispute</h3>
                                <p><strong>Valid reasons:</strong> Item not received, significantly different from description, defective/damaged, wrong item, suspected fraud.</p>

                                <h3 className="font-semibold text-gray-800">5.2 How to File</h3>
                                <p>Must be filed within <strong>7 days</strong> of delivery date. Provide evidence (photos, messages, tracking info). Navigate to order details → Click "File Dispute" → Select reason → Upload evidence → Submit.</p>

                                <h3 className="font-semibold text-gray-800">5.3 Resolution Process</h3>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li><strong>Day 1:</strong> Dispute filed</li>
                                    <li><strong>Day 1-2:</strong> PayLoom reviews evidence</li>
                                    <li><strong>Day 2-4:</strong> Both parties respond (48 hours)</li>
                                    <li><strong>Day 5-7:</strong> Decision made</li>
                                    <li><strong>Day 7+:</strong> Resolution implemented</li>
                                </ol>
                                <p><strong>Outcomes:</strong> Buyer wins (full refund), Seller wins (no refund), Partial refund, or Escalation to senior review.</p>

                                <h3 className="font-semibold text-gray-800">5.4 PayLoom's Role</h3>
                                <p>We provide the evidence submission platform, review evidence, facilitate communication, and track resolution. We do NOT process refunds, hold funds in escrow, or provide legal advice.</p>

                                <h3 className="font-semibold text-gray-800">5.5 Enforcement</h3>
                                <p>Sellers refusing refund: warning → account flag → suspension. Fraudulent buyer disputes: warning → flag → ban. <strong>Limitation:</strong> Our dispute resolution is advisory, not legally binding.</p>

                                <h3 className="font-semibold text-gray-800">5.6 Appeals</h3>
                                <p>Appeal within 3 days with new evidence. Senior review conducted. Final decision within 5 business days. No further appeals.</p>
                            </div>
                        </section>

                        {/* 6. Acceptable Use Policy */}
                        <section id="acceptable-use">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <ShieldIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">6. Acceptable Use Policy</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">6.1 Prohibited Activities</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>❌ Illegal goods: drugs, weapons, counterfeit/stolen goods, pirated content, fake documents</li>
                                    <li>❌ Restricted goods without license: tobacco, alcohol, prescription medications, adult content</li>
                                    <li>❌ Financial crimes: money laundering, ponzi/pyramid schemes, investment scams</li>
                                    <li>❌ Fraud: false descriptions, fake reviews, impersonation, selling non-existent products</li>
                                    <li>❌ Harmful content: hate speech, harassment, violent/graphic content, spam</li>
                                    <li>❌ Platform abuse: multiple accounts, manipulating verification, scraping, hacking</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">6.2 Consequences</h3>
                                <p><strong>First violation:</strong> Warning + content removed. <strong>Second:</strong> Temporary suspension (7-30 days). <strong>Third/Severe:</strong> Permanent termination + IP ban. <strong>Immediate termination:</strong> Child exploitation, terrorism, major fraud (&gt;KES 50,000), threats of violence.</p>

                                <h3 className="font-semibold text-gray-800">6.3 Seller Content Standards</h3>
                                <p>Listings must accurately describe items, include real photos, state true condition, disclose defects, provide accurate pricing. Prohibited: stolen/copyrighted images, fake discounts, false scarcity claims.</p>

                                <h3 className="font-semibold text-gray-800">6.4 Reporting Violations</h3>
                                <p>Click "Report" on listing/profile, select violation type, provide evidence. Review times: Critical 24h, Policy violations 48-72h, Minor issues 5 business days.</p>
                            </div>
                        </section>

                        {/* 7. Seller Responsibilities */}
                        <section id="seller-responsibilities">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <FileTextIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">7. Seller Responsibilities</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">7.1 Accurate Representation</h3>
                                <p>Provide truthful descriptions, use real photos, disclose defects, state true availability, honor advertised prices. No stock photos, copied descriptions, hidden fees, or bait-and-switch tactics.</p>

                                <h3 className="font-semibold text-gray-800">7.2 Order Fulfillment</h3>
                                <p>Ship within stated processing time (max 3 business days). Update order status promptly. Provide tracking information. Communicate delays proactively. Package items securely.</p>

                                <h3 className="font-semibold text-gray-800">7.3 Customer Communication</h3>
                                <p>Respond to inquiries within 24 hours. Provide order updates within 48 hours. Maintain professional and respectful tone.</p>

                                <h3 className="font-semibold text-gray-800">7.4 Returns & Refunds</h3>
                                <p>Clearly state return policy. Honor stated policy. Process approved returns within 5 business days. Suggested: 7-day return window for defective items.</p>

                                <h3 className="font-semibold text-gray-800">7.5 Tax Compliance</h3>
                                <p>Register for tax if required. Collect/remit sales tax/VAT. Maintain financial records. Issue receipts. PayLoom provides transaction reports but does NOT collect/remit taxes on your behalf.</p>

                                <h3 className="font-semibold text-gray-800">7.6 Performance Metrics</h3>
                                <p>We track fulfillment rate (&gt;95%), response time (&lt;24h), dispute rate (&lt;5%). Poor performance leads to warnings, account review, reduced visibility, or suspension.</p>
                            </div>
                        </section>

                        {/* 8. Buyer Protection */}
                        <section id="buyer-protection">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <ShieldIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">8. Buyer Protection</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">8.1 What Buyers Can Expect</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>✅ Accurate product descriptions and real photos</li>
                                    <li>✅ Secure payment to verified sellers</li>
                                    <li>✅ Order tracking and updates</li>
                                    <li>✅ Dispute resolution process</li>
                                    <li>✅ Support from PayLoom team</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">8.2 Buyer Rights</h3>
                                <p>Receive items as described. Timely shipping. Track order status. File disputes. Request refunds for valid reasons. Contact seller.</p>

                                <h3 className="font-semibold text-gray-800">8.3 Buyer Responsibilities</h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Provide accurate delivery information</li>
                                    <li>Submit valid M-Pesa transaction codes</li>
                                    <li>Confirm delivery when received</li>
                                    <li>File disputes within 7 days</li>
                                    <li>Communicate in good faith</li>
                                </ul>
                                <p><strong>Prohibited:</strong> False disputes, claiming non-delivery after receiving, tampering with items, harassing sellers.</p>

                                <h3 className="font-semibold text-gray-800">8.4 Payment Verification</h3>
                                <ol className="list-decimal pl-6 space-y-1">
                                    <li>Pay to seller's M-Pesa/Till/Bank</li>
                                    <li>Receive M-Pesa confirmation code (e.g., QGH7XYZ123)</li>
                                    <li>Enter code on PayLoom order page</li>
                                    <li>Wait 1-3 seconds for verification</li>
                                    <li>Receive confirmation SMS</li>
                                </ol>

                                <h3 className="font-semibold text-gray-800">8.5 Delivery Tracking</h3>
                                <p>Check email/SMS for tracking link. View real-time status updates. Contact seller via provided contact info.</p>
                            </div>
                        </section>

                        {/* 9. Contact Us */}
                        <section id="contact">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 bg-[#5d2ba3]/15 rounded-lg flex items-center justify-center text-[#5d2ba3]">
                                    <GlobeIcon size={22} />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3d1a7a]">9. Contact Us</h2>
                            </div>

                            <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
                                <h3 className="font-semibold text-gray-800">9.1 Customer Support</h3>
                                <ul className="list-none space-y-2">
                                    <li>📧 <strong>General Inquiries:</strong> support@payloom.com</li>
                                    <li>📧 <strong>Technical Issues:</strong> tech@payloom.com</li>
                                    <li>📧 <strong>Billing Questions:</strong> billing@payloom.com</li>
                                    <li>📞 <strong>Phone (Premium):</strong> +254705448355 (Mon-Fri, 9 AM - 6 PM EAT)</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">9.2 Security & Privacy</h3>
                                <ul className="list-none space-y-2">
                                    <li>📧 <strong>Security Issues:</strong> security@payloom.com</li>
                                    <li>📧 <strong>Privacy Requests:</strong> privacy@payloom.com (response within 30 days)</li>
                                    <li>📧 <strong>Data Deletion:</strong> privacy@payloom.com</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">9.3 Legal & Business</h3>
                                <ul className="list-none space-y-2">
                                    <li>📧 <strong>Legal Notices:</strong> legal@payloom.com</li>
                                    <li>📧 <strong>Dispute Escalations:</strong> disputes@payloom.com</li>
                                    <li>📧 <strong>Partnerships:</strong> partnerships@payloom.com</li>
                                    <li>📧 <strong>Feedback:</strong> feedback@payloom.com</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">9.4 Social Media</h3>
                                <ul className="list-none space-y-1">
                                    <li>🐦 Twitter: @PayLoomKE</li>
                                    <li>📘 Facebook: /PayLoomInstants</li>
                                    <li>📸 Instagram: @payloom</li>
                                </ul>

                                <h3 className="font-semibold text-gray-800">9.5 Office</h3>
                                <p><strong>PayLoom Instants</strong><br />
                                Nairobi, Kenya<br />
                                📧 verdioharun@gmail.com<br />
                                📞 +254705448355</p>
                                <p><strong>Business Hours:</strong> Mon-Fri 9:00 AM - 6:00 PM EAT | Sat 10:00 AM - 2:00 PM EAT | Sun & Holidays: Closed<br />
                                <em>Emergency support available 24/7 for critical issues.</em></p>
                            </div>
                        </section>

                        {/* Governing Law */}
                        <section>
                            <div className="bg-gray-50 rounded-xl p-6 space-y-3 text-sm text-gray-600">
                                <h3 className="font-semibold text-gray-800">Governing Law & Jurisdiction</h3>
                                <p>These terms are governed by the laws of Kenya. Any disputes shall be resolved in the courts of Nairobi, Kenya. For international users, local consumer protection laws may provide additional rights.</p>
                                
                                <h3 className="font-semibold text-gray-800">Changes to These Terms</h3>
                                <p>Material changes: 30 days email notice. Minor changes: posted immediately with dashboard notification.</p>
                                <p><strong>Version History:</strong> v1.0 (Feb 6, 2026) Initial release | v2.0 (Mar 7, 2026) Updated to reflect SaaS model, clarified payment flow.</p>
                                
                                <p className="text-center pt-4 font-semibold text-gray-700">© 2026 PayLoom Instants. All rights reserved.</p>
                                <p className="text-center text-xs italic">By using PayLoom, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LegalPage;