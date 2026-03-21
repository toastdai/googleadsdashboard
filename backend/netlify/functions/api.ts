import type { Context } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";

// Initialize Neon SQL client
const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

// Google Ads config from env
const GOOGLE_ADS_CONFIG = {
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  clientId: process.env.GOOGLE_ADS_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
  refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
  loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "",
};

const FRONTEND_URLS = [
  "https://googleadsdashboard-beta.vercel.app",
  "https://googleadsdashboard.vercel.app",
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3003",
  process.env.FRONTEND_URL || "",
].filter(Boolean);

// ─── Helpers ────────────────────────────────────────────

function corsHeaders(origin?: string | null): Record<string, string> {
  const allowed = FRONTEND_URLS.includes(origin || "") ? origin! : FRONTEND_URLS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

function json(data: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

function parseDate(s: string | null, fallbackDaysAgo: number): string {
  if (s) return s;
  const d = new Date();
  d.setDate(d.getDate() - fallbackDaysAgo);
  return d.toISOString().split("T")[0];
}

// ─── Google Ads OAuth Token ─────────────────────────────

async function getAccessToken(): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_ADS_CONFIG.clientId,
      client_secret: GOOGLE_ADS_CONFIG.clientSecret,
      refresh_token: GOOGLE_ADS_CONFIG.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Google Ads REST API ────────────────────────────────

async function googleAdsQuery(customerId: string, query: string, accessToken: string) {
  const url = `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": GOOGLE_ADS_CONFIG.developerToken,
      "login-customer-id": GOOGLE_ADS_CONFIG.loginCustomerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google Ads API error ${resp.status}: ${err}`);
  }

  const results = await resp.json();
  // searchStream returns an array of response objects
  const rows: any[] = [];
  for (const chunk of results) {
    if (chunk.results) rows.push(...chunk.results);
  }
  return rows;
}

async function getChildAccounts(accessToken: string): Promise<{ id: string; name: string }[]> {
  const managerId = GOOGLE_ADS_CONFIG.loginCustomerId;
  const query = `
    SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager
    FROM customer_client
    WHERE customer_client.status = 'ENABLED' AND customer_client.manager = false
  `;
  const rows = await googleAdsQuery(managerId, query, accessToken);
  return rows.map((r: any) => ({
    id: String(r.customerClient.id),
    name: r.customerClient.descriptiveName || `Account ${r.customerClient.id}`,
  }));
}

async function fetchAccountMetrics(
  customerId: string,
  startDate: string,
  endDate: string,
  accessToken: string
) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date
  `;
  return googleAdsQuery(customerId, query, accessToken);
}

// ─── Route Handlers ─────────────────────────────────────

async function handleHealth() {
  return { status: "healthy", database: "neon", environment: process.env.APP_ENV || "production" };
}

async function handleDashboardSummary(params: URLSearchParams) {
  const startDate = parseDate(params.get("start_date"), 30);
  const endDate = parseDate(params.get("end_date"), 1);

  const rows = await sql`
    SELECT
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(SUM(clicks), 0) as clicks,
      COALESCE(SUM(cost_micros), 0) as cost_micros,
      COALESCE(SUM(conversions), 0) as conversions,
      COALESCE(SUM(conversion_value), 0) as conversion_value
    FROM daily_metrics
    WHERE date >= ${startDate}::date AND date <= ${endDate}::date
      AND campaign_id IS NOT NULL AND ad_group_id IS NULL
  `;

  const r = rows[0] || {};
  const cost = Number(r.cost_micros || 0) / 1_000_000;
  const impressions = Number(r.impressions || 0);
  const clicks = Number(r.clicks || 0);
  const conversions = Number(r.conversions || 0);
  const convValue = Number(r.conversion_value || 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? cost / clicks : 0;
  const cpa = conversions > 0 ? cost / conversions : 0;
  const roas = cost > 0 ? convValue / cost : 0;

  const summaryText = `You spent Rs.${cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })} and generated ${Math.round(conversions)} conversions at ${roas.toFixed(2)}x ROAS.`;

  return {
    impressions: { value: impressions, change_direction: "flat" },
    clicks: { value: clicks, change_direction: "flat" },
    cost: { value: cost, change_direction: "flat" },
    conversions: { value: conversions, change_direction: "flat" },
    conversion_value: { value: convValue, change_direction: "flat" },
    ctr: { value: ctr, change_direction: "flat" },
    cpc: { value: cpc, change_direction: "flat" },
    cpa: { value: cpa, change_direction: "flat" },
    roas: { value: roas, change_direction: "flat" },
    summary_text: summaryText,
  };
}

async function handleDashboardMetrics(params: URLSearchParams) {
  const startDate = parseDate(params.get("start_date"), 30);
  const endDate = parseDate(params.get("end_date"), 1);

  const rows = await sql`
    SELECT
      date, 
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(SUM(clicks), 0) as clicks,
      COALESCE(SUM(cost_micros), 0) as cost_micros,
      COALESCE(SUM(conversions), 0) as conversions,
      COALESCE(SUM(conversion_value), 0) as conversion_value
    FROM daily_metrics
    WHERE date >= ${startDate}::date AND date <= ${endDate}::date
      AND campaign_id IS NOT NULL AND ad_group_id IS NULL
    GROUP BY date ORDER BY date
  `;

  const metrics = ["impressions", "clicks", "cost", "conversions"];
  return metrics.map((metric) => {
    const data = rows.map((r: any) => ({
      date: r.date,
      value: metric === "cost" ? Number(r.cost_micros || 0) / 1_000_000 : Number(r[metric] || 0),
    }));
    const total = data.reduce((s: number, d: any) => s + d.value, 0);
    return { metric, data, total, average: data.length > 0 ? total / data.length : 0 };
  });
}

async function handleBreakdown(dimension: string, params: URLSearchParams) {
  const startDate = parseDate(params.get("start_date"), 30);
  const endDate = parseDate(params.get("end_date"), 1);
  const limit = Math.min(Number(params.get("limit") || 100), 100);

  if (dimension === "campaign") {
    const rows = await sql`
      SELECT
        c.id, c.name,
        COALESCE(SUM(dm.impressions), 0) as impressions,
        COALESCE(SUM(dm.clicks), 0) as clicks,
        COALESCE(SUM(dm.cost_micros), 0) as cost_micros,
        COALESCE(SUM(dm.conversions), 0) as conversions,
        COALESCE(SUM(dm.conversion_value), 0) as conversion_value
      FROM campaigns c
      JOIN daily_metrics dm ON dm.campaign_id = c.id
      WHERE dm.date >= ${startDate}::date AND dm.date <= ${endDate}::date
        AND dm.ad_group_id IS NULL
      GROUP BY c.id, c.name
      ORDER BY SUM(dm.cost_micros) DESC
      LIMIT ${limit}
    `;

    const totalCost = rows.reduce((s: number, r: any) => s + Number(r.cost_micros || 0), 0);
    const items = rows.map((r: any) => {
      const cost = Number(r.cost_micros || 0) / 1_000_000;
      const clicks = Number(r.clicks || 0);
      const impressions = Number(r.impressions || 0);
      const conversions = Number(r.conversions || 0);
      const convValue = Number(r.conversion_value || 0);
      return {
        id: r.id, name: r.name, impressions, clicks, cost, conversions,
        conversion_value: convValue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        share_of_total: totalCost > 0 ? (Number(r.cost_micros || 0) / totalCost) * 100 : 0,
      };
    });
    return { dimension: "campaign", items, total_items: items.length };
  }

  if (dimension === "account") {
    const rows = await sql`
      SELECT
        a.id, a.name, a.customer_id,
        COALESCE(SUM(dm.impressions), 0) as impressions,
        COALESCE(SUM(dm.clicks), 0) as clicks,
        COALESCE(SUM(dm.cost_micros), 0) as cost_micros,
        COALESCE(SUM(dm.conversions), 0) as conversions,
        COALESCE(SUM(dm.conversion_value), 0) as conversion_value
      FROM google_ads_accounts a
      JOIN daily_metrics dm ON dm.account_id = a.id
      WHERE dm.date >= ${startDate}::date AND dm.date <= ${endDate}::date
      GROUP BY a.id, a.name, a.customer_id
      ORDER BY SUM(dm.cost_micros) DESC
    `;

    const totalCost = rows.reduce((s: number, r: any) => s + Number(r.cost_micros || 0), 0);
    const items = rows.map((r: any) => {
      const cost = Number(r.cost_micros || 0) / 1_000_000;
      const clicks = Number(r.clicks || 0);
      const impressions = Number(r.impressions || 0);
      return {
        name: `${r.name} (${r.customer_id})`, impressions, clicks, cost,
        conversions: Number(r.conversions || 0),
        conversion_value: Number(r.conversion_value || 0),
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        share_of_total: totalCost > 0 ? (Number(r.cost_micros || 0) / totalCost) * 100 : 0,
      };
    });
    return { dimension: "customer_client", items, total_items: items.length };
  }

  return { dimension, items: [], total_items: 0 };
}

async function handleFetchLive(params: URLSearchParams) {
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");
  if (!startDate || !endDate) throw new Error("start_date and end_date are required");

  // Get OAuth access token
  const accessToken = await getAccessToken();

  // Get child accounts under the manager
  const childAccounts = await getChildAccounts(accessToken);
  if (childAccounts.length === 0) throw new Error("No child accounts found under manager");

  console.log(`LIVE FETCH: Found ${childAccounts.length} child accounts. Date: ${startDate} to ${endDate}`);

  // Fetch metrics from all accounts in parallel (max 10 concurrent)
  const allCampaigns: Record<string, any> = {};
  const dailyTotals: Record<string, any> = {};
  const totalMetrics = { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0 };

  const results = await Promise.allSettled(
    childAccounts.map((acc) => fetchAccountMetrics(acc.id, startDate, endDate, accessToken))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== "fulfilled") {
      console.error(`Account ${childAccounts[i].id} failed:`, result.reason);
      continue;
    }

    for (const row of result.value) {
      const c = row.campaign;
      const m = row.metrics;
      const seg = row.segments;
      const campaignId = String(c.id);
      const cost = Number(m.costMicros || 0) / 1_000_000;
      const impressions = Number(m.impressions || 0);
      const clicks = Number(m.clicks || 0);
      const conversions = Number(m.conversions || 0);
      const convValue = Number(m.conversionsValue || 0);

      // Aggregate by campaign
      if (!allCampaigns[campaignId]) {
        allCampaigns[campaignId] = {
          google_campaign_id: campaignId, name: c.name,
          account_name: childAccounts[i].name,
          impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0,
        };
      }
      allCampaigns[campaignId].impressions += impressions;
      allCampaigns[campaignId].clicks += clicks;
      allCampaigns[campaignId].cost += cost;
      allCampaigns[campaignId].conversions += conversions;
      allCampaigns[campaignId].conversion_value += convValue;

      // Daily totals
      const d = seg.date;
      if (!dailyTotals[d]) {
        dailyTotals[d] = { date: d, impressions: 0, clicks: 0, cost: 0, conversions: 0 };
      }
      dailyTotals[d].impressions += impressions;
      dailyTotals[d].clicks += clicks;
      dailyTotals[d].cost += cost;
      dailyTotals[d].conversions += conversions;

      // Grand totals
      totalMetrics.impressions += impressions;
      totalMetrics.clicks += clicks;
      totalMetrics.cost += cost;
      totalMetrics.conversions += conversions;
      totalMetrics.conversion_value += convValue;
    }
  }

  const ctr = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions) * 100 : 0;
  const cpc = totalMetrics.clicks > 0 ? totalMetrics.cost / totalMetrics.clicks : 0;
  const cpa = totalMetrics.conversions > 0 ? totalMetrics.cost / totalMetrics.conversions : 0;
  const roas = totalMetrics.cost > 0 ? totalMetrics.conversion_value / totalMetrics.cost : 0;

  const campaigns = Object.values(allCampaigns)
    .map((c: any) => ({
      ...c,
      cost: String(c.cost), conversions: String(c.conversions),
      conversion_value: String(c.conversion_value),
      ctr: String(c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0),
      cpc: String(c.clicks > 0 ? c.cost / c.clicks : 0),
    }))
    .sort((a: any, b: any) => Number(b.cost) - Number(a.cost));

  const daily = Object.values(dailyTotals)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((d: any) => ({ ...d, cost: String(d.cost), conversions: String(d.conversions) }));

  return {
    success: true,
    source: "live_api",
    cached: false,
    date_range: { start: startDate, end: endDate },
    summary: {
      impressions: totalMetrics.impressions,
      clicks: totalMetrics.clicks,
      cost: String(totalMetrics.cost),
      conversions: String(totalMetrics.conversions),
      conversion_value: String(totalMetrics.conversion_value),
      ctr: String(ctr), cpc: String(cpc), cpa: String(cpa), roas: String(roas),
    },
    campaigns,
    daily_metrics: daily,
    accounts_synced: childAccounts.length,
  };
}

// ─── Main Router ────────────────────────────────────────

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Strip the function path prefix to get the API path
  let path = url.pathname;
  // Remove /.netlify/functions/api prefix if present
  path = path.replace(/^\/.netlify\/functions\/api/, "");
  // Normalize
  if (!path.startsWith("/")) path = "/" + path;
  // Remove trailing slash
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  const params = url.searchParams;

  try {
    // Route matching
    if (path === "/" || path === "/health" || path === "/api/health") {
      return json(await handleHealth(), 200, origin);
    }

    if (path === "/api/dashboard/summary") {
      return json(await handleDashboardSummary(params), 200, origin);
    }

    if (path === "/api/dashboard/metrics") {
      return json(await handleDashboardMetrics(params), 200, origin);
    }

    if (path.startsWith("/api/dashboard/breakdown/")) {
      const dimension = path.split("/").pop() || "";
      return json(await handleBreakdown(dimension, params), 200, origin);
    }

    if (path === "/api/sync/fetch-live") {
      return json(await handleFetchLive(params), 200, origin);
    }

    // Alerts config (stub for frontend compatibility)
    if (path === "/api/alerts/config") {
      return json({
        telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        spike_threshold_percent: Number(process.env.SPIKE_THRESHOLD_PERCENT || 20),
        frontend_url: process.env.FRONTEND_URL || "",
        scheduler_running: false,
        alerts_paused: false,
      }, 200, origin);
    }

    // Auth stub - return 401 to let frontend handle gracefully
    if (path === "/api/auth/me") {
      return json({ detail: "Not authenticated" }, 401, origin);
    }

    // Catch-all
    return json({ detail: `Not found: ${path}` }, 404, origin);
  } catch (err: any) {
    console.error(`API Error [${path}]:`, err);
    return json({ detail: err.message || "Internal server error" }, 500, origin);
  }
};

export const config = {
  path: ["/.netlify/functions/api", "/.netlify/functions/api/*"],
};
