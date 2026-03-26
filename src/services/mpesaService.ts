/**
 * M-Pesa Service - Frontend API client for the mpesa-api edge function
 */
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://krkybhborwvcbjzjcghw.supabase.co";

async function callMpesaApi(action: string, method: "GET" | "POST" = "POST", body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtya3liaGJvcnd2Y2JqempjZ2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTYwNDksImV4cCI6MjA4NzA3MjA0OX0.mwm0aTd9ZBltJD5VgOFN7vZ6jibpKsF8dGdcSwOg1cw",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const url = `${SUPABASE_URL}/functions/v1/payment-api/${action}`;
  const response = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return response.json();
}

// API #1: STK Push - Trigger payment prompt on user's phone
export async function initiateSTKPush(phoneNumber: string, amount: number, orderId?: string, orderRef?: string) {
  return callMpesaApi("stk-push", "POST", { phoneNumber, amount, orderId, orderRef });
}

// Subscribe via STK Push
export async function initiateSubscription(phoneNumber: string, plan: "basic" | "premium") {
  return callMpesaApi("subscribe", "POST", { phoneNumber, plan });
}

// Get current subscription status
export async function getSubscriptionStatus() {
  return callMpesaApi("subscription-status", "GET");
}

// API #3: Verify M-Pesa transaction code
export async function verifyMpesaCode(transactionCode: string, customerPhone: string, orderId: string, expectedAmount?: number) {
  return callMpesaApi("verify", "POST", {
    transaction_code: transactionCode,
    customer_phone: customerPhone,
    order_id: orderId,
    expected_amount: expectedAmount,
  });
}

// Get verification status for an order
export async function getVerificationStatus(orderId: string) {
  return callMpesaApi(`verification-status?order_id=${orderId}`, "GET");
}

// API #4: Query account balance (admin)
export async function queryAccountBalance() {
  return callMpesaApi("balance", "POST");
}

// Get latest cached balance
export async function getLatestBalance() {
  return callMpesaApi("balance-latest", "GET");
}

// API #5: B2C Payout
export async function initiatePayout(phoneNumber: string, amount: number, orderId?: string, orderRef?: string) {
  return callMpesaApi("payout", "POST", { phoneNumber, amount, orderId, orderRef });
}

// Withdraw earnings via B2C
export async function withdrawEarnings(phoneNumber: string, amount: number) {
  return callMpesaApi("withdraw-earnings", "POST", { phoneNumber, amount });
}

// Get earnings balance and history
export async function getEarnings() {
  return callMpesaApi("earnings", "GET");
}
