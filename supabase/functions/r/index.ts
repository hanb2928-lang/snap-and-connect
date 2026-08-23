import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /preview/i,
  /fetcher/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /kakaotalk/i,
  /\bline\b/i,
  /slackbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /discordbot/i,
  /linkedinbot/i,
  /skypeuripreview/i,
  /google/i,
  /bing/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /applebot/i,
  /petalbot/i,
  /imagesift/i,
  /monitor/i,
  /uptime/i,
];

function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function detectPlatform(url: string): string {
  if (/coupang\.com/i.test(url)) return "Coupang";
  if (/brandconnect\.naver\.com|naver\.com/i.test(url)) return "BrandConnect";
  if (/toss\.(to|im)/i.test(url)) return "Toss";
  return "기타";
}

function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
      return new Response("Not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Service unavailable", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("short_links")
      .select("destination_url, scan_id")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      return new Response("Short link not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const destination = data.destination_url;
    if (!isSafeRedirectUrl(destination)) {
      return new Response("Invalid redirect target", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";

    if (!isBot(userAgent)) {
      try {
        await supabase.rpc("increment_click_count", { slug_input: slug });
      } catch {
        // Click tracking is best-effort; don't fail the redirect
      }

      try {
        await supabase.from("click_events").insert({
          short_link_slug: slug,
          scan_id: data.scan_id || null,
          platform: detectPlatform(destination),
          user_agent: userAgent.substring(0, 500),
          referer: referer.substring(0, 500),
        });
      } catch {
        // Analytics logging is best-effort
      }
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: destination,
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
