/**
 * BLACKNEWS — Cliente de la API de suscripciones PayPal.
 *
 * Todo vive en el Worker (/api/paypal/*): el navegador solo recibe el clientId
 * público y los plan_ids. El acceso nunca se guarda en localStorage — el
 * servidor es quien lo concede tras confirmar el cobro con PayPal.
 */

export type PlanTier = "access" | "insight" | "intelligence";
export type BillingCycle = "monthly" | "yearly";

/** Nombres comerciales de los planes (misma tabla que el Worker). */
export const PLAN_NAMES: Record<PlanTier, string> = {
  access: "BlackNews Access",
  insight: "BlackNews Insight",
  intelligence: "BlackNews Intelligence",
};

export interface PayPalConfig {
  success: boolean;
  enabled: boolean;
  mode: "sandbox" | "live";
  currency: string;
  clientId: string | null;
  planIds: Record<string, string>;
  prices: Record<PlanTier, { monthly: string; yearly: string }>;
  error?: string;
}

export interface SubscriptionStatus {
  success: boolean;
  active: boolean;
  status?: "active" | "cancelled" | "suspended" | "expired" | "pending";
  plan?: PlanTier;
  cycle?: BillingCycle;
  nextBillingDate?: string | null;
}

export class PayPalApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "PayPalApiError";
    this.code = code;
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let data: unknown = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok || !data || typeof data !== "object") {
    const code =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `http_${res.status}`;
    throw new PayPalApiError(code, res.status);
  }
  return data as T;
}

export function fetchPayPalConfig(): Promise<PayPalConfig> {
  return requestJson<PayPalConfig>("/api/paypal/config");
}

export function fetchSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
  return requestJson<SubscriptionStatus>(
    `/api/paypal/subscription?email=${encodeURIComponent(email)}`,
  );
}

export function activateSubscription(payload: {
  subscriptionId: string;
  email: string;
  plan: PlanTier;
  cycle: BillingCycle;
}): Promise<SubscriptionStatus> {
  return requestJson<SubscriptionStatus>("/api/paypal/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function cancelSubscription(email: string): Promise<SubscriptionStatus> {
  return requestJson<SubscriptionStatus>("/api/paypal/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
