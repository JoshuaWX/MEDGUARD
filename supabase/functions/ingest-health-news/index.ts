/** Fetches attributable NCDC and Nigeria-relevant WHO Disease Outbreak News. */
import { serve } from 'std/http/server';
import { corsHeaders } from '../_shared/cors.ts';
import { tryCreateAdminClient } from '../_shared/supabase.ts';
import { requireCronSecret } from '../_shared/request-auth.ts';

const NCDC_URL = 'https://www.ncdc.gov.ng/diseases/sitreps';
const WHO_RSS_URL = 'https://www.who.int/feeds/entity/csr/don/en/rss.xml';
const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
type Item = { external_id: string; title: string; body: string; summary: string; source: string; source_url: string; published_at: string; state: string | null };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function text(value: string) { return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
function tag(value: string, name: string) { return text(value.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? ''); }
function cdata(value: string, name: string) { return text(value.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${name}>`, 'i'))?.[1] ?? ''); }
function stateIn(value: string): string | null { return NIGERIAN_STATES.find((state) => new RegExp(`\\b${state.replace(' ', '\\s+')}\\b`, 'i').test(value)) ?? null; }
function bounded(value: string, max: number) { return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value; }

function ncdcReportItems(html: string): Item[] {
  const found: Item[] = [];
  const row = /<tr>[\s\S]*?<td>\s*\d+\s*<\/td>[\s\S]*?<td>([\s\S]*?)<\/td>[\s\S]*?<!--\s*<td>([\s\S]*?)<\/td>\s*-->[\s\S]*?href\s*=\s*["']([^"']+\.pdf)["']/gi;
  for (let match; (match = row.exec(html));) {
    const title = bounded(text(match[1]), 180); const url = new URL(match[3], NCDC_URL).toString();
    if (!title || found.some((item) => item.source_url === url)) continue;
    const parsedDate = Date.parse(text(match[2]));
    found.push({ external_id: `ncdc:${url}`, title, body: 'Read the original NCDC report for the complete official update.', summary: title, source: 'NCDC', source_url: url, published_at: Number.isNaN(parsedDate) ? new Date().toISOString() : new Date(parsedDate).toISOString(), state: stateIn(title) });
    if (found.length >= 4) break;
  }
  return found;
}

async function ncdcItems(): Promise<Item[]> {
  const index = await (await fetch(NCDC_URL, { headers: { Accept: 'text/html' } })).text();
  const categoryLinks = [...index.matchAll(/href\s*=\s*["']([^"']*\/diseases\/sitreps\/\?cat=\d+[^"']*)["']/gi)]
    .map((match) => new URL(match[1], NCDC_URL).toString());
  const links = [...new Set(categoryLinks)].slice(0, 8);
  const reports: Item[] = [];
  for (const link of links) {
    const page = await (await fetch(link, { headers: { Accept: 'text/html' } })).text();
    reports.push(...ncdcReportItems(page));
    if (reports.length >= 20) break;
  }
  return reports.slice(0, 20);
}

function whoItems(xml: string): Item[] {
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []).flatMap((item) => {
    const title = bounded(cdata(item, 'title') || tag(item, 'title'), 180);
    const link = tag(item, 'link'); const summary = bounded(cdata(item, 'description') || tag(item, 'description'), 500);
    if (!title || !link || !/nigeria/i.test(`${title} ${summary}`)) return [];
    const parsed = Date.parse(tag(item, 'pubDate'));
    const publishedAt = Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
    return [{ external_id: `who:${link}`, title, body: summary || 'Read the original WHO Disease Outbreak News update.', summary, source: 'WHO Disease Outbreak News', source_url: link, published_at: publishedAt, state: stateIn(`${title} ${summary}`) }];
  });
}

async function ingestSource(admin: any, source: string, load: () => Promise<Item[]>) {
  const attempted = new Date().toISOString();
  try {
    const items = await load();
    let added = 0;
    if (items.length) {
      const externalIds = items.map((item) => item.external_id);
      const { data: existing, error: existingError } = await admin.from('health_posts').select('external_id').in('external_id', externalIds);
      if (existingError) throw existingError;
      const known = new Set((existing ?? []).map((row: { external_id: string }) => row.external_id));
      added = externalIds.filter((id) => !known.has(id)).length;
      const { error } = await admin.from('health_posts').upsert(items.map((item) => ({ ...item, category: 'official_update', status: 'published' })), { onConflict: 'external_id', ignoreDuplicates: true });
      if (error) throw error;
    }
    await admin.from('health_feed_status').upsert({ source, last_attempt_at: attempted, last_success_at: new Date().toISOString(), last_error: null, items_added: added, updated_at: new Date().toISOString() });
    return added;
  } catch (error) {
    await admin.from('health_feed_status').upsert({ source, last_attempt_at: attempted, last_error: 'source fetch or parse failed', items_added: 0, updated_at: new Date().toISOString() });
    console.error(JSON.stringify({ event: 'health_news_source_failed', source }));
    return 0;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = requireCronSecret(req); if (!auth.ok) return json({ error: auth.error }, auth.status);
  const admin = tryCreateAdminClient(); if (!admin) return json({ error: 'service_role_not_configured' }, 500);
  const ncdc = await ingestSource(admin, 'NCDC', ncdcItems);
  const who = await ingestSource(admin, 'WHO Disease Outbreak News', async () => whoItems(await (await fetch(WHO_RSS_URL, { headers: { Accept: 'application/rss+xml, application/xml' } })).text()));
  return json({ added: ncdc + who });
});
