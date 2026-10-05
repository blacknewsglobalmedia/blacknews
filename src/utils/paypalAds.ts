/**
 * BLACKNEWS — Cliente del pago de PUBLICIDAD con PayPal (pago único).
 *
 * El navegador solo envía planId + campaignId; el importe lo fija el Worker
 * (tabla AD_PLANS). El flujo:
 *   1. createAdOrder → { orderId, approveUrl } → redirección a PayPal.
 *   2. PayPal vuelve a /?ad_campaign=<id>&token=<orderId>.
 *   3. captureAdOrder → el Worker captura y verifica importe/plan/campaña.
 *   4. El cliente pasa la campaña a PENDIENTE_APROBACION.
 */

export interface AdOrderCreated {
  success: boolean;
  orderId: string;
  approveUrl: string;
}

export interface AdOrderCaptured {
  success: boolean;
  campaignId: string;
  planId: string;
  status?: "pending";
  alreadyCaptured?: boolean;
  captureId?: string | null;
}

export class PayPalAdsError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "PayPalAdsError";
    this.code = code;
    this.status = status;
  }
}

async function requestJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
    throw new PayPalAdsError(code, res.status);
  }
  return data as T;
}

export function createAdOrder(payload: {
  campaignId: string;
  planId: string;
}): Promise<AdOrderCreated> {
  return requestJson<AdOrderCreated>("/api/paypal/ad-order", payload);
}

export function captureAdOrder(payload: {
  orderId: string;
  campaignId: string;
}): Promise<AdOrderCaptured> {
  return requestJson<AdOrderCaptured>("/api/paypal/ad-capture", payload);
}
