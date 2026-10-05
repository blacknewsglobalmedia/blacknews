/**
 * BLACKNEWS — Suscripciones PayPal (Subscriptions API v1) en Cloudflare Workers.
 *
 * Flujo (las credenciales nunca llegan al navegador):
 *   1. GET  /api/paypal/config        → clientId público + plan_ids + precios.
 *                                       En la primera llamada crea el producto y
 *                                       los billing plans vía API y los cachea en KV.
 *   2. El botón de PayPal crea la suscripción en el navegador (SDK vault+subscription).
 *   3. POST /api/paypal/activate      → verifica contra PayPal (plan_id y estado) y
 *                                       concede el acceso en KV, una sola vez por
 *                                       suscripción pagada.
 *   4. GET  /api/paypal/subscription  → estado real revalidado contra PayPal (TTL 6 h).
 *   5. POST /api/paypal/cancel        → cancela en PayPal y revoca el acceso.
 *
 * Seguridad: el acceso SOLO se escribe aquí, después de que PayPal confirme el
 * cobro. El cliente (localStorage) ya no concede nada — era el error crítico.
 */

export type PlanTier = 'access' | 'insight' | 'intelligence';
export type BillingCycle = 'monthly' | 'yearly';

export interface PayPalEnv {
  PAYPAL_MODE?: string; // 'sandbox' (por defecto) | 'live'
  PAYPAL_API_BASE?: string; // SOLO pruebas: apunta a un servidor PayPal simulado
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_SECRET?: string;
  PAYPAL_KV: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Tabla de planes — fuente única de precios (USD, renovación automática)
// ---------------------------------------------------------------------------
export interface PlanSpec {
  name: string;
  description: string;
  monthly: string; // cobro recurrente mensual
  yearly: string; // cobro recurrente anual (≈20% de descuento)
}

export const PLANS: Record<PlanTier, PlanSpec> = {
  access: {
    name: 'BlackNews Access',
    description: 'Para quien simplemente quiere apoyar y leer más.',
    monthly: '2.99',
    yearly: '28.68', // 2.39/mes (−20%)
  },
  insight: {
    name: 'BlackNews Insight',
    description: 'Para el lector que quiere entender lo que ocurre.',
    monthly: '4.99',
    yearly: '47.88', // 3.99/mes (−20%)
  },
  intelligence: {
    name: 'BlackNews Intelligence',
    description: 'El plan premium de BlackNews, sin concesiones.',
    monthly: '14.99',
    yearly: '143.88', // 11.99/mes (−20%)
  },
};

export const PRICES: Record<PlanTier, { monthly: string; yearly: string }> = {
  access: { monthly: PLANS.access.monthly, yearly: PLANS.access.yearly },
  insight: { monthly: PLANS.insight.monthly, yearly: PLANS.insight.yearly },
  intelligence: {
    monthly: PLANS.intelligence.monthly,
    yearly: PLANS.intelligence.yearly,
  },
};

// ---------------------------------------------------------------------------
// Planes de PUBLICIDAD — pago único (Orders API v2). Precios SOLO aquí:
// el cliente envía el planId, nunca el importe.
// ---------------------------------------------------------------------------
export const AD_PLANS: Record<string, { name: string; usd: string }> = {
  'plan-flash-7d': { name: 'Plan Rápido (7 Días)', usd: '15.00' },
  'plan-fortnight-15d': { name: 'Plan Quincenal (15 Días)', usd: '28.00' },
  'plan-monthly-30d': { name: 'Plan Mensual (30 Días)', usd: '49.00' },
  'plan-cpm-10k': { name: '10.000 Impresiones Garantizadas', usd: '12.00' },
  'plan-cpm-50k': { name: '50.000 Impresiones Garantizadas', usd: '45.00' },
};

const PLAN_TIERS: PlanTier[] = ['access', 'insight', 'intelligence'];
const CYCLES: BillingCycle[] = ['monthly', 'yearly'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // revalidación contra PayPal cada 6 h
const CATALOG_KEY = 'paypal_catalog_v1';
const subKey = (email: string) => `sub:${email}`;
const sidKey = (sid: string) => `paypal_sid:${sid}`;

export function isConfigured(env: PayPalEnv): boolean {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET);
}

function apiBase(env: PayPalEnv): string {
  if (env.PAYPAL_API_BASE) return env.PAYPAL_API_BASE.replace(/\/$/, '');
  return env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

// ---------------------------------------------------------------------------
// Token de acceso (client_credentials), cacheado por isolate
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(env: PayPalEnv): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${apiBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`PayPal OAuth ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

interface PpResponse {
  status: number;
  data: any;
}

async function pp(
  env: PayPalEnv,
  path: string,
  init?: { method?: string; json?: unknown; contentType?: string }
): Promise<PpResponse> {
  const token = await getToken(env);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | undefined;
  if (init?.json !== undefined) {
    headers['Content-Type'] = init.contentType ?? 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${apiBase(env)}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body,
  });
  let data: any = null;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Catálogo: producto + billing plans creados una vez y cacheados en KV
// ---------------------------------------------------------------------------
interface Catalog {
  productId: Partial<Record<PlanTier, string>>;
  planIds: Record<string, string>; // 'digital_monthly' → 'P-...'
}

function planKey(tier: PlanTier, cycle: BillingCycle): string {
  return `${tier}_${cycle}`;
}

async function getCatalog(env: PayPalEnv): Promise<Catalog> {
  const raw = await env.PAYPAL_KV.get(CATALOG_KEY);
  const catalog: Catalog = raw
    ? (JSON.parse(raw) as Catalog)
    : { productId: {}, planIds: {} };

  for (const tier of PLAN_TIERS) {
    const spec = PLANS[tier];

    if (!catalog.productId[tier]) {
      const res = await pp(env, '/v1/catalogs/products', {
        method: 'POST',
        json: {
          name: spec.name,
          description: spec.description,
          type: 'SERVICE',
          category: 'SOFTWARE',
        },
      });
      if (res.status >= 300 || !res.data?.id) {
        throw new Error(`Producto ${tier}: HTTP ${res.status}`);
      }
      catalog.productId[tier] = res.data.id;
      await env.PAYPAL_KV.put(CATALOG_KEY, JSON.stringify(catalog));
    }

    for (const cycle of CYCLES) {
      const key = planKey(tier, cycle);
      if (catalog.planIds[key]) continue;

      const res = await pp(env, '/v1/billing/plans', {
        method: 'POST',
        json: {
          product_id: catalog.productId[tier],
          name: `${spec.name} · ${cycle === 'monthly' ? 'Mensual' : 'Anual'} (USD)`,
          description: `${spec.name} — cobro recurrente ${
            cycle === 'monthly' ? 'cada mes' : 'cada 12 meses'
          }.`,
          billing_cycles: [
            {
              frequency: { unit: 'MONTH', interval_count: cycle === 'monthly' ? 1 : 12 },
              tenure_type: 'REGULAR',
              price: { value: cycle === 'monthly' ? spec.monthly : spec.yearly, currency: 'USD' },
              series: 1,
            },
          ],
          payment_preferences: {
            auto_bill_outstanding: 'YES',
            payment_failure_threshold: 1,
          },
        },
      });
      if (res.status >= 300 || !res.data?.id) {
        throw new Error(`Plan ${key}: HTTP ${res.status} ${JSON.stringify(res.data ?? {})}`);
      }

      const planId = res.data.id as string;
      const activate = await pp(env, `/v1/billing/plans/${planId}`, {
        method: 'PATCH',
        json: [{ op: 'replace', path: '/status', value: 'ACTIVE' }],
        contentType: 'application/json-patch+json',
      });
      if (activate.status >= 300) {
        throw new Error(`Activación del plan ${key}: HTTP ${activate.status}`);
      }

      catalog.planIds[key] = planId;
      await env.PAYPAL_KV.put(CATALOG_KEY, JSON.stringify(catalog));
    }
  }

  return catalog;
}

// ---------------------------------------------------------------------------
// Registro de acceso por usuario (KV)
// ---------------------------------------------------------------------------
interface SubscriptionRecord {
  status: 'active' | 'cancelled' | 'suspended' | 'expired';
  plan: PlanTier;
  cycle: BillingCycle;
  subscriptionId: string;
  activatedAt: string;
  nextBillingDate?: string;
  checkedAt: number;
}

function mapPayPalStatus(status: string): SubscriptionRecord['status'] {
  if (status === 'ACTIVE') return 'active';
  if (status === 'SUSPENDED' || status === 'FAILED') return 'suspended';
  if (status === 'EXPIRED') return 'expired';
  return 'cancelled';
}

async function readRecord(env: PayPalEnv, email: string): Promise<SubscriptionRecord | null> {
  const raw = await env.PAYPAL_KV.get(subKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubscriptionRecord;
  } catch {
    return null;
  }
}

async function writeRecord(env: PayPalEnv, email: string, rec: SubscriptionRecord): Promise<void> {
  await env.PAYPAL_KV.put(subKey(email), JSON.stringify(rec));
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
interface HttpError {
  status: number;
  error: string;
}

function fail(status: number, error: string): HttpError {
  return { status, error };
}

function isHttpError(e: unknown): e is HttpError {
  return typeof e === 'object' && e !== null && 'status' in e && 'error' in e;
}

export async function handleConfig(env: PayPalEnv): Promise<{ status: number; body: unknown }> {
  if (!isConfigured(env)) {
    return {
      status: 200,
      body: {
        success: true,
        enabled: false,
        mode: env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
        currency: 'USD',
        clientId: null,
        planIds: {},
        prices: PRICES,
      },
    };
  }

  let planIds: Record<string, string> = {};
  let error: string | undefined;
  try {
    planIds = (await getCatalog(env)).planIds;
  } catch (e) {
    error = e instanceof Error ? e.message : 'catalog_error';
    console.error('[BLACKNEWS PAYPAL] catálogo:', error);
  }

  return {
    status: 200,
    body: {
      success: true,
      enabled: true,
      mode: env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
      currency: 'USD',
      clientId: env.PAYPAL_CLIENT_ID ?? null,
      planIds,
      prices: PRICES,
      ...(error ? { error } : {}),
    },
  };
}

export async function handleStatus(
  env: PayPalEnv,
  emailRaw: string | null
): Promise<{ status: number; body: unknown }> {
  const email = (emailRaw ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw fail(400, 'email_invalido');
  }
  if (!isConfigured(env)) {
    return { status: 200, body: { success: true, active: false } };
  }

  const rec = await readRecord(env, email);
  if (!rec) {
    return { status: 200, body: { success: true, active: false } };
  }

  const stale = Date.now() - (rec.checkedAt ?? 0) > CACHE_TTL_MS;
  if (stale) {
    // Revalida contra PayPal; si la API no responde se sirve el último estado.
    try {
      const res = await pp(env, `/v1/billing/subscriptions/${rec.subscriptionId}`);
      if (res.status === 200 && res.data?.status) {
        const paypalStatus = res.data.status as string;
        if (paypalStatus !== 'APPROVED') {
          rec.status = mapPayPalStatus(paypalStatus);
        }
        rec.nextBillingDate =
          res.data?.billing_info?.next_billing_time ?? rec.nextBillingDate;
        rec.checkedAt = Date.now();
        await writeRecord(env, email, rec);
      } else if (res.status === 404) {
        rec.status = 'expired';
        rec.checkedAt = Date.now();
        await writeRecord(env, email, rec);
      }
    } catch (e) {
      console.error('[BLACKNEWS PAYPAL] revalidación:', e instanceof Error ? e.message : e);
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      active: rec.status === 'active',
      status: rec.status,
      plan: rec.plan,
      cycle: rec.cycle,
      nextBillingDate: rec.nextBillingDate ?? null,
    },
  };
}

export async function handleActivate(
  env: PayPalEnv,
  body: { subscriptionId?: string; email?: string; plan?: string; cycle?: string }
): Promise<{ status: number; body: unknown }> {
  const email = (body.email ?? '').trim().toLowerCase();
  const subscriptionId = (body.subscriptionId ?? '').trim();
  const plan = body.plan as PlanTier;
  const cycle = body.cycle as BillingCycle;

  if (!isConfigured(env)) throw fail(503, 'payments_not_configured');
  if (!EMAIL_RE.test(email)) throw fail(400, 'email_invalido');
  if (!subscriptionId.startsWith('I-')) throw fail(400, 'subscription_id_invalido');
  if (!PLAN_TIERS.includes(plan) || !CYCLES.includes(cycle)) throw fail(400, 'plan_invalido');

  // 1) Estado real de la suscripción en PayPal (nunca se confía al cliente)
  let sub = await pp(env, `/v1/billing/subscriptions/${subscriptionId}`);
  if (sub.status === 404) throw fail(400, 'subscription_not_found');
  if (sub.status >= 300) throw fail(502, 'paypal_error');

  // Aprobada pero sin primer cobro todavía → intenta activar y vuelve a mirar
  if (sub.data?.status === 'APPROVED') {
    await pp(env, `/v1/billing/subscriptions/${subscriptionId}/activate`, {
      method: 'POST',
      json: { reason: 'Primer pago confirmado' },
    });
    sub = await pp(env, `/v1/billing/subscriptions/${subscriptionId}`);
  }

  if (sub.data?.status !== 'ACTIVE') {
    // El primer pago sigue procesándose: el cliente reintenta.
    return { status: 202, body: { success: true, status: 'pending' } };
  }

  // 2) El plan debe ser exactamente uno de los nuestros (los precios viven aquí)
  const catalog = await getCatalog(env);
  const expectedPlanId = catalog.planIds[planKey(plan, cycle)];
  if (!expectedPlanId || sub.data?.plan_id !== expectedPlanId) {
    throw fail(409, 'plan_mismatch');
  }

  // 3) Si el cliente envió custom_id, debe casar con lo que se pidió
  const expectedCustom = `${email}|${plan}|${cycle}`;
  const customId = typeof sub.data?.custom_id === 'string' ? sub.data.custom_id : null;
  if (customId && customId !== expectedCustom) {
    throw fail(409, 'custom_mismatch');
  }

  // 4) Una suscripción pagada no puede conceder acceso a varias cuentas
  const boundEmail = await env.PAYPAL_KV.get(sidKey(subscriptionId));
  if (boundEmail && boundEmail !== email) {
    throw fail(409, 'subscription_already_used');
  }

  const rec: SubscriptionRecord = {
    status: 'active',
    plan,
    cycle,
    subscriptionId,
    activatedAt: new Date().toISOString(),
    nextBillingDate: sub.data?.billing_info?.next_billing_time ?? undefined,
    checkedAt: Date.now(),
  };
  await writeRecord(env, email, rec);
  if (!boundEmail) {
    await env.PAYPAL_KV.put(sidKey(subscriptionId), email);
  }

  return {
    status: 200,
    body: {
      success: true,
      status: 'active',
      plan,
      cycle,
      nextBillingDate: rec.nextBillingDate ?? null,
    },
  };
}

export async function handleCancel(
  env: PayPalEnv,
  body: { email?: string }
): Promise<{ status: number; body: unknown }> {
  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw fail(400, 'email_invalido');
  if (!isConfigured(env)) throw fail(503, 'payments_not_configured');

  const rec = await readRecord(env, email);
  if (!rec || rec.status !== 'active') throw fail(400, 'sin_suscripcion');

  const res = await pp(env, `/v1/billing/subscriptions/${rec.subscriptionId}/cancel`, {
    method: 'POST',
    json: { reason: 'Cancelado por el usuario desde BlackNews' },
  });
  // 204 = cancelada ahora; 404/422 = ya estaba cancelada. En ambos se revoca.
  if (res.status >= 300 && res.status !== 404 && res.status !== 422) {
    throw fail(502, 'paypal_error');
  }

  rec.status = 'cancelled';
  rec.checkedAt = Date.now();
  rec.nextBillingDate = undefined;
  await writeRecord(env, email, rec);

  return { status: 200, body: { success: true, active: false } };
}

// ---------------------------------------------------------------------------
// Órdenes de PUBLICIDAD (pago único) — Orders API v2
// El navegador envía planId + campaignId; el importe vive SOLO en AD_PLANS.
// ---------------------------------------------------------------------------
const AD_CAMPAIGN_RE = /^ad-[A-Za-z0-9-]{2,64}$/;
const AD_PAYPAL_ORDER_RE = /^[A-Z0-9]{8,64}$/i;
const adOrderKey = (orderId: string) => `adorder:${orderId}`;

export async function handleAdCreateOrder(
  env: PayPalEnv,
  body: { campaignId?: string; planId?: string }
): Promise<{ status: number; body: unknown }> {
  const campaignId = (body.campaignId ?? '').trim();
  const planId = (body.planId ?? '').trim();
  if (!isConfigured(env)) throw fail(503, 'payments_not_configured');
  if (!AD_CAMPAIGN_RE.test(campaignId)) throw fail(400, 'campaign_id_invalido');
  const plan = AD_PLANS[planId];
  if (!plan) throw fail(400, 'plan_invalido');

  const res = await pp(env, '/v2/checkout/orders', {
    method: 'POST',
    json: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: campaignId,
          custom_id: planId,
          description: `${plan.name} — BlackNews Publicidad`,
          amount: { currency_code: 'USD', value: plan.usd },
        },
      ],
      application_context: {
        brand_name: 'BlackNews',
        user_action: 'PAY_NOW',
      },
    },
  });
  if (res.status >= 300 || !res.data?.id) {
    throw fail(502, 'paypal_error');
  }
  const approveUrl = (res.data.links as Array<{ rel: string; href: string }> | undefined)?.find(
    (l) => l.rel === 'approve'
  )?.href;
  if (!approveUrl) throw fail(502, 'paypal_error');

  return { status: 200, body: { success: true, orderId: res.data.id, approveUrl } };
}

export async function handleAdCapture(
  env: PayPalEnv,
  body: { orderId?: string; campaignId?: string }
): Promise<{ status: number; body: unknown }> {
  const orderId = (body.orderId ?? '').trim();
  const campaignId = (body.campaignId ?? '').trim();
  if (!isConfigured(env)) throw fail(503, 'payments_not_configured');
  if (!AD_PAYPAL_ORDER_RE.test(orderId)) throw fail(400, 'order_id_invalido');
  if (!AD_CAMPAIGN_RE.test(campaignId)) throw fail(400, 'campaign_id_invalido');

  // Ya capturada (reintento o refresh tras volver de PayPal) → idempotente.
  const existing = await env.PAYPAL_KV.get(adOrderKey(orderId));
  if (existing) {
    const rec = JSON.parse(existing) as { campaignId: string; planId: string };
    if (rec.campaignId !== campaignId) throw fail(409, 'campaign_mismatch');
    return {
      status: 200,
      body: { success: true, campaignId: rec.campaignId, planId: rec.planId, alreadyCaptured: true },
    };
  }

  // Captura; si ya estaba capturada (422), se relee el estado real.
  let res = await pp(env, `/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    json: {},
  });
  if (res.status === 422) {
    res = await pp(env, `/v2/checkout/orders/${orderId}`);
  } else if (res.status >= 300) {
    throw fail(502, 'paypal_error');
  }

  const order = res.data;
  if (order?.status !== 'COMPLETED') {
    return { status: 202, body: { success: true, status: 'pending' } };
  }

  // Verifica plan + importe + campaña contra la tabla del servidor.
  const unit = order.purchase_units?.[0];
  const paidPlan = typeof unit?.custom_id === 'string' ? unit.custom_id : '';
  const paidCampaign = typeof unit?.reference_id === 'string' ? unit.reference_id : '';
  const expected = AD_PLANS[paidPlan];
  const amount = unit?.amount;
  if (!expected || amount?.currency_code !== 'USD' || Number(amount?.value) !== Number(expected.usd)) {
    throw fail(409, 'amount_mismatch');
  }
  if (paidCampaign !== campaignId) throw fail(409, 'campaign_mismatch');
  const captureId = unit?.payments?.captures?.[0]?.id ?? null;

  await env.PAYPAL_KV.put(
    adOrderKey(orderId),
    JSON.stringify({
      campaignId,
      planId: paidPlan,
      orderId,
      captureId,
      capturedAt: new Date().toISOString(),
    })
  );

  return { status: 200, body: { success: true, campaignId, planId: paidPlan, captureId } };
}

// ---------------------------------------------------------------------------
// Router /api/paypal/*
// ---------------------------------------------------------------------------
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function handlePaypalRequest(
  request: Request,
  env: PayPalEnv,
  pathname: string
): Promise<Response> {
  try {
    if (pathname === '/api/paypal/config' && request.method === 'GET') {
      const { status, body } = await handleConfig(env);
      return json(body, status);
    }

    if (pathname === '/api/paypal/subscription' && request.method === 'GET') {
      const email = new URL(request.url).searchParams.get('email');
      const { status, body } = await handleStatus(env, email);
      return json(body, status);
    }

    if (pathname === '/api/paypal/activate' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Parameters<
        typeof handleActivate
      >[1];
      const { status, body: out } = await handleActivate(env, body);
      return json(out, status);
    }

    if (pathname === '/api/paypal/cancel' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { email?: string };
      const { status, body: out } = await handleCancel(env, body);
      return json(out, status);
    }

    if (pathname === '/api/paypal/ad-order' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        campaignId?: string;
        planId?: string;
      };
      const { status, body: out } = await handleAdCreateOrder(env, body);
      return json(out, status);
    }

    if (pathname === '/api/paypal/ad-capture' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        orderId?: string;
        campaignId?: string;
      };
      const { status, body: out } = await handleAdCapture(env, body);
      return json(out, status);
    }

    return json({ success: false, error: 'Ruta no encontrada: ' + pathname }, 404);
  } catch (e) {
    if (isHttpError(e)) {
      return json({ success: false, error: e.error }, e.status);
    }
    const message = e instanceof Error ? e.message : 'Error de PayPal';
    console.error('[BLACKNEWS PAYPAL]', message);
    return json({ success: false, error: 'paypal_error' }, 502);
  }
}
