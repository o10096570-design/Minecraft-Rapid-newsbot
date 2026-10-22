// post_videos.js - YouTube channels ke naye videos ka link Telegram channel pe post karta hai
// Telegram link ka preview + play button khud dikha deta hai.
// Node 18+ chahiye (fetch built-in hai).

const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHANNEL || "@minecraftrapidnews";

// YouTube handles (bina @ ke)
const HANDLES = ["IMTIYANO", "rodieeno", "sillytrollcore", "KiLLeRs_Anas"];

const MAX_POSTS_PER_RUN = 2;
const MAX_AGE_HOURS = 72; // sirf pichle 3 din ke videos
const POSTED_FILE = "posted_videos.json";

if (!TOKEN) {
  console.error("BOT_TOKEN missing");
  process.exit(1);
}

const posted = fs.existsSync(POSTED_FILE)
  ? JSON.parse(fs.readFileSync(POSTED_FILE, "utf8"))
  : [];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Cookie: "CONSENT=YES+1; SOCS=CAI",
};

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.description}`);
  return data;
}

async function getChannelId(handle) {
  const res = await fetch(`https://www.youtube.com/@${handle}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`@${handle}: page HTTP ${res.status}`);
  const html = await res.text();
  const m =
    html.match(/channel_id=(UC[\w-]{22})/) ||
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/);
  if (!m) throw new Error(`@${handle}: channel id nahi mila`);
  return m[1];
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function getVideos(channelId) {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    { headers: HEADERS }
  );
  if (!res.ok) throw new Error(`feed ${channelId}: HTTP ${res.status}`);
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => ({
    id: (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1],
    title: decode((e.match(/<title>([^<]*)<\/title>/) || [])[1] || ""),
    published: new Date((e.match(/<published>([^<]+)<\/published>/) || [])[1]),
    author: decode((e.match(/<name>([^<]*)<\/name>/) || [])[1] || ""),
  }));
}

async function main() {
  const candidates = [];

  for (const handle of HANDLES) {
    try {
      const channelId = await getChannelId(handle);
      const videos = await getVideos(channelId);
      console.log(`@${handle}: ${videos.length} videos mile`);
      for (const v of videos) {
        if (!v.id || isNaN(v.published)) continue;
        const ageHours = (Date.now() - v.published.getTime()) / 36e5;
        if (ageHours > MAX_AGE_HOURS) continue;
        if (posted.includes(v.id)) continue;
        candidates.push(v);
      }
    } catch (e) {
      console.error(e.message);
    }
  }

  // sabse naye pehle
  candidates.sort((a, b) => b.published - a.published);

  let sent = 0;
  for (const v of candidates) {
    if (sent >= MAX_POSTS_PER_RUN) break;
    try {
      await tg("sendMessage", {
        chat_id: CHAT,
        text: `${v.title}\n\nby ${v.author}\nhttps://www.youtube.com/watch?v=${v.id}`,
      });
      posted.push(v.id);
      sent++;
      console.log("Posted:", v.id, v.title);
    } catch (e) {
      console.error("Skip", v.id, e.message);
    }
  }

  fs.writeFileSync(POSTED_FILE, JSON.stringify(posted.slice(-500), null, 2));
  console.log(`Done. ${sent} video(s) sent.`);
}

main();
