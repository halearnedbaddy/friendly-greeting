/**
 * Supabase API Service
 * Replaces the old backend API with direct Supabase calls
 */
// Use the same Supabase client as auth flows so session/auth headers are consistent
import { supabase } from "@/lib/supabase";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseProject";

// Database enum types (lowercase as defined in Supabase schema)
type TransactionStatusDb =
  | "pending"
  | "processing"
  | "paid"
  | "accepted"
  | "shipped"
  | "delivered"
  | "completed"
  | "disputed"
  | "cancelled"
  | "refunded"
  | "expired";

type StoreStatusDb = "inactive" | "active" | "frozen";
type ProductStatusDb = "draft" | "published" | "archived";
type SocialPlatformDb = "instagram" | "facebook" | "linkedin";

function toLowerEnum<T extends string>(value: string): T {
  return value.trim().toLowerCase().replace(/ /g, '_') as T;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function callEdgeFunction<T>(
  functionName: string,
  path: string = "",
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    params?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, params } = options;
  const headers = await getAuthHeaders();

  let url = `${SUPABASE_URL}/functions/v1/${functionName}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const rawText = await response.text();
    if (!rawText.trim()) {
      return {
        success: false,
        error: response.ok ? "Empty response" : `Request failed (${response.status})`,
        code: "EMPTY_RESPONSE",
      } as ApiResponse<T>;
    }
    try {
      const data = JSON.parse(rawText) as ApiResponse<T>;
      if (!response.ok && data && typeof data === "object" && "success" in data && data.success === false) {
        return { ...data, success: false, error: (data as { error?: string }).error ?? `Request failed (${response.status})` } as ApiResponse<T>;
      }
      return data;
    } catch {
      return {
        success: false,
        error: response.ok ? "Invalid response" : `Request failed (${response.status})`,
        code: "INVALID_RESPONSE",
      } as ApiResponse<T>;
    }
  } catch (error) {
    console.error(`Edge function error (${functionName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
      code: "NETWORK_ERROR",
    } as ApiResponse<T>;
  }
}

// ==================== BUYER API ====================

export async function getBuyerOrders(params: { status?: string; page?: number; limit?: number } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const page = params.page || 1;
  const limit = params.limit || 20;

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("buyer_id", session.user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (params.status) {
    query = query.eq("status", toLowerEnum<TransactionStatusDb>(params.status));
  }

  const { data, error, count } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Transform to match expected format
  const orders = (data || []).map((tx: any) => ({
    id: tx.id,
    itemName: tx.item_name,
    amount: tx.amount,
    status: tx.status,
    seller: tx.seller || { name: "Unknown", phone: "" },
    createdAt: tx.created_at,
    updatedAt: tx.updated_at,
  }));

  return {
    success: true,
    data: orders,
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
}

export async function getBuyerWallet() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: wallet, error } = await (supabase as any)
    .from("wallets")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  // Get transaction count
  const { count: txCount } = await (supabase as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("buyer_id", session.user.id);

  return {
    success: true,
    data: {
      availableBalance: (wallet as any)?.available_balance || 0,
      pendingBalance: (wallet as any)?.pending_balance || 0,
      totalSpent: (wallet as any)?.total_spent || 0,
      totalTransactions: txCount || 0,
    },
  };
}

export async function getBuyerDisputes() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  // Disputes table may not exist yet - return empty array gracefully
  try {
    const { data, error } = await (supabase as any)
      .from("disputes")
      .select("*, transactions(*)")
      .eq("opened_by_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      // Table doesn't exist - return empty
      console.warn("Disputes query failed (table may not exist):", error.message);
      return { success: true, data: [] };
    }
    const disputes = (data || []).map((d: any) => ({
      id: d.id,
      transactionId: d.transaction_id,
      status: d.status,
      reason: d.reason,
      transaction: d.transactions ? {
        itemName: d.transactions.item_name,
        amount: d.transactions.amount,
        seller: { name: "Seller" },
      } : null,
      createdAt: d.created_at,
    }));

    return { success: true, data: disputes };
  } catch (err) {
    console.warn("Disputes query failed:", err);
    return { success: true, data: [] };
  }
}

export async function confirmDelivery(transactionId: string) {
  return callEdgeFunction("transaction-api", `/${transactionId}/deliver`, {
    method: "POST",
  });
}

export async function addBuyerDisputeMessage(disputeId: string, message: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { error } = await (supabase as any)
    .from("dispute_messages")
    .insert({
      dispute_id: disputeId,
      sender_id: session.user.id,
      message,
      is_admin: false,
    });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function openDispute(transactionId: string, reason: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("disputes")
    .insert({
      reason,
      opened_by: session.user.id,
      status: "open" as any,
      transaction_id: transactionId,
    } as any)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Update transaction status
  await supabase
    .from("transactions")
    .update({ status: "disputed" as TransactionStatusDb })
    .eq("id", transactionId);

  return { success: true, data };
}

// ==================== SELLER API ====================

export async function getSellerOrders(params: { status?: string; page?: number; limit?: number } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const page = params.page || 1;
  const limit = params.limit || 20;

  // First get the seller's account_id for the OR query
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const accountId = (account as any)?.id;

  // Build filter: transactions where this user is the seller (by user id OR account id)
  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .or(
      accountId
        ? `seller_id.eq.${session.user.id},account_id.eq.${accountId}`
        : `seller_id.eq.${session.user.id}`
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (params.status && params.status !== 'all') {
    // Use lowercase to match DB schema
    const statusVal = params.status.toLowerCase();
    query = query.eq("status", statusVal);
  }

  const { data, error, count } = await query;

  console.log("[SellerDashboard] Raw Supabase orders response:", { 
    userId: session.user.id,
    accountId,
    data,
    error, 
    count,
    statusFilter: params.status || 'none'
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const orders = (data || []).map((tx: any) => ({
    id: tx.id,
    itemName: tx.item_name,
    amount: tx.amount,
    status: tx.status,
    buyer: {
      id: tx.buyer_id || "",
      name: tx.buyer_name || "Guest",
      phone: tx.buyer_phone || "",
    },
    buyerName: tx.buyer_name,
    buyerPhone: tx.buyer_phone,
    buyerEmail: tx.buyer_email,
    createdAt: tx.created_at,
    updatedAt: tx.updated_at,
    acceptedAt: tx.accepted_at,
    shippedAt: tx.shipped_at,
    courierName: tx.courier_name,
    trackingNumber: tx.tracking_number,
    shippingInfo: tx.courier_name ? {
      courierName: tx.courier_name,
      trackingNumber: tx.tracking_number,
      estimatedDelivery: tx.estimated_delivery_date,
    } : undefined,
  }));

  return {
    success: true,
    data: orders,
    pagination: { page, limit, total: count || 0 },
  };
}

export async function getSellerStats() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const userId = session.user.id;

  // Get all orders for this seller
  const { data: orders } = await supabase
    .from("transactions")
    .select("status, amount")
    .eq("seller_id", userId);

  // Get wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Get seller profile from profiles table
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("name, business_name, rating, total_reviews")
    .eq("user_id", userId)
    .maybeSingle();

  console.log("[SellerDashboard] Raw stats:", { orders: orders?.length, wallet, sellerProfile });

  const orderList = orders || [];
  const total = orderList.length;
  const completed = orderList.filter((o: any) => o.status === "completed" || o.status === "delivered").length;
  const pending = orderList.filter((o: any) => o.status === "pending" || o.status === "paid").length;
  const disputed = orderList.filter((o: any) => o.status === "disputed").length;

  return {
    success: true,
    data: {
      totalOrders: total,
      completedOrders: completed,
      pendingOrders: pending,
      disputedOrders: disputed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      disputeRate: total > 0 ? (disputed / total) * 100 : 0,
      wallet: {
        availableBalance: wallet?.available_balance || 0,
        pendingBalance: wallet?.pending_balance || 0,
        totalEarned: wallet?.total_earned || 0,
      },
      profile: sellerProfile
        ? {
            businessName: (sellerProfile as any)?.business_name || '',
            rating: (sellerProfile as any).rating,
            totalReviews: (sellerProfile as any).total_reviews,
          }
        : undefined,
    },
  };
}

export async function acceptOrder(orderId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  return callEdgeFunction("transaction-api", `/${orderId}/accept`, {
    method: "POST",
  });
}

export async function rejectOrder(orderId: string, reason?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  return callEdgeFunction("transaction-api", `/${orderId}/reject`, {
    method: "POST",
    body: { reason: reason || "Seller rejected order" },
  });
}

export async function addShippingInfo(orderId: string, data: {
  courierName: string;
  trackingNumber: string;
  estimatedDeliveryDate?: string;
  notes?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: updated, error } = await supabase
    .from("transactions")
    .update({
      status: "shipped",
      courier_name: data.courierName,
      tracking_number: data.trackingNumber,
      estimated_delivery_date: data.estimatedDeliveryDate,
      shipping_notes: data.notes,
      shipped_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: updated };
}

// ==================== STORE API ====================

export async function getMyStore() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store, error } = await supabase
    .from("stores")
    .select("*, social_accounts(*)")
    .eq("seller_id", session.user.id)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: store };
}

export async function createStore(data: { name: string; slug: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store, error } = await supabase
    .from("stores")
    .insert([{
      seller_id: session.user.id,
      name: data.name,
      slug: data.slug,
      status: "active" as StoreStatusDb,
      visibility: "public",
    }])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: store };
}

export async function updateStore(data: {
  name?: string;
  slug?: string;
  logo?: string;
  bio?: string;
  visibility?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store, error } = await supabase
    .from("stores")
    .update({
      ...(data.name && { name: data.name }),
      ...(data.slug && { slug: data.slug }),
      ...(data.logo !== undefined && { logo: data.logo }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.visibility && { visibility: data.visibility }),
      updated_at: new Date().toISOString(),
    })
    .eq("seller_id", session.user.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: store };
}

export async function updateStoreStatus(status: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const statusDb = String(status).trim().toLowerCase() as StoreStatusDb;

  const { data: store, error } = await supabase
    .from("stores")
    .update({ status: statusDb, updated_at: new Date().toISOString() })
    .eq("seller_id", session.user.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: store };
}

// ==================== WALLET & PAYMENT METHODS ====================

export async function getWallet() {
  // wallet-api requires Authorization: Bearer <access_token>.
  // If the user is not logged in (no session), calling the function will always return 401.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  return callEdgeFunction("wallet-api", "/");
}

export async function getPaymentMethods() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data, error } = await (supabase
    .from("payment_methods" as any)
    .select("*")
    .eq("user_id", session.user.id)
    .order("is_default", { ascending: false }) as any);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map((m: any) => ({
    id: m.id,
    type: m.type,
    provider: m.provider,
    accountNumber: m.account_number,
    accountName: m.account_name,
    isDefault: m.is_default,
    isActive: m.is_active,
    country: m.country,
    paymentType: m.payment_type,
    methodName: m.method_name,
  })) };
}

export async function addPaymentMethod(data: {
  type: string;
  provider: string;
  accountNumber: string;
  accountName: string;
  isDefault?: boolean;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  // Map type string to DB enum
  const dbType = data.type === "BANK_TRANSFER" ? "bank_account" : "mobile_money";

  const { error } = await (supabase.from("payment_methods" as any) as any).insert({
    user_id: session.user.id,
    type: dbType,
    provider: data.provider,
    account_number: data.accountNumber,
    account_name: data.accountName,
    is_default: data.isDefault ?? false,
    is_active: true,
    payment_type: data.type,
    method_name: data.provider,
  } as any);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function requestWithdrawal(amount: number, paymentMethodId: string) {
  // wallet-api requires Authorization: Bearer <access_token>
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: "Not authenticated" };
  }

  return callEdgeFunction("wallet-api", "/withdraw", {
    method: "POST",
    body: { amount, paymentMethodId },
  });
}

// ==================== TRANSACTIONS ====================

export async function createTransaction(data: {
  itemName: string;
  amount: number;
  description?: string;
  images?: string[];
}) {
  return callEdgeFunction("transaction-api", "/", {
    method: "POST",
    body: data,
  });
}

export async function getTransaction(id: string) {
  return callEdgeFunction("transaction-api", `/${id}`);
}

export async function initiatePayment(transactionId: string, data: {
  paymentMethod: string;
  phone: string;
  buyerName?: string;
  buyerEmail?: string;
}) {
  return callEdgeFunction("transaction-api", `/${transactionId}/pay`, {
    method: "POST",
    body: data,
  });
}

// ==================== ADMIN API ====================

export async function getAdminDashboard() {
  return callEdgeFunction("admin-api", "/dashboard");
}

export async function getAdminTransactions(params: { page?: number; limit?: number; status?: string } = {}) {
  return callEdgeFunction("admin-api", "/transactions", {
    params: {
      page: String(params.page || 1),
      limit: String(params.limit || 20),
      ...(params.status && { status: params.status }),
    },
  });
}

export async function getAdminDisputes(params: { page?: number; limit?: number; status?: string } = {}) {
  return callEdgeFunction("admin-api", "/disputes", {
    params: {
      page: String(params.page || 1),
      limit: String(params.limit || 20),
      ...(params.status && { status: params.status }),
    },
  });
}

export async function getAdminUsers(params: { page?: number; limit?: number } = {}) {
  return callEdgeFunction("admin-api", "/users", {
    params: {
      page: String(params.page || 1),
      limit: String(params.limit || 20),
    },
  });
}

export async function resolveDispute(disputeId: string, data: { resolution: string; winner: "buyer" | "seller" }) {
  return callEdgeFunction("admin-api", `/disputes/${disputeId}/resolve`, {
    method: "POST",
    body: data,
  });
}

export async function deactivateUser(userId: string) {
  return callEdgeFunction("admin-api", `/users/${userId}/deactivate`, {
    method: "POST",
  });
}

export async function activateUser(userId: string) {
  return callEdgeFunction("admin-api", `/users/${userId}/activate`, {
    method: "POST",
  });
}

// ==================== SOCIAL ACCOUNTS ====================

export async function listSocialAccounts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", session.user.id)
    .maybeSingle();

  if (!store) {
    return { success: true, data: [] };
  }

  const { data, error } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("store_id", store.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function connectSocialPage(data: {
  platform: string;
  pageUrl: string;
  pageId?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", session.user.id)
    .maybeSingle();

  if (!store) {
    return { success: false, error: "Create a store first" };
  }

  const { data: account, error } = await supabase
    .from("social_accounts")
    .insert([{
      store_id: store.id,
      platform: toLowerEnum<SocialPlatformDb>(data.platform),
      page_url: data.pageUrl,
      page_id: data.pageId,
    }])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: account };
}

// ==================== PAYMENT LINKS (Edge: links-api) ====================

export async function createPaymentLink(data: {
  productName: string;
  productDescription?: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  customerPhone?: string;
  currency?: string;
  quantity?: number;
  expiryHours?: number;
}) {
  return callEdgeFunction<{
    id: string;
    productName: string;
    price: number;
    linkUrl: string;
    createdAt: string;
  }>("links-api", "", {
    method: "POST",
    body: data,
  });
}

export async function getPaymentLink(linkId: string) {
  return callEdgeFunction("links-api", `/${linkId}`, { method: "GET" });
}

export async function getMyPaymentLinks(params: { status?: string; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  const path = `/seller/my-links${search.toString() ? `?${search.toString()}` : ""}`;
  return callEdgeFunction("links-api", path);
}

export async function updatePaymentLinkStatus(linkId: string, status: string) {
  return callEdgeFunction("links-api", `/${linkId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function restockPaymentLink(linkId: string, quantity: number) {
  return callEdgeFunction("links-api", `/${linkId}/restock`, {
    method: "PATCH",
    body: { quantity },
  });
}

export async function purchasePaymentLink(
  linkId: string,
  body: {
    buyerPhone: string;
    buyerEmail?: string;
    deliveryAddress?: string;
    paymentMethod?: string;
    buyerCurrency?: string;
    quantity?: number;
    buyerName?: string;
  }
) {
  return callEdgeFunction<{ id: string; transactionId: string }>("links-api", `/${linkId}/purchase`, {
    method: "POST",
    body,
  });
}

// ==================== STOREFRONT (Edge: storefront-api) ====================

export async function getStorefront(slug: string) {
  return callEdgeFunction("storefront-api", `/store/${encodeURIComponent(slug)}`, { method: "GET" });
}

export async function getPublicProduct(storeSlug: string, productId: string) {
  return callEdgeFunction(
    "storefront-api",
    `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}`,
    { method: "GET" }
  );
}

export async function createStorefrontCheckout(
  storeSlug: string,
  productId: string,
  body: { buyerName: string; buyerPhone: string; buyerEmail?: string; buyerAddress?: string; paymentMethod?: string }
) {
  return callEdgeFunction<{ id: string; transactionId?: string }>(
    "storefront-api",
    `/checkout/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}`,
    { method: "POST", body }
  );
}

// ==================== REVIEWS ====================

export async function getSellerReviews(params: {
  status?: string;
  rating?: string;
  product_id?: string;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.rating) sp.set("rating", params.rating);
  if (params.product_id) sp.set("product_id", params.product_id);
  if (params.sort) sp.set("sort", params.sort || "recent");
  sp.set("page", String(params.page ?? 1));
  sp.set("limit", String(params.limit ?? 50));
  const res = await callEdgeFunction<{ data: { reviews: any[]; pagination: any } }>(
    "store-api",
    `/reviews?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getSellerReviewAnalytics(params?: { start_date?: string; end_date?: string; product_id?: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (params?.start_date) sp.set("start_date", params.start_date);
  if (params?.end_date) sp.set("end_date", params.end_date);
  if (params?.product_id) sp.set("product_id", params.product_id);
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/reviews/analytics?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function respondToReview(reviewId: string, response: string) {
  const res = await callEdgeFunction("store-api", `/reviews/${reviewId}/respond`, {
    method: "POST",
    body: { response },
  });
  if (!res.success) return res;
  return { ...res, data: (res as any).data?.data };
}

export async function updateReviewStatus(reviewId: string, status: "approved" | "rejected") {
  const res = await callEdgeFunction("store-api", `/reviews/${reviewId}/status`, {
    method: "PATCH",
    body: { status },
  });
  if (!res.success) return res;
  return { ...res, data: (res as any).data?.data };
}

export async function bulkUpdateReviewStatus(reviewIds: string[], status: "approved" | "rejected") {
  return callEdgeFunction("store-api", "/reviews/bulk-update", {
    method: "POST",
    body: { review_ids: reviewIds, status },
  });
}

export async function getProductReviews(
  storeSlug: string,
  productId: string,
  params?: { rating?: string; sort?: string; page?: number; limit?: number }
) {
  const sp = new URLSearchParams();
  if (params?.rating) sp.set("rating", params.rating);
  if (params?.sort) sp.set("sort", params.sort || "recent");
  sp.set("page", String(params?.page ?? 1));
  sp.set("limit", String(params?.limit ?? 20));
  const res = await callEdgeFunction<{ data: { reviews: any[]; pagination: any } }>(
    "storefront-api",
    `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}/reviews?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getProductReviewSummary(storeSlug: string, productId: string) {
  const res = await callEdgeFunction<{ data: any }>(
    "storefront-api",
    `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}/reviews/summary`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

// ==================== FINANCIAL ====================

export async function getFinancialDashboard(period?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (period) sp.set("period", period);
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/financial/dashboard?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getFinancialExpenses(params?: {
  category?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (params?.category) sp.set("category", params.category);
  if (params?.start_date) sp.set("start_date", params.start_date);
  if (params?.end_date) sp.set("end_date", params.end_date);
  sp.set("page", String(params?.page ?? 1));
  sp.set("limit", String(params?.limit ?? 50));
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/financial/expenses?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function createExpense(data: {
  amount: number;
  category: string;
  description: string;
  vendor_name?: string;
  expense_date: string;
  is_tax_deductible?: boolean;
}) {
  const res = await callEdgeFunction("store-api", "/financial/expenses", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as any).data?.data };
}

export async function updateExpense(id: string, updates: Partial<{
  amount: number;
  category: string;
  description: string;
  vendor_name: string;
  expense_date: string;
}>) {
  const res = await callEdgeFunction("store-api", `/financial/expenses/${id}`, {
    method: "PATCH",
    body: updates,
  });
  if (!res.success) return res;
  return { ...res, data: (res as any).data?.data };
}

export async function deleteExpense(id: string) {
  return callEdgeFunction("store-api", `/financial/expenses/${id}`, {
    method: "DELETE",
  });
}

export async function getProfitLossReport(params?: { start_date?: string; end_date?: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (params?.start_date) sp.set("start_date", params.start_date);
  if (params?.end_date) sp.set("end_date", params.end_date);
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/financial/reports/profit-loss?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getTaxReport(params?: { year?: number; quarter?: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (params?.year) sp.set("year", String(params.year));
  if (params?.quarter) sp.set("quarter", params.quarter || "");
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/financial/reports/tax?${sp.toString()}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getReviewableOrders(storeSlug: string, productId: string) {
  const res = await callEdgeFunction<{ data: { id: string; created_at: string; item_name?: string }[] }>(
    "storefront-api",
    `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}/reviewable-orders`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

// Review submission (storefront - customer)
export async function submitProductReview(
  storeSlug: string,
  productId: string,
  data: { order_id: string; rating: number; title?: string; content: string; images?: string[] }
) {
  return callEdgeFunction("storefront-api", `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}/review`, {
    method: "POST",
    body: data,
  });
}

export async function markReviewHelpful(reviewId: string, isHelpful: boolean) {
  return callEdgeFunction("storefront-api", `/reviews/${reviewId}/helpful`, {
    method: "POST",
    body: { is_helpful: isHelpful },
  });
}

export async function reportReview(reviewId: string, reason: string, description?: string) {
  return callEdgeFunction("storefront-api", `/reviews/${reviewId}/report`, {
    method: "POST",
    body: { reason, description },
  });
}

export async function getRequestableOrders() {
  const res = await callEdgeFunction<{ data: { id: string; item_name?: string; created_at: string; product_id?: string }[] }>(
    "store-api",
    "/reviews/requestable-orders",
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function sendReviewRequests(orderIds: string[], sendVia = "email", delayDays = 0) {
  return callEdgeFunction("store-api", "/reviews/request", {
    method: "POST",
    body: { order_ids: orderIds, send_via: sendVia, delay_days: delayDays },
  });
}

export async function getReviewAutoRequestConfig() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/reviews/auto-request/config", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function updateReviewAutoRequestConfig(data: {
  enabled?: boolean;
  delay_days?: number;
  send_via?: string;
}) {
  return callEdgeFunction("store-api", "/reviews/auto-request/config", {
    method: "POST",
    body: data,
  });
}

// Live Chat
export async function getChatConversations(params?: { status?: string; assigned_to?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.assigned_to) search.set("assigned_to", params.assigned_to);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any; pagination?: any }>("store-api", `/chat/conversations${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data, pagination: res.data?.pagination };
}

export async function getChatConversation(conversationId: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/chat/conversations/${conversationId}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function sendChatMessage(conversationId: string, message: string) {
  return callEdgeFunction("store-api", `/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { message },
  });
}

export async function assignChatConversation(conversationId: string, agentId: string | null) {
  return callEdgeFunction("store-api", `/chat/conversations/${conversationId}/assign`, {
    method: "PATCH",
    body: { agent_id: agentId },
  });
}

export async function updateChatConversationStatus(conversationId: string, status: string) {
  return callEdgeFunction("store-api", `/chat/conversations/${conversationId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function markChatMessagesRead(conversationId: string) {
  return callEdgeFunction("store-api", `/chat/conversations/${conversationId}/read`, {
    method: "POST",
  });
}

export async function rateChatConversation(conversationId: string, rating: number, feedback?: string) {
  return callEdgeFunction("store-api", `/chat/conversations/${conversationId}/rate`, {
    method: "POST",
    body: { rating, feedback },
  });
}

export async function getChatAgents() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/chat/agents", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function updateChatAgentStatus(status: string, statusMessage?: string) {
  return callEdgeFunction("store-api", "/chat/agents/me/status", {
    method: "PATCH",
    body: { status, status_message: statusMessage },
  });
}

export async function getChatCannedResponses() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/chat/canned-responses", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function createChatCannedResponse(data: { title: string; content: string; shortcut?: string; category?: string }) {
  return callEdgeFunction("store-api", "/chat/canned-responses", {
    method: "POST",
    body: data,
  });
}

export async function updateChatCannedResponse(id: number, data: Partial<{ title: string; content: string; shortcut: string; category: string }>) {
  return callEdgeFunction("store-api", `/chat/canned-responses/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export async function deleteChatCannedResponse(id: number) {
  return callEdgeFunction("store-api", `/chat/canned-responses/${id}`, {
    method: "DELETE",
  });
}

export async function getChatWidgetSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/chat/widget/settings", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function updateChatWidgetSettings(settings: Record<string, unknown>) {
  return callEdgeFunction("store-api", "/chat/widget/settings", {
    method: "PATCH",
    body: settings,
  });
}

export async function getChatbotFlows() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/chat/chatbot/flows", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function createChatbotFlow(data: { name: string; description?: string; trigger_type: string; trigger_value?: string; flow_data: object }) {
  return callEdgeFunction("store-api", "/chat/chatbot/flows", {
    method: "POST",
    body: data,
  });
}

export async function getChatAnalytics(params?: { start_date?: string; end_date?: string }) {
  const search = new URLSearchParams();
  if (params?.start_date) search.set("start_date", params.start_date);
  if (params?.end_date) search.set("end_date", params.end_date);
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any }>("store-api", `/chat/analytics${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

// Marketing
export async function getEmailCampaigns(params?: { status?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any[]; pagination?: any }>("store-api", `/marketing/campaigns/email${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [], pagination: res.data?.pagination };
}

export async function createEmailCampaign(data: {
  name: string;
  subject: string;
  preview_text?: string;
  from_name: string;
  from_email: string;
  reply_to_email?: string;
  html_content?: string;
  plain_text_content?: string;
  segment_id?: string;
}) {
  return callEdgeFunction("store-api", "/marketing/campaigns/email", {
    method: "POST",
    body: data,
  });
}

export async function getEmailCampaign(id: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/marketing/campaigns/email/${id}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function updateEmailCampaign(id: string, data: Record<string, unknown>) {
  return callEdgeFunction("store-api", `/marketing/campaigns/email/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export async function getAbandonedCarts(params?: { status?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any[]; pagination?: any }>("store-api", `/marketing/abandoned-carts${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [], pagination: res.data?.pagination };
}

export async function getAbandonedCartAnalytics() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/marketing/abandoned-carts/analytics", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function sendCartRecoveryEmail(cartId: string, includeDiscount?: boolean) {
  return callEdgeFunction("store-api", `/marketing/abandoned-carts/${cartId}/recover`, {
    method: "POST",
    body: { include_discount: includeDiscount ?? true },
  });
}

export async function getDiscountCodes() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/marketing/discounts", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function createDiscountCode(data: {
  code: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  applies_to?: string;
  applies_to_ids?: string[];
  minimum_purchase_amount?: number;
  usage_limit?: number;
  usage_limit_per_customer?: number;
  valid_from?: string;
  valid_until?: string;
}) {
  return callEdgeFunction("store-api", "/marketing/discounts", {
    method: "POST",
    body: data,
  });
}

export async function updateDiscountCode(id: string, data: Record<string, unknown>) {
  return callEdgeFunction("store-api", `/marketing/discounts/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export async function deleteDiscountCode(id: string) {
  return callEdgeFunction("store-api", `/marketing/discounts/${id}`, {
    method: "DELETE",
  });
}

export async function getMarketingSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/marketing/settings", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function updateMarketingSettings(settings: Record<string, unknown>) {
  return callEdgeFunction("store-api", "/marketing/settings", {
    method: "PATCH",
    body: settings,
  });
}

export async function getMarketingWorkflows() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/marketing/workflows", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function createMarketingWorkflow(data: {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: object;
  steps?: object[];
}) {
  return callEdgeFunction("store-api", "/marketing/workflows", {
    method: "POST",
    body: data,
  });
}

export async function getMarketingSegments() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/marketing/segments", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function sendStoreChatMessage(storeSlug: string, message: string, customerName?: string, customerEmail?: string) {
  return callEdgeFunction("storefront-api", `/store/${encodeURIComponent(storeSlug)}/chat`, {
    method: "POST",
    body: { message, customer_name: customerName, customer_email: customerEmail },
  });
}

// Support - Tickets
export async function getSupportTickets(params?: { status?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any; pagination?: any }>("store-api", `/support/tickets${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data, pagination: res.data?.pagination };
}

export async function createSupportTicket(data: {
  subject: string;
  description?: string;
  category?: string;
  subcategory?: string;
  priority?: string;
  message?: string;
}) {
  return callEdgeFunction("store-api", "/support/tickets", {
    method: "POST",
    body: data,
  });
}

export async function getSupportTicket(ticketId: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/support/tickets/${ticketId}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function addSupportMessage(ticketId: string, message: string) {
  return callEdgeFunction("store-api", `/support/tickets/${ticketId}/messages`, {
    method: "POST",
    body: { message },
  });
}

export async function replyToSupportTicket(ticketId: string, message: string) {
  return callEdgeFunction("store-api", `/support/tickets/${ticketId}/reply`, {
    method: "POST",
    body: { message },
  });
}

export async function closeSupportTicket(ticketId: string) {
  return callEdgeFunction("store-api", `/support/tickets/${ticketId}/close`, { method: "POST" });
}

export async function rateSupportTicket(ticketId: string, rating: number, comment?: string) {
  return callEdgeFunction("store-api", `/support/tickets/${ticketId}/rate`, {
    method: "POST",
    body: { rating, comment },
  });
}

// Support - Account Manager
export async function getAccountManager() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/support/account-manager", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getAccountManagerMeetings() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/support/account-manager/meetings", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function requestAccountManagerMeeting(data: {
  title: string;
  description?: string;
  preferred_date?: string;
  meeting_type?: string;
}) {
  return callEdgeFunction("store-api", "/support/account-manager/meetings/request", {
    method: "POST",
    body: data,
  });
}

// Support - Knowledge Base
export async function searchKnowledgeBase(params?: { q?: string; category?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any[] }>("store-api", `/support/kb/search${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function getKBCategories() {
  const res = await callEdgeFunction<{ data: string[] }>("store-api", "/support/kb/categories", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function getKBArticle(slug: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/support/kb/articles/${encodeURIComponent(slug)}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function submitArticleFeedback(articleId: string, helpful: boolean) {
  return callEdgeFunction("store-api", `/support/kb/articles/${articleId}/feedback`, {
    method: "POST",
    body: { helpful },
  });
}

// Support - Live Chat
export async function startSupportChat(sessionType?: "text" | "video") {
  return callEdgeFunction("store-api", "/support/chat/start", {
    method: "POST",
    body: { session_type: sessionType ?? "text" },
  });
}

export async function getSupportChatSession(sessionId: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/support/chat/sessions/${sessionId}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function endSupportChatSession(sessionId: string, rating?: number, feedback?: string) {
  return callEdgeFunction("store-api", `/support/chat/sessions/${sessionId}/end`, {
    method: "POST",
    body: { rating, feedback },
  });
}

// Support - Onboarding
export async function getOnboardingChecklist() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/support/onboarding", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function completeOnboardingStep(step: string) {
  return callEdgeFunction("store-api", `/support/onboarding/complete/${encodeURIComponent(step)}`, { method: "POST" });
}

// Support - Resources & Status
export async function getSupportResources(params?: { category?: string; type?: string }) {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.type) search.set("type", params.type);
  const qs = search.toString();
  const res = await callEdgeFunction<{ data: any[] }>("store-api", `/support/resources${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function getSystemStatus() {
  const res = await callEdgeFunction<{ data: { overall_status: string; components: any[] } }>("store-api", "/support/status", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

// Product Q&A
export async function getProductQuestions(storeSlug: string, productId: string) {
  const res = await callEdgeFunction<{ data: any }>(
    "storefront-api",
    `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}/questions`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function askProductQuestion(storeSlug: string, productId: string, question: string) {
  return callEdgeFunction("storefront-api", `/product/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productId)}/question`, {
    method: "POST",
    body: { question },
  });
}

export async function getSellerQuestions() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/reviews/questions", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function answerProductQuestion(questionId: string, answer: string) {
  return callEdgeFunction("store-api", `/questions/${questionId}/answer`, {
    method: "POST",
    body: { answer },
  });
}

// ==================== PAYSTACK (Edge: paystack-api) ====================

export async function getPaystackConfig() {
  return callEdgeFunction<{ publicKey: string }>("paystack-api", "/config", { method: "GET" });
}

export async function initiatePaystackPayment(data: {
  transactionId: string;
  email: string;
  metadata?: Record<string, unknown>;
}) {
  return callEdgeFunction<{
    authorization_url: string;
    authorizationUrl?: string;
    access_code: string;
    reference: string;
  }>("paystack-api", "/initialize", {
    method: "POST",
    body: data,
  });
}

export async function verifyPaystackPayment(transactionId: string, reference: string) {
  return callEdgeFunction("paystack-api", "/verify", {
    method: "POST",
    body: { transactionId, reference },
  });
}

// ==================== PRODUCTS ====================

function transformProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price || 0,
    images: p.images || [],
    status: (p.status || "draft").toUpperCase(),
    sourceUrl: p.social_post_id,
    sourcePlatform: p.platform?.toUpperCase(),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  images?: string[];
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  // Get user's store (FreshCart schema: stores have seller_id)
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", session.user.id)
    .maybeSingle();

  if (!store) {
    return { success: false, error: "Please create a store first" };
  }

  // Minimal insert - matches base products schema (store_id, name, description, price, images, status)
  const baseRow: Record<string, unknown> = {
    store_id: store.id,
    name: String(data.name || "").trim() || "Untitled Product",
    description: data.description || null,
    price: data.price,
    images: Array.isArray(data.images) ? data.images : data.images ? [data.images] : [],
    status: "draft",
  };

  let { data: product, error } = await supabase
    .from("products")
    .insert([baseRow as any])
    .select()
    .single();

  if (error && (error.message?.includes("column") || error.message?.includes("source"))) {
    ({ data: product, error } = await supabase
      .from("products")
      .insert([baseRow as any])
      .select()
      .single());
  }

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: transformProduct(product) };
}

export async function listDraftProducts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", session.user.id)
    .maybeSingle();

  if (!store) {
    return { success: true, data: [] };
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []).map(transformProduct) };
}

export async function listPublishedProducts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated" };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", session.user.id)
    .maybeSingle();

  if (!store) {
    return { success: true, data: [] };
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []).map(transformProduct) };
}

export async function updateProduct(productId: string, data: {
  name?: string;
  description?: string;
  price?: number;
  images?: string[];
  status?: "draft" | "published" | "archived" | ProductStatusDb;
}) {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.images !== undefined) updateData.images = data.images;
  // Use lowercase status to match DB enum values
  if (data.status) updateData.status = String(data.status).toLowerCase();

  const { data: product, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", productId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: transformProduct(product) };
}

export async function publishProduct(productId: string) {
  return updateProduct(productId, { status: "published" });
}

export async function archiveProduct(productId: string) {
  return updateProduct(productId, { status: "archived" });
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: "Product deleted" };
}

// Products Tab - Full API (store-api Edge Function)
export async function getProducts(params?: {
  page?: number;
  limit?: number;
  status?: string;
  category_id?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.status) sp.set("status", params.status);
  if (params?.category_id) sp.set("category_id", String(params.category_id));
  if (params?.search) sp.set("search", params.search);
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.order) sp.set("order", params.order);
  const res = await callEdgeFunction<{ data: { products: any[]; pagination: any } }>(
    "store-api",
    `/products${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getProduct(productId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: "Not authenticated", data: undefined };
  const res = await callEdgeFunction<{ data: any }>("store-api", `/products/${productId}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function createProductFull(data: {
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  compare_at_price?: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  quantity?: number;
  low_stock_threshold?: number;
  category_id?: number;
  brand?: string;
  tags?: string[];
  product_type?: string;
  status?: string;
  images?: string[];
  videos?: string[];
  seo_title?: string;
  seo_description?: string;
  requires_shipping?: boolean;
  weight?: number;
  is_featured?: boolean;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/products", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  // Edge returns { success, data: product }; support both nested and flat formats
  const raw = (res as any).data?.data ?? (res as any).data;
  if (!raw) return { ...res, data: undefined };
  const product = {
    ...transformProduct(raw),
    sku: raw.sku,
    compare_at_price: raw.compare_at_price,
    cost: raw.cost,
    category_id: raw.category_id,
    quantity: raw.quantity,
  };
  return { ...res, data: product };
}

export async function updateProductFull(productId: string, data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/products/${productId}`, {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function duplicateProduct(productId: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/products/${productId}/duplicate`, {
    method: "POST",
  });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function getProductVariants(productId: string) {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", `/products/${productId}/variants`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: res.data?.data ?? [] };
}

export async function createProductVariant(productId: string, data: {
  options: Record<string, string>;
  price?: number;
  compare_at_price?: number;
  cost?: number;
  quantity?: number;
  sku?: string;
  image_url?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/products/${productId}/variants`, {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function updateProductVariant(productId: string, variantId: string, data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/products/${productId}/variants/${variantId}`, {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

export async function deleteProductVariant(productId: string, variantId: string) {
  return callEdgeFunction("store-api", `/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
  });
}

export async function bulkUpdateProducts(productIds: string[], updates: Record<string, unknown>) {
  const res = await callEdgeFunction<{ updated?: number }>("store-api", "/products/bulk-update", {
    method: "POST",
    body: { product_ids: productIds, updates },
  });
  if (!res.success) return res;
  return res;
}

export async function bulkDeleteProducts(productIds: string[]) {
  const res = await callEdgeFunction<{ deleted?: number }>("store-api", "/products/bulk-delete", {
    method: "POST",
    body: { product_ids: productIds },
  });
  if (!res.success) return res;
  return res;
}

export async function exportProducts() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { success: false, error: "Not authenticated", data: undefined };
  const headers = await getAuthHeaders();
  const url = `${SUPABASE_URL}/functions/v1/store-api/products/export`;
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) return { success: false, error: "Export failed", data: undefined };
  const csv = await res.text();
  return { success: true, data: csv };
}

export async function startProductImport(fileUrl: string, fileName: string, fileSize?: number) {
  const res = await callEdgeFunction<{ job_id?: string }>("store-api", "/products/import", {
    method: "POST",
    body: { file_url: fileUrl, file_name: fileName, file_size: fileSize ?? 0 },
  });
  if (!res.success) return res;
  const jobId = (res as unknown as { job_id?: string }).job_id;
  return { ...res, data: { jobId } };
}

export async function getProductImportJob(jobId: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/products/import/${jobId}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getProductCategories() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/products/categories", { method: "GET" });
  if (!res.success) return res;
  const r = res as { data?: any };
  return { ...res, data: r.data ?? [] };
}

export async function createProductCategory(data: {
  name: string;
  parent_id?: number;
  description?: string;
  image_url?: string;
  seo_title?: string;
  seo_description?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/products/categories", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  const r = res as { data?: any };
  return { ...res, data: r.data };
}

export async function getProductAnalytics(productId: string, params?: {
  start_date?: string;
  end_date?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.start_date) sp.set("start_date", params.start_date);
  if (params?.end_date) sp.set("end_date", params.end_date);
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/products/${productId}/analytics${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: res.data?.data };
}

// ==================== INVENTORY ====================

export async function getInventoryDashboard() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/inventory/dashboard", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getInventoryLevels(params?: { location_id?: number; low_stock_only?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.location_id) sp.set("location_id", String(params.location_id));
  if (params?.low_stock_only) sp.set("low_stock_only", "true");
  const res = await callEdgeFunction<{ data: any[] }>(
    "store-api",
    `/inventory/levels${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function adjustInventory(data: {
  product_id?: string;
  variant_id?: string;
  location_id?: number;
  quantity_change: number;
  adjustment_type?: string;
  reason?: string;
  notes?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/inventory/adjust", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getInventoryLocations() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/inventory/locations", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function createInventoryLocation(data: {
  name: string;
  code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  is_default?: boolean;
  location_type?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/inventory/locations", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getInventoryTransfers() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/inventory/transfers", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function createInventoryTransfer(data: {
  from_location_id: number;
  to_location_id: number;
  items: { product_id: string; variant_id?: string; quantity: number }[];
  notes?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/inventory/transfers", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getInventorySuppliers() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/inventory/suppliers", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function createInventorySupplier(data: {
  name: string;
  code?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  payment_terms?: string;
  lead_time_days?: number;
  minimum_order_value?: number;
  notes?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/inventory/suppliers", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function createPurchaseOrder(data: {
  supplier_id?: number;
  location_id?: number;
  items: { product_id: string; variant_id?: string; quantity: number; unit_cost?: number }[];
  po_number?: string;
  order_date?: string;
  expected_date?: string;
  payment_terms?: string;
  notes?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/inventory/purchase-orders", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getInventoryAdjustments(params?: {
  product_id?: string;
  start_date?: string;
  end_date?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.product_id) sp.set("product_id", params.product_id);
  if (params?.start_date) sp.set("start_date", params.start_date);
  if (params?.end_date) sp.set("end_date", params.end_date);
  const res = await callEdgeFunction<{ data: any[] }>(
    "store-api",
    `/inventory/adjustments${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function getReorderRecommendations() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/inventory/reorder-recommendations", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

// ==================== CUSTOMERS ====================

export async function getCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  segment_id?: string;
  tags?: string[];
  sort?: string;
  order?: "asc" | "desc";
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.search) sp.set("search", params.search);
  if (params?.segment_id) sp.set("segment_id", params.segment_id);
  if (params?.tags?.length) sp.set("tags", params.tags.join(","));
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.order) sp.set("order", params.order);
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/customers${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getCustomer(customerId: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/customers/${customerId}`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function createCustomer(data: {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  tags?: string[];
  notes?: string;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/customers", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateCustomer(customerId: string, data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/customers/${customerId}`, {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function deleteCustomer(customerId: string) {
  return callEdgeFunction("store-api", `/customers/${customerId}`, { method: "DELETE" });
}

export async function getCustomerOrders(customerId: string) {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", `/customers/${customerId}/orders`, { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function getCustomerSegments() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/customers/segments", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function createCustomerSegment(data: {
  name: string;
  description?: string;
  segment_type?: string;
  conditions?: Record<string, unknown>;
  is_dynamic?: boolean;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/customers/segments", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getCustomerAnalytics() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/customers/analytics/dashboard", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getLoyaltyProgram() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/customers/loyalty/program", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function upsertLoyaltyProgram(data: {
  name: string;
  description?: string;
  points_per_dollar?: number;
  welcome_bonus_points?: number;
  birthday_bonus_points?: number;
  referral_points?: number;
  review_points?: number;
  points_value?: number;
  minimum_redemption_points?: number;
  tiers?: unknown;
  is_active?: boolean;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/customers/loyalty/program", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function exportCustomers() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { success: false, error: "Not authenticated", data: undefined };
  const headers = await getAuthHeaders();
  const url = `${SUPABASE_URL}/functions/v1/store-api/customers/export`;
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) return { success: false, error: "Export failed", data: undefined };
  const csv = await res.text();
  return { success: true, data: csv };
}

export async function syncCustomersFromTransactions() {
  const res = await callEdgeFunction<{ synced?: number; created?: number }>("store-api", "/customers/sync-from-transactions", {
    method: "POST",
  });
  if (!res.success) return res;
  const r = res as unknown as { synced?: number; created?: number };
  return { ...res, data: { synced: r.synced ?? 0, created: r.created ?? 0 } };
}

// ==================== STORE SETTINGS ====================

export async function getStoreSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateStoreSettingsGeneral(data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/general", {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreTheme() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/theme", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateStoreTheme(data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/theme", {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreDomains() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/settings/domains", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any[] }).data ?? [] };
}

export async function addStoreDomain(domain: string) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/domains", {
    method: "POST",
    body: { domain },
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreSEOSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/seo", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateStoreSEOSettings(data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/seo", {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStorePaymentSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/payment", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateStorePaymentSettings(data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/payment", {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreShippingSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/shipping", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateStoreShippingSettings(data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/shipping", {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreShippingZones() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/settings/shipping/zones", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any[] }).data ?? [] };
}

export async function createStoreShippingZone(data: { name: string; countries?: string[]; states?: string[]; rates?: unknown[] }) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/shipping/zones", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreTaxSettings() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/tax", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function updateStoreTaxSettings(data: Record<string, unknown>) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/tax", {
    method: "PATCH",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function createStoreTaxRate(data: { name: string; country: string; state?: string; rate: number }) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/tax/rates", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreIntegrations() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/settings/integrations", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any[] }).data ?? [] };
}

export async function getStoreEmailTemplates() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/settings/email-templates", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any[] }).data ?? [] };
}

export async function getStoreLegalPages() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/settings/legal-pages", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any[] }).data ?? [] };
}

export async function updateStoreLegalPage(pageType: string, data: { title: string; content: string; slug: string; meta_description?: string; is_published?: boolean }) {
  const res = await callEdgeFunction<{ data: any }>("store-api", `/settings/legal-pages/${pageType}`, {
    method: "PUT",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getStoreWebhooks() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/settings/webhooks", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any[] }).data ?? [] };
}

export async function createStoreWebhook(data: { url: string; events: string[] }) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/settings/webhooks", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

// ==================== ANALYTICS ====================

export async function getAnalyticsDashboard() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/analytics/dashboard", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getAnalyticsRealtime() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/analytics/realtime", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getAnalyticsRevenue(params?: { period?: string }) {
  const sp = new URLSearchParams();
  if (params?.period) sp.set("period", params.period);
  const res = await callEdgeFunction<{ data: any }>(
    "store-api",
    `/analytics/revenue${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getAnalyticsProducts() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/analytics/products", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function getAnalyticsCustomers() {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/analytics/customers", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getAnalyticsCustomerCohorts() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/analytics/customers/cohorts", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function getAnalyticsTraffic(params?: { period?: string }) {
  const sp = new URLSearchParams();
  if (params?.period) sp.set("period", params.period);
  const res = await callEdgeFunction<{ data: any[] }>(
    "store-api",
    `/analytics/traffic${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function getAnalyticsForecast(params?: { horizon?: string }) {
  const sp = new URLSearchParams();
  if (params?.horizon) sp.set("horizon", params.horizon);
  const res = await callEdgeFunction<{ data: any[] }>(
    "store-api",
    `/analytics/forecast${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function generateAnalyticsForecast(params?: { horizon_days?: number }) {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/analytics/forecast/generate", {
    method: "POST",
    body: params || {},
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function getAnalyticsInsights(params?: { unread_only?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.unread_only) sp.set("unread_only", "true");
  const res = await callEdgeFunction<{ data: any[] }>(
    "store-api",
    `/analytics/insights${sp.toString() ? `?${sp.toString()}` : ""}`,
    { method: "GET" }
  );
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function markAnalyticsInsightRead(insightId: string) {
  return callEdgeFunction("store-api", `/analytics/insights/${insightId}/read`, { method: "PATCH" });
}

export async function getAnalyticsReports() {
  const res = await callEdgeFunction<{ data: any[] }>("store-api", "/analytics/reports", { method: "GET" });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data ?? [] };
}

export async function createAnalyticsReport(data: {
  name: string;
  description?: string;
  report_config?: Record<string, unknown>;
  metrics?: string[];
  dimensions?: string[];
  filters?: Record<string, unknown>;
}) {
  const res = await callEdgeFunction<{ data: any }>("store-api", "/analytics/reports", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: any }).data };
}

export async function exportAnalyticsReport(data: {
  report_type: string;
  format?: string;
  date_from?: string;
  date_to?: string;
}) {
  const res = await callEdgeFunction<{ data: string }>("store-api", "/analytics/export", {
    method: "POST",
    body: data,
  });
  if (!res.success) return res;
  return { ...res, data: (res as { data?: string }).data };
}

// Export all functions as a namespace-like object for compatibility
export const supabaseApi = {
  // Buyer
  getBuyerOrders,
  getBuyerWallet,
  getBuyerDisputes,
  confirmDelivery,
  openDispute,
  
  // Seller
  getSellerOrders,
  getSellerStats,
  acceptOrder,
  rejectOrder,
  addShippingInfo,
  
  // Store
  getMyStore,
  createStore,
  updateStore,
  updateStoreStatus,
  
  // Wallet
  getWallet,
  getPaymentMethods,
  addPaymentMethod,
  requestWithdrawal,
  
  // Transactions
  createTransaction,
  getTransaction,
  initiatePayment,
  
  // Admin
  getAdminDashboard,
  getAdminTransactions,
  getAdminDisputes,
  getAdminUsers,
  resolveDispute,
  deactivateUser,
  activateUser,
  
  // Social
  listSocialAccounts,
  connectSocialPage,
  
  // Products
  createProduct,
  listDraftProducts,
  listPublishedProducts,
  updateProduct,
  publishProduct,
  archiveProduct,
  deleteProduct,
  getProducts,
  getProduct,
  createProductFull,
  updateProductFull,
  duplicateProduct,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  bulkUpdateProducts,
  bulkDeleteProducts,
  exportProducts,
  startProductImport,
  getProductImportJob,
  getProductCategories,
  createProductCategory,
  getProductAnalytics,

  // Inventory
  getInventoryDashboard,
  getInventoryLevels,
  adjustInventory,
  getInventoryLocations,
  createInventoryLocation,
  getInventoryTransfers,
  createInventoryTransfer,
  getInventorySuppliers,
  createInventorySupplier,
  createPurchaseOrder,
  getInventoryAdjustments,
  getReorderRecommendations,

  // Customers
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
  getCustomerSegments,
  createCustomerSegment,
  getCustomerAnalytics,
  getLoyaltyProgram,
  upsertLoyaltyProgram,
  exportCustomers,
  syncCustomersFromTransactions,

  // Analytics
  getAnalyticsDashboard,
  getAnalyticsRealtime,
  getAnalyticsRevenue,
  getAnalyticsProducts,
  getAnalyticsCustomers,
  getAnalyticsCustomerCohorts,
  getAnalyticsTraffic,
  getAnalyticsForecast,
  generateAnalyticsForecast,
  getAnalyticsInsights,
  markAnalyticsInsightRead,
  getAnalyticsReports,
  createAnalyticsReport,
  exportAnalyticsReport,

  // Payment links (Edge: links-api)
  createPaymentLink,
  getPaymentLink,
  getMyPaymentLinks,
  updatePaymentLinkStatus,
  purchasePaymentLink,

  // Paystack (Edge: paystack-api)
  getPaystackConfig,
  initiatePaystackPayment,
  verifyPaystackPayment,

  // Storefront (Edge: storefront-api)
  getStorefront,
  getPublicProduct,
  createStorefrontCheckout,
  addBuyerDisputeMessage,

  // Store Settings
  getStoreSettings,
  updateStoreSettingsGeneral,
  getStoreTheme,
  updateStoreTheme,
  getStoreDomains,
  addStoreDomain,
  getStoreSEOSettings,
  updateStoreSEOSettings,
  getStorePaymentSettings,
  updateStorePaymentSettings,
  getStoreShippingSettings,
  updateStoreShippingSettings,
  getStoreShippingZones,
  createStoreShippingZone,
  getStoreTaxSettings,
  updateStoreTaxSettings,
  createStoreTaxRate,
  getStoreIntegrations,
  getStoreEmailTemplates,
  getStoreLegalPages,
  updateStoreLegalPage,
  getStoreWebhooks,
  createStoreWebhook,
};
