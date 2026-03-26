// API requests use relative URLs so the Vite dev-server proxy forwards
// /api/* → http://localhost:8000 in development, and the same host in production.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

import * as supabaseApi from "./supabaseApi";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

class ApiService {
  private getAuthToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
        return true;
      }

      return false;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, requireAuth = true } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (requireAuth) {
      const token = this.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      let response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle token expiration
      if (response.status === 401 && requireAuth) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          requestHeaders['Authorization'] = `Bearer ${this.getAuthToken()}`;
          response = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
          });
        } else {
          this.clearTokens();
          window.location.href = '/login';
          return { success: false, error: 'Session expired', code: 'SESSION_EXPIRED' };
        }
      }

      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();

      // If the backend is down/misrouted, we might receive HTML (the SPA index.html) or an empty response.
      if (!rawText.trim()) {
        // Include status and URL to make debugging easier
        return {
          success: false,
          error: `Empty response from server (status: ${response.status}, url: ${response.url})`,
          code: 'EMPTY_RESPONSE',
        };
      }

      if (!contentType.includes('application/json')) {
        return {
          success: false,
          error: 'Server returned an invalid response (expected JSON)',
          code: 'INVALID_RESPONSE',
          message: rawText.slice(0, 200),
        };
      }

      try {
        return JSON.parse(rawText) as ApiResponse<T>;
      } catch {
        return {
          success: false,
          error: 'Failed to parse server response',
          code: 'JSON_PARSE_ERROR',
          message: rawText.slice(0, 200),
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('API request error:', error);

      // Check if it was a timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please check your connection and try again.',
          code: 'TIMEOUT_ERROR',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error. Please try again.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  // Auth endpoints
  async requestOTP(phone: string, purpose: 'LOGIN' | 'REGISTRATION') {
    return this.request('/api/v1/auth/otp/request', {
      method: 'POST',
      body: { phone, purpose },
      requireAuth: false,
    });
  }

  async register(data: { phone: string; name: string; email?: string; role?: string; otp: string }) {
    const response = await this.request<{
      user: { id: string; phone: string; name: string; email?: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: data,
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  }

  async login(phone: string, otp: string) {
    const response = await this.request<{
      user: { id: string; phone: string; name: string; email?: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: { phone, otp },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    await this.request('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
    this.clearTokens();
  }

  async getProfile() {
    return this.request('/api/v1/auth/profile');
  }

  // Wallet endpoints
  async getWallet() {
    return this.request('/api/v1/wallet');
  }

  async getPaymentMethods() {
    return this.request('/api/v1/wallet/payment-methods');
  }

  async addPaymentMethod(data: { type: string; provider: string; accountNumber: string; accountName: string; isDefault?: boolean }) {
    return this.request('/api/v1/wallet/payment-methods', {
      method: 'POST',
      body: data,
    });
  }

  async requestWithdrawal(amount: number, paymentMethodId: string) {
    return this.request<{ reference: string; status: string; amount: number }>('/api/v1/wallet/withdraw', {
      method: 'POST',
      body: { amount, paymentMethodId },
    });
  }

  async getWithdrawalHistory(page = 1, limit = 20) {
    return this.request(`/api/v1/wallet/withdrawals?page=${page}&limit=${limit}`);
  }

  // Transaction endpoints
  async createTransaction(data: { itemName: string; amount: number; description?: string; images?: string[] }) {
    return this.request<{
      id: string;
      paymentLink: string;
      itemName: string;
      itemDescription?: string;
      itemImages: string[];
      amount: number;
      status: string;
    }>('/api/v1/transactions', {
      method: 'POST',
      body: data,
    });
  }

  async getTransaction(id: string) {
    return this.request(`/api/v1/transactions/${id}`, { requireAuth: false });
  }

  async getTransactions(params: { role?: string; status?: string; page?: number; limit?: number } = {}) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request(`/api/v1/transactions?${query}`);
  }

  async initiatePayment(transactionId: string, data: { paymentMethod: string; phone: string; buyerName?: string; buyerEmail?: string }) {
    return this.request(`/api/v1/transactions/${transactionId}/pay`, {
      method: 'POST',
      body: data,
      requireAuth: false,
    });
  }

  async confirmDelivery(transactionId: string) {
    return this.request(`/api/v1/transactions/${transactionId}/confirm`, {
      method: 'POST',
    });
  }

  // Seller endpoints
  async getSellerOrders(params: { status?: string; page?: number; limit?: number } = {}) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request(`/api/v1/seller/orders?${query}`);
  }

  async getOrderDetails(orderId: string) {
    return this.request(`/api/v1/seller/orders/${orderId}`);
  }

  async acceptOrder(orderId: string) {
    return this.request(`/api/v1/seller/orders/${orderId}/accept`, { method: 'POST' });
  }

  async rejectOrder(orderId: string, reason?: string) {
    return this.request(`/api/v1/seller/orders/${orderId}/reject`, {
      method: 'POST',
      body: { reason },
    });
  }

  async addShippingInfo(orderId: string, data: { courierName: string; trackingNumber: string; estimatedDeliveryDate?: string; notes?: string }) {
    return this.request(`/api/v1/seller/orders/${orderId}/shipping`, {
      method: 'POST',
      body: data,
    });
  }

  async getSellerStats() {
    return this.request('/api/v1/seller/stats');
  }

  // Payment endpoints (Legacy M-Pesa - keeping for compatibility)
  async initiateSTKPush(transactionId: string, phoneNumber: string, amount: number) {
    return this.request('/api/v1/payments/initiate-stk', {
      method: 'POST',
      body: { transactionId, phoneNumber, amount },
    });
  }

  async confirmDeliveryWithOTP(transactionId: string, deliveryOTP: string) {
    return this.request('/api/v1/payments/confirm-delivery', {
      method: 'POST',
      body: { transactionId, deliveryOTP },
    });
  }

  async checkPaymentStatus(transactionId: string) {
    return this.request('/api/v1/payments/check-status', {
      method: 'POST',
      body: { transactionId },
      requireAuth: false,
    });
  }

  async simulatePayment(transactionId: string) {
    return this.request('/api/v1/payments/simulate-payment', {
      method: 'POST',
      body: { transactionId },
      requireAuth: false,
    });
  }

  // Manual Payment endpoints (replaced Paystack)
  async getPaystackConfig() {
    // Deprecated - manual payment system now used
    return { success: false, error: 'Paystack has been replaced with manual payment verification' };
  }

  async initiatePaystackPayment(_data: { transactionId: string; email: string; metadata?: Record<string, unknown> }) {
    return { success: false, error: 'Use manual payment verification instead' };
  }

  async verifyPaystackPayment(_transactionId: string, _reference: string) {
    return { success: false, error: 'Use manual payment verification instead' };
  }

  // IntaSend Payment endpoints (deprecated - using Paystack)
  async getIntaSendConfig() {
    return this.request('/api/v1/intasend/config', { requireAuth: false });
  }

  async createIntaSendCheckout(data: { transactionId: string; email: string; firstName?: string; lastName?: string; phone?: string }) {
    return this.request('/api/v1/intasend/create-checkout', {
      method: 'POST',
      body: data,
      requireAuth: false,
    });
  }

  async initiateIntaSendStkPush(data: { transactionId: string; phoneNumber: string; email?: string }) {
    return this.request('/api/v1/intasend/stk-push', {
      method: 'POST',
      body: data,
      requireAuth: false,
    });
  }

  async checkIntaSendStatus(transactionId: string) {
    return this.request('/api/v1/intasend/check-status', {
      method: 'POST',
      body: { transactionId },
      requireAuth: false,
    });
  }

  async requestIntaSendPayout(data: { amount: number; phoneNumber: string; narrative?: string }) {
    return this.request('/api/v1/intasend/payout', {
      method: 'POST',
      body: data,
    });
  }

  // Storefront (public) endpoints
  async getStorefront(slug: string) {
    return this.request(`/api/v1/storefront/${encodeURIComponent(slug)}`, {
      requireAuth: false,
    });
  }

  async getPublicProduct(slug: string, productId: string) {
    return this.request(`/api/v1/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`, {
      requireAuth: false,
    });
  }

  // Seller store & social endpoints
  async getMyStore() {
    return this.request('/api/v1/store/me');
  }

  async createStore(data: { name: string; slug: string }) {
    return this.request('/api/v1/store', { method: 'POST', body: data });
  }

  async updateStore(data: { name?: string; slug?: string; logo?: string; bio?: string; visibility?: 'PRIVATE' | 'PUBLIC' }) {
    return this.request('/api/v1/store', { method: 'PATCH', body: data });
  }

  async updateStoreStatus(status: 'INACTIVE' | 'ACTIVE' | 'FROZEN') {
    return this.request('/api/v1/store/status', { method: 'PATCH', body: { status } });
  }

  async getStoreReadiness() {
    return this.request('/api/v1/store/readiness');
  }

  async triggerStoreRescan() {
    return this.request('/api/v1/store/rescan', { method: 'POST' });
  }

  async listSocialAccounts() {
    return this.request('/api/v1/social');
  }

  async connectSocialPage(data: { platform: 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN'; pageUrl: string; pageId?: string }) {
    return this.request('/api/v1/social/connect', { method: 'POST', body: data });
  }

  async rescanSocialPage(id: string) {
    return this.request(`/api/v1/social/${id}/rescan`, { method: 'POST' });
  }

    // Seller products endpoints
    async listDraftProducts() {
      return this.request('/api/v1/products/drafts');
    }

    async listPublishedProducts() {
      return this.request('/api/v1/products/published');
    }

    // Payment Link endpoints
    async createPaymentLink(data: { productName: string; productDescription?: string; price: number; originalPrice?: number; images?: string[]; customerPhone?: string; currency?: string; quantity?: number; expiryHours?: number }) {
      return this.request('/api/v1/links', {
        method: 'POST',
        body: data
      });
    }

    async getPaymentLink(linkId: string) {
      return this.request(`/api/v1/links/${linkId}`, { requireAuth: false });
    }

    async getMyPaymentLinks(params: { status?: string; page?: number; limit?: number } = {}) {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return this.request(`/api/v1/links/seller/my-links?${query}`);
    }

    async updatePaymentLinkStatus(linkId: string, status: string) {
      return this.request(`/api/v1/links/${linkId}/status`, {
        method: 'PATCH',
        body: { status }
      });
    }

    async restockPaymentLink(linkId: string, quantity: number) {
      return this.request(`/api/v1/links/${linkId}/restock`, {
        method: 'PATCH',
        body: { quantity }
      });
    }

    async createProduct(data: { name: string; description?: string; price: number; images?: string[] }) {
      return this.request('/api/v1/products', { method: 'POST', body: data });
    }

  async updateProductDetails(id: string, data: { name?: string; description?: string; price?: number; images?: string[] }) {
    return this.request(`/api/v1/products/${id}`, { method: 'PATCH', body: data });
  }

  async publishProduct(id: string) {
    return this.request(`/api/v1/products/${id}/publish`, { method: 'POST' });
  }

  async archiveProduct(id: string) {
    return this.request(`/api/v1/products/${id}/archive`, { method: 'POST' });
  }

  async deleteProduct(id: string) {
    return this.request(`/api/v1/products/${id}`, { method: 'DELETE' });
  }

  // Admin extensions (ADD ONLY)
  async adminListStores() {
    return this.request('/api/v1/admin/stores');
  }

  async adminFreezeStore(storeId: string) {
    return this.request(`/api/v1/admin/stores/${storeId}/freeze`, { method: 'POST' });
  }

  async adminListSocialAccounts() {
    return this.request('/api/v1/admin/social-accounts');
  }

  async adminListSyncLogs(page = 1, limit = 20) {
    return this.request(`/api/v1/admin/sync-logs?page=${page}&limit=${limit}`);
  }

  async adminDisableProduct(productId: string) {
    return this.request(`/api/v1/admin/products/${productId}/disable`, { method: 'POST' });
  }

  async resolveDispute(disputeId: string, data: { resolution: string; winner: 'buyer' | 'seller' }) {
    return this.request(`/api/v1/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: data,
    });
  }

  // Email/Password Auth Methods
  async registerWithEmail(data: { email: string; password: string; name: string; role?: string }) {
    const response = await this.request<{
      user: { id: string; phone?: string; name: string; email: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/register-email', {
      method: 'POST',
      body: data,
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  }

  async loginWithEmail(email: string, password: string) {
    const response = await this.request<{
      user: { id: string; phone?: string; name: string; email: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/login-email', {
      method: 'POST',
      body: { email, password },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  }

  async adminLogin(email: string, password: string) {
    const response = await this.request<{
      user: { id: string; phone?: string; name: string; email: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>('/api/v1/auth/admin/login', {
      method: 'POST',
      body: { email, password },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  }

  // Buyer endpoints
  async getBuyerOrders(params: { status?: string; page?: number; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    return this.request(`/api/v1/buyer/orders?${query.toString()}`);
  }

    async getBuyerOrderDetails(orderId: string) {
      return this.request(`/api/v1/buyer/orders/${orderId}`);
    }

    async trackOrder(orderId: string) {
      return this.request(`/api/v1/buyer/orders/track/${orderId}`, { requireAuth: false });
    }

    async getBuyerWallet() {
    return this.request('/api/v1/buyer/wallet');
  }

  async confirmBuyerDelivery(transactionId: string, deliveryOTP: string) {
    return this.request(`/api/v1/buyer/orders/${transactionId}/confirm-delivery`, {
      method: 'POST',
      body: { transactionId, deliveryOTP },
    });
  }

  async openBuyerDispute(data: { transactionId: string; reason: string; description?: string }) {
    return this.request('/api/v1/buyer/disputes', {
      method: 'POST',
      body: data,
    });
  }

  async getBuyerDisputes() {
    return this.request('/api/v1/buyer/disputes');
  }

  async addBuyerDisputeMessage(disputeId: string, message: string) {
    return this.request(`/api/v1/buyer/disputes/${disputeId}/messages`, {
      method: 'POST',
      body: { disputeId, message },
    });
  }

  async getRecommendedSellers() {
    return this.request('/api/v1/buyer/sellers/recommended');
  }

  async getBuyerActivity(page = 1, limit = 20) {
    return this.request(`/api/v1/buyer/activity?page=${page}&limit=${limit}`);
  }
}

const expressApi = new ApiService();
// Default to Supabase so the app runs without starting the backend (set VITE_USE_SUPABASE=false to use Express)
const useSupabase = import.meta.env.VITE_USE_SUPABASE !== "false";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSupabaseBackedApi(express: ApiService): any {
  const stub = {
    ...express,
    createPaymentLink: (data: Parameters<ApiService["createPaymentLink"]>[0]) =>
      supabaseApi.createPaymentLink(data),
    getPaymentLink: (linkId: string) => supabaseApi.getPaymentLink(linkId),
    getMyPaymentLinks: (params?: Parameters<ApiService["getMyPaymentLinks"]>[0]) =>
      supabaseApi.getMyPaymentLinks(params),
    updatePaymentLinkStatus: (linkId: string, status: string) =>
      supabaseApi.updatePaymentLinkStatus(linkId, status),
    restockPaymentLink: (linkId: string, quantity: number) =>
      supabaseApi.restockPaymentLink(linkId, quantity),
    getPaystackConfig: () => supabaseApi.getPaystackConfig(),
    initiatePaystackPayment: (data: Parameters<ApiService["initiatePaystackPayment"]>[0]) =>
      supabaseApi.initiatePaystackPayment(data),
    verifyPaystackPayment: (transactionId: string, reference: string) =>
      supabaseApi.verifyPaystackPayment(transactionId, reference),
    request: async <T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> => {
      const purchaseMatch = endpoint.match(/^\/api\/v1\/links\/([^/]+)\/purchase$/);
      if (purchaseMatch && options?.method === "POST" && options?.body) {
        return supabaseApi.purchasePaymentLink(purchaseMatch[1], options.body as any) as Promise<
          ApiResponse<T>
        >;
      }
      const confirmDeliveryMatch = endpoint.match(/^\/api\/v1\/buyer\/orders\/([^/]+)\/confirm-delivery$/);
      if (confirmDeliveryMatch && options?.method === "POST") {
        return supabaseApi.confirmDelivery(confirmDeliveryMatch[1]) as Promise<ApiResponse<T>>;
      }
      const openDisputeMatch = endpoint === "/api/v1/buyer/disputes" && options?.method === "POST" && options?.body;
      if (openDisputeMatch) {
        const body = options.body as { transactionId: string; reason: string };
        return supabaseApi.openDispute(body.transactionId, body.reason) as Promise<ApiResponse<T>>;
      }
      const disputeMessageMatch = endpoint.match(/^\/api\/v1\/buyer\/disputes\/([^/]+)\/messages$/);
      if (disputeMessageMatch && options?.method === "POST" && options?.body) {
        const body = options.body as { disputeId?: string; message: string };
        return supabaseApi.addBuyerDisputeMessage(disputeMessageMatch[1], body.message ?? (body as any).message) as Promise<ApiResponse<T>>;
      }
      const storefrontCheckoutMatch = endpoint.match(/^\/api\/v1\/storefront\/([^/]+)\/products\/([^/]+)\/checkout$/);
      if (storefrontCheckoutMatch && options?.method === "POST" && options?.body) {
        const body = options.body as { buyerName: string; buyerPhone: string; buyerEmail?: string; buyerAddress?: string; paymentMethod?: string };
        const res = await supabaseApi.createStorefrontCheckout(storefrontCheckoutMatch[1], storefrontCheckoutMatch[2], body);
        if (res.success && res.data) {
          return { success: true, data: { transactionId: (res.data as any).id, id: (res.data as any).id } } as ApiResponse<T>;
        }
        return res as ApiResponse<T>;
      }
      if (endpoint.match(/^\/api\/v1\/seller\/profile\/tax/) && options?.method) {
        return Promise.resolve({ success: false, error: "Not available in Supabase mode" } as ApiResponse<T>);
      }
      return express.request<T>(endpoint, options);
    },
    trackOrder: (orderId: string) => supabaseApi.getTransaction(orderId),
    getMyStore: () => supabaseApi.getMyStore(),
    getSellerOrders: (params?: { status?: string; page?: number; limit?: number }) => supabaseApi.getSellerOrders(params),
    getSellerStats: () => supabaseApi.getSellerStats(),
    acceptOrder: (id: string) => supabaseApi.acceptOrder(id),
    rejectOrder: (id: string, reason?: string) => supabaseApi.rejectOrder(id, reason),
    addShippingInfo: (id: string, data: { courierName: string; trackingNumber: string; estimatedDeliveryDate?: string; notes?: string }) => supabaseApi.addShippingInfo(id, data),
    createProduct: (data: { name: string; description?: string; price: number; images?: string[] }) => supabaseApi.createProduct(data),
    listDraftProducts: () => supabaseApi.listDraftProducts(),
    listPublishedProducts: () => supabaseApi.listPublishedProducts(),
    createStore: (data: { name: string; slug: string }) => supabaseApi.createStore(data),
    updateStore: (data: { name?: string; slug?: string; logo?: string; bio?: string; visibility?: "private" | "public" }) => supabaseApi.updateStore(data),
    updateStoreStatus: (status: "INACTIVE" | "ACTIVE" | "FROZEN") => supabaseApi.updateStoreStatus(status),
    getStoreReadiness: () => express.request('/api/v1/store/readiness'),
    listSocialAccounts: () => supabaseApi.listSocialAccounts(),
    connectSocialPage: (data: { platform: "INSTAGRAM" | "FACEBOOK" | "LINKEDIN"; pageUrl: string; pageId?: string }) => supabaseApi.connectSocialPage(data),
    getWallet: () => supabaseApi.getWallet(),
    getPaymentMethods: () => supabaseApi.getPaymentMethods(),
    addPaymentMethod: (data: { type: string; provider: string; accountNumber: string; accountName: string; isDefault?: boolean }) => supabaseApi.addPaymentMethod(data),
    requestWithdrawal: (amount: number, id: string) => supabaseApi.requestWithdrawal(amount, id),
    getBuyerOrders: (params?: { status?: string; page?: number; limit?: number }) => supabaseApi.getBuyerOrders(params),
    getBuyerWallet: () => supabaseApi.getBuyerWallet(),
    getBuyerDisputes: () => supabaseApi.getBuyerDisputes(),
    confirmDelivery: (id: string) => supabaseApi.confirmDelivery(id),
    openDispute: (id: string, reason: string) => supabaseApi.openDispute(id, reason),
    createTransaction: (data: { itemName: string; amount: number; description?: string; images?: string[] }) => supabaseApi.createTransaction(data),
    getTransaction: (id: string) => supabaseApi.getTransaction(id),
    initiatePayment: (id: string, data: { paymentMethod: string; phone: string; buyerName?: string; buyerEmail?: string }) => supabaseApi.initiatePayment(id, data),
    updateProductDetails: (id: string, data: { name?: string; description?: string; price?: number; images?: string[] }) => supabaseApi.updateProduct(id, data),
    publishProduct: (id: string) => supabaseApi.publishProduct(id),
    archiveProduct: (id: string) => supabaseApi.archiveProduct(id),
    deleteProduct: (id: string) => supabaseApi.deleteProduct(id),
    getAdminDashboard: () => supabaseApi.getAdminDashboard(),
    getAdminTransactions: (params?: { page?: number; limit?: number; status?: string }) => supabaseApi.getAdminTransactions(params),
    getAdminDisputes: (params?: { page?: number; limit?: number; status?: string }) => supabaseApi.getAdminDisputes(params),
    getAdminUsers: (params?: { page?: number; limit?: number }) => supabaseApi.getAdminUsers(params),
    resolveDispute: (id: string, data: { resolution: string; winner: "buyer" | "seller" }) => supabaseApi.resolveDispute(id, data),
    deactivateUser: (id: string) => supabaseApi.deactivateUser(id),
    activateUser: (id: string) => supabaseApi.activateUser(id),
    getStorefront: (slug: string) => supabaseApi.getStorefront(slug),
    getPublicProduct: (storeSlug: string, productId: string) => supabaseApi.getPublicProduct(storeSlug, productId),
    getSellerReviews: (params?: { status?: string; rating?: string; product_id?: string; sort?: string; page?: number; limit?: number }) => supabaseApi.getSellerReviews(params ?? {}),
    getSellerReviewAnalytics: (params?: { start_date?: string; end_date?: string; product_id?: string }) => supabaseApi.getSellerReviewAnalytics(params),
    respondToReview: (reviewId: string, response: string) => supabaseApi.respondToReview(reviewId, response),
    updateReviewStatus: (reviewId: string, status: "approved" | "rejected") => supabaseApi.updateReviewStatus(reviewId, status),
    bulkUpdateReviewStatus: (reviewIds: string[], status: "approved" | "rejected") => supabaseApi.bulkUpdateReviewStatus(reviewIds, status),
    getProductReviews: (storeSlug: string, productId: string, params?: { rating?: string; sort?: string; page?: number; limit?: number }) => supabaseApi.getProductReviews(storeSlug, productId, params),
    getProductReviewSummary: (storeSlug: string, productId: string) => supabaseApi.getProductReviewSummary(storeSlug, productId),
    getFinancialDashboard: (period?: string) => supabaseApi.getFinancialDashboard(period),
    getFinancialExpenses: (params?: { category?: string; start_date?: string; end_date?: string; page?: number; limit?: number }) => supabaseApi.getFinancialExpenses(params),
    createExpense: (data: { amount: number; category: string; description: string; vendor_name?: string; expense_date: string; is_tax_deductible?: boolean }) => supabaseApi.createExpense(data),
    updateExpense: (id: string, updates: Partial<{ amount: number; category: string; description: string; vendor_name: string; expense_date: string }>) => supabaseApi.updateExpense(id, updates),
    deleteExpense: (id: string) => supabaseApi.deleteExpense(id),
    getProfitLossReport: (params?: { start_date?: string; end_date?: string }) => supabaseApi.getProfitLossReport(params),
    getTaxReport: (params?: { year?: number; quarter?: string }) => supabaseApi.getTaxReport(params),
    getReviewableOrders: (storeSlug: string, productId: string) => supabaseApi.getReviewableOrders(storeSlug, productId),
    submitProductReview: (storeSlug: string, productId: string, data: { order_id: string; rating: number; title?: string; content: string; images?: string[] }) => supabaseApi.submitProductReview(storeSlug, productId, data),
    markReviewHelpful: (reviewId: string, isHelpful: boolean) => supabaseApi.markReviewHelpful(reviewId, isHelpful),
    reportReview: (reviewId: string, reason: string, description?: string) => supabaseApi.reportReview(reviewId, reason, description),
    getRequestableOrders: () => supabaseApi.getRequestableOrders(),
    sendReviewRequests: (orderIds: string[], sendVia?: string, delayDays?: number) => supabaseApi.sendReviewRequests(orderIds, sendVia, delayDays),
    getReviewAutoRequestConfig: () => supabaseApi.getReviewAutoRequestConfig(),
    updateReviewAutoRequestConfig: (data: { enabled?: boolean; delay_days?: number; send_via?: string }) => supabaseApi.updateReviewAutoRequestConfig(data),
    getChatConversations: (params?: { status?: string; assigned_to?: string; page?: number; limit?: number }) => supabaseApi.getChatConversations(params),
    getChatConversation: (id: string) => supabaseApi.getChatConversation(id),
    sendChatMessage: (conversationId: string, message: string) => supabaseApi.sendChatMessage(conversationId, message),
    assignChatConversation: (conversationId: string, agentId: string | null) => supabaseApi.assignChatConversation(conversationId, agentId),
    updateChatConversationStatus: (conversationId: string, status: string) => supabaseApi.updateChatConversationStatus(conversationId, status),
    markChatMessagesRead: (conversationId: string) => supabaseApi.markChatMessagesRead(conversationId),
    rateChatConversation: (conversationId: string, rating: number, feedback?: string) => supabaseApi.rateChatConversation(conversationId, rating, feedback),
    getChatAgents: () => supabaseApi.getChatAgents(),
    updateChatAgentStatus: (status: string, statusMessage?: string) => supabaseApi.updateChatAgentStatus(status, statusMessage),
    getChatCannedResponses: () => supabaseApi.getChatCannedResponses(),
    createChatCannedResponse: (data: { title: string; content: string; shortcut?: string; category?: string }) => supabaseApi.createChatCannedResponse(data),
    updateChatCannedResponse: (id: number, data: Partial<{ title: string; content: string; shortcut: string; category: string }>) => supabaseApi.updateChatCannedResponse(id, data),
    deleteChatCannedResponse: (id: number) => supabaseApi.deleteChatCannedResponse(id),
    getChatWidgetSettings: () => supabaseApi.getChatWidgetSettings(),
    updateChatWidgetSettings: (settings: Record<string, unknown>) => supabaseApi.updateChatWidgetSettings(settings),
    getChatbotFlows: () => supabaseApi.getChatbotFlows(),
    createChatbotFlow: (data: { name: string; description?: string; trigger_type: string; trigger_value?: string; flow_data: object }) => supabaseApi.createChatbotFlow(data),
    getChatAnalytics: (params?: { start_date?: string; end_date?: string }) => supabaseApi.getChatAnalytics(params),
    getEmailCampaigns: (params?: { status?: string; page?: number; limit?: number }) => supabaseApi.getEmailCampaigns(params),
    createEmailCampaign: (data: any) => supabaseApi.createEmailCampaign(data),
    getEmailCampaign: (id: string) => supabaseApi.getEmailCampaign(id),
    updateEmailCampaign: (id: string, data: Record<string, unknown>) => supabaseApi.updateEmailCampaign(id, data),
    getAbandonedCarts: (params?: { status?: string; page?: number; limit?: number }) => supabaseApi.getAbandonedCarts(params),
    getAbandonedCartAnalytics: () => supabaseApi.getAbandonedCartAnalytics(),
    sendCartRecoveryEmail: (cartId: string, includeDiscount?: boolean) => supabaseApi.sendCartRecoveryEmail(cartId, includeDiscount),
    getDiscountCodes: () => supabaseApi.getDiscountCodes(),
    createDiscountCode: (data: any) => supabaseApi.createDiscountCode(data),
    updateDiscountCode: (id: string, data: Record<string, unknown>) => supabaseApi.updateDiscountCode(id, data),
    deleteDiscountCode: (id: string) => supabaseApi.deleteDiscountCode(id),
    getMarketingSettings: () => supabaseApi.getMarketingSettings(),
    updateMarketingSettings: (settings: Record<string, unknown>) => supabaseApi.updateMarketingSettings(settings),
    getMarketingWorkflows: () => supabaseApi.getMarketingWorkflows(),
    createMarketingWorkflow: (data: any) => supabaseApi.createMarketingWorkflow(data),
    getMarketingSegments: () => supabaseApi.getMarketingSegments(),
    sendStoreChatMessage: (storeSlug: string, message: string, customerName?: string, customerEmail?: string) => supabaseApi.sendStoreChatMessage(storeSlug, message, customerName, customerEmail),
    getProductCategories: () => supabaseApi.getProductCategories(),
    createProductCategory: (data: { name: string; parent_id?: number; description?: string; image_url?: string; seo_title?: string; seo_description?: string }) => supabaseApi.createProductCategory(data),
    bulkUpdateProducts: (productIds: string[], updates: Record<string, unknown>) => supabaseApi.bulkUpdateProducts(productIds, updates),
    bulkDeleteProducts: (productIds: string[]) => supabaseApi.bulkDeleteProducts(productIds),
    getProducts: (params?: any) => supabaseApi.getProducts(params),
    getProduct: (productId: string) => supabaseApi.getProduct(productId),
    createProductFull: (data: { name: string; description?: string; short_description?: string; price: number; compare_at_price?: number; cost?: number; sku?: string; barcode?: string; quantity?: number; low_stock_threshold?: number; category_id?: number; brand?: string; tags?: string[]; product_type?: string; status?: string; images?: string[]; videos?: string[]; seo_title?: string; seo_description?: string; requires_shipping?: boolean; weight?: number; is_featured?: boolean }) => supabaseApi.createProductFull(data),
    updateProductFull: (productId: string, data: Record<string, unknown>) => supabaseApi.updateProductFull(productId, data),
    duplicateProduct: (productId: string) => supabaseApi.duplicateProduct(productId),
    getProductVariants: (productId: string) => supabaseApi.getProductVariants(productId),
    createProductVariant: (productId: string, data: { options: Record<string, string>; price?: number; compare_at_price?: number; cost?: number; quantity?: number; sku?: string; image_url?: string }) => supabaseApi.createProductVariant(productId, data),
    updateProductVariant: (productId: string, variantId: string, data: Record<string, unknown>) => supabaseApi.updateProductVariant(productId, variantId, data),
    deleteProductVariant: (productId: string, variantId: string) => supabaseApi.deleteProductVariant(productId, variantId),
    exportProducts: () => supabaseApi.exportProducts(),
    startProductImport: (fileUrl: string, fileName: string, fileSize?: number) => supabaseApi.startProductImport(fileUrl, fileName, fileSize),
    getProductImportJob: (jobId: string) => supabaseApi.getProductImportJob(jobId),
    getProductAnalytics: (productId: string, params?: { start_date?: string; end_date?: string }) => supabaseApi.getProductAnalytics(productId, params),
    getInventoryDashboard: () => supabaseApi.getInventoryDashboard(),
    getInventoryLevels: (params?: { location_id?: number; low_stock_only?: boolean }) => supabaseApi.getInventoryLevels(params),
    adjustInventory: (data: { product_id?: string; variant_id?: string; location_id?: number; quantity_change: number; adjustment_type?: string; reason?: string; notes?: string }) => supabaseApi.adjustInventory(data),
    getInventoryLocations: () => supabaseApi.getInventoryLocations(),
    createInventoryLocation: (data: { name: string; code?: string; address_line1?: string; address_line2?: string; city?: string; state?: string; postal_code?: string; country?: string; contact_name?: string; contact_email?: string; contact_phone?: string; is_default?: boolean; location_type?: string }) => supabaseApi.createInventoryLocation(data),
    getReorderRecommendations: () => supabaseApi.getReorderRecommendations(),
    getInventoryTransfers: () => supabaseApi.getInventoryTransfers(),
    createInventoryTransfer: (data: { from_location_id: number; to_location_id: number; items: { product_id: string; variant_id?: string; quantity: number }[]; notes?: string }) => supabaseApi.createInventoryTransfer(data),
    getInventorySuppliers: () => supabaseApi.getInventorySuppliers(),
    createInventorySupplier: (data: { name: string; code?: string; contact_name?: string; email?: string; phone?: string; website?: string; address_line1?: string; city?: string; state?: string; country?: string; payment_terms?: string; lead_time_days?: number; minimum_order_value?: number; notes?: string }) => supabaseApi.createInventorySupplier(data),
    createPurchaseOrder: (data: { supplier_id?: number; location_id?: number; items: { product_id: string; variant_id?: string; quantity: number; unit_cost?: number }[]; po_number?: string; order_date?: string; expected_date?: string; payment_terms?: string; notes?: string }) => supabaseApi.createPurchaseOrder(data),
    getInventoryAdjustments: (params?: { product_id?: string; start_date?: string; end_date?: string }) => supabaseApi.getInventoryAdjustments(params),
    getCustomers: (params?: { page?: number; limit?: number; search?: string; segment_id?: string; tags?: string[]; sort?: string; order?: "asc" | "desc" }) => supabaseApi.getCustomers(params),
    getCustomer: (customerId: string) => supabaseApi.getCustomer(customerId),
    createCustomer: (data: { email?: string; phone?: string; first_name?: string; last_name?: string; tags?: string[]; notes?: string }) => supabaseApi.createCustomer(data),
    updateCustomer: (customerId: string, data: Record<string, unknown>) => supabaseApi.updateCustomer(customerId, data),
    deleteCustomer: (customerId: string) => supabaseApi.deleteCustomer(customerId),
    getCustomerOrders: (customerId: string) => supabaseApi.getCustomerOrders(customerId),
    getCustomerSegments: () => supabaseApi.getCustomerSegments(),
    createCustomerSegment: (data: { name: string; description?: string; segment_type?: string; conditions?: Record<string, unknown>; is_dynamic?: boolean }) => supabaseApi.createCustomerSegment(data),
    getCustomerAnalytics: () => supabaseApi.getCustomerAnalytics(),
    exportCustomers: () => supabaseApi.exportCustomers(),
    getLoyaltyProgram: () => supabaseApi.getLoyaltyProgram(),
    upsertLoyaltyProgram: (data: { name: string; description?: string; points_per_dollar?: number; welcome_bonus_points?: number; birthday_bonus_points?: number; referral_points?: number; review_points?: number; points_value?: number; minimum_redemption_points?: number; tiers?: unknown; is_active?: boolean }) => supabaseApi.upsertLoyaltyProgram(data),
    syncCustomersFromTransactions: () => supabaseApi.syncCustomersFromTransactions(),
    getStoreSettings: () => supabaseApi.getStoreSettings(),
    updateStoreSettingsGeneral: (data: Record<string, unknown>) => supabaseApi.updateStoreSettingsGeneral(data),
    getStoreTheme: () => supabaseApi.getStoreTheme(),
    updateStoreTheme: (data: Record<string, unknown>) => supabaseApi.updateStoreTheme(data),
    getStoreDomains: () => supabaseApi.getStoreDomains(),
    addStoreDomain: (domain: string) => supabaseApi.addStoreDomain(domain),
    getStoreSEOSettings: () => supabaseApi.getStoreSEOSettings(),
    updateStoreSEOSettings: (data: Record<string, unknown>) => supabaseApi.updateStoreSEOSettings(data),
    getStorePaymentSettings: () => supabaseApi.getStorePaymentSettings(),
    updateStorePaymentSettings: (data: Record<string, unknown>) => supabaseApi.updateStorePaymentSettings(data),
    getStoreShippingSettings: () => supabaseApi.getStoreShippingSettings(),
    updateStoreShippingSettings: (data: Record<string, unknown>) => supabaseApi.updateStoreShippingSettings(data),
    getStoreShippingZones: () => supabaseApi.getStoreShippingZones(),
    createStoreShippingZone: (data: { name: string; countries?: string[]; states?: string[]; rates?: unknown[] }) => supabaseApi.createStoreShippingZone(data),
    getStoreTaxSettings: () => supabaseApi.getStoreTaxSettings(),
    updateStoreTaxSettings: (data: Record<string, unknown>) => supabaseApi.updateStoreTaxSettings(data),
    createStoreTaxRate: (data: { name: string; country: string; state?: string; rate: number }) => supabaseApi.createStoreTaxRate(data),
    getStoreIntegrations: () => supabaseApi.getStoreIntegrations(),
    getStoreEmailTemplates: () => supabaseApi.getStoreEmailTemplates(),
    getStoreLegalPages: () => supabaseApi.getStoreLegalPages(),
    updateStoreLegalPage: (pageType: string, data: { title: string; content: string; slug: string; meta_description?: string; is_published?: boolean }) => supabaseApi.updateStoreLegalPage(pageType, data),
    getStoreWebhooks: () => supabaseApi.getStoreWebhooks(),
    createStoreWebhook: (data: { url: string; events: string[] }) => supabaseApi.createStoreWebhook(data),
    getAnalyticsDashboard: () => supabaseApi.getAnalyticsDashboard(),
    getAnalyticsRealtime: () => supabaseApi.getAnalyticsRealtime(),
    getAnalyticsRevenue: (params?: { period?: string }) => supabaseApi.getAnalyticsRevenue(params),
    getAnalyticsProducts: () => supabaseApi.getAnalyticsProducts(),
    getAnalyticsCustomers: () => supabaseApi.getAnalyticsCustomers(),
    getAnalyticsCustomerCohorts: () => supabaseApi.getAnalyticsCustomerCohorts(),
    getAnalyticsTraffic: (params?: { period?: string }) => supabaseApi.getAnalyticsTraffic(params),
    getAnalyticsForecast: (params?: { horizon?: string }) => supabaseApi.getAnalyticsForecast(params),
    generateAnalyticsForecast: (params?: { horizon_days?: number }) => supabaseApi.generateAnalyticsForecast(params),
    getAnalyticsInsights: (params?: { unread_only?: boolean }) => supabaseApi.getAnalyticsInsights(params),
    markAnalyticsInsightRead: (insightId: string) => supabaseApi.markAnalyticsInsightRead(insightId),
    getAnalyticsReports: () => supabaseApi.getAnalyticsReports(),
    createAnalyticsReport: (data: any) => supabaseApi.createAnalyticsReport(data),
    exportAnalyticsReport: (data: any) => supabaseApi.exportAnalyticsReport(data),
    getSupportTickets: (params?: { status?: string; page?: number; limit?: number }) => supabaseApi.getSupportTickets(params),
    createSupportTicket: (data: { subject: string; description?: string; category?: string; subcategory?: string; priority?: string; message?: string }) => supabaseApi.createSupportTicket(data),
    getSupportTicket: (ticketId: string) => supabaseApi.getSupportTicket(ticketId),
    addSupportMessage: (ticketId: string, message: string) => supabaseApi.addSupportMessage(ticketId, message),
    replyToSupportTicket: (ticketId: string, message: string) => supabaseApi.replyToSupportTicket(ticketId, message),
    closeSupportTicket: (ticketId: string) => supabaseApi.closeSupportTicket(ticketId),
    rateSupportTicket: (ticketId: string, rating: number, comment?: string) => supabaseApi.rateSupportTicket(ticketId, rating, comment),
    getAccountManager: () => supabaseApi.getAccountManager(),
    getAccountManagerMeetings: () => supabaseApi.getAccountManagerMeetings(),
    requestAccountManagerMeeting: (data: { title: string; description?: string; preferred_date?: string; meeting_type?: string }) => supabaseApi.requestAccountManagerMeeting(data),
    searchKnowledgeBase: (params?: { q?: string; category?: string; limit?: number }) => supabaseApi.searchKnowledgeBase(params),
    getKBCategories: () => supabaseApi.getKBCategories(),
    getKBArticle: (slug: string) => supabaseApi.getKBArticle(slug),
    submitArticleFeedback: (articleId: string, helpful: boolean) => supabaseApi.submitArticleFeedback(articleId, helpful),
    startSupportChat: (sessionType?: "text" | "video") => supabaseApi.startSupportChat(sessionType),
    getSupportChatSession: (sessionId: string) => supabaseApi.getSupportChatSession(sessionId),
    endSupportChatSession: (sessionId: string, rating?: number, feedback?: string) => supabaseApi.endSupportChatSession(sessionId, rating, feedback),
    getOnboardingChecklist: () => supabaseApi.getOnboardingChecklist(),
    completeOnboardingStep: (step: string) => supabaseApi.completeOnboardingStep(step),
    getSupportResources: (params?: { category?: string; type?: string }) => supabaseApi.getSupportResources(params),
    getSystemStatus: () => supabaseApi.getSystemStatus(),
    getProductQuestions: (storeSlug: string, productId: string) => supabaseApi.getProductQuestions(storeSlug, productId),
    askProductQuestion: (storeSlug: string, productId: string, question: string) => supabaseApi.askProductQuestion(storeSlug, productId, question),
    getSellerQuestions: () => supabaseApi.getSellerQuestions(),
    answerProductQuestion: (questionId: string, answer: string) => supabaseApi.answerProductQuestion(questionId, answer),
    getBuyerOrderDetails: (orderId: string) => supabaseApi.getTransaction(orderId),
    confirmBuyerDelivery: (transactionId: string, _deliveryOTP: string) => supabaseApi.confirmDelivery(transactionId),
    openBuyerDispute: (data: { transactionId: string; reason: string; description?: string }) => supabaseApi.openDispute(data.transactionId, data.reason),
    addBuyerDisputeMessage: (disputeId: string, message: string) => supabaseApi.addBuyerDisputeMessage(disputeId, message),
    // Stubs so UI doesn't hit Express and break (not yet in Supabase Edge Functions)
    triggerStoreRescan: () => Promise.resolve({ success: false, error: "Not available in Supabase mode" }),
    rescanSocialPage: () => Promise.resolve({ success: false, error: "Not available in Supabase mode" }),
    adminListStores: () => Promise.resolve({ success: true, data: [] }),
    adminListSocialAccounts: () => Promise.resolve({ success: true, data: [] }),
    adminListSyncLogs: () => Promise.resolve({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0 } }),
    adminFreezeStore: () => Promise.resolve({ success: false, error: "Not available in Supabase mode" }),
    adminDisableProduct: () => Promise.resolve({ success: false, error: "Not available in Supabase mode" }),
  };
  return stub;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api: any = useSupabase ? createSupabaseBackedApi(expressApi) : expressApi;
