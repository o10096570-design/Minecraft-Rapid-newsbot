// post_videos.js - YouTube channels ke naye videos ka link Telegram channel pe post karta hai
// Telegram link ka preview + play button khud dikha deta hai.
// Node 18+ chahiye (fetch built-in hai).

const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHANNEL || "@minecraftrapidnews";

// Channel IDs (verified)
const CHANNELS = [
  { name: "IMTIYANO", id: "UCR86w7GYzQhYJvNHO5QeUzA" },
  { name: "RODIEENO", id: "UCjBN6VhzOiJr52TayrXKD9A" },
  { name: "SillyTroll", id: "UCGfncqvN4RGTFDrHuDFKqEQ" },
  { name: "KiLLeRs | Anas", id: "UComdhq9zb8N6Qw7OvpOyDBg" },
];

const MAX_POSTS_PER_RUN = 1; // 4 runs/din x 1 = roz 4 videos
const MAX_AGE_HOURS = 24 * 365; // purane videos bhi chalenge (naye pehle jayenge)
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Do alag feed URLs try karta hai (kabhi ek 404 deta hai, doosra chal jata hai)
async function fetchFeed(channelId) {
  const urls = [
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    // uploads playlist: UC... -> UU...
    `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${channelId.slice(2)}`,
  ];
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: HEADERS });
        if (res.ok) return await res.text();
        lastErr = `HTTP ${res.status}`;
      } catch (e) {
        lastErr = e.message;
      }
    }
    await sleep(1500);
  }
  throw new Error(`feed ${channelId}: ${lastErr}`);
}

function parseVideos(xml) {
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => ({
    id: (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1],
    title: decode((e.match(/<title>([^<]*)<\/title>/) || [])[1] || ""),
    published: new Date((e.match(/<published>([^<]+)<\/published>/) || [])[1]),
    author: decode((e.match(/<name>([^<]*)<\/name>/) || [])[1] || ""),
  }));
}

// Thumbnail photo + title + creator credit + "Watch" button
async function postVideo(v) {
  const link = `https://www.youtube.com/watch?v=${v.id}`;
  const title = v.title.length > 200 ? v.title.slice(0, 197) + "..." : v.title;
  const caption = `${title}\n\nby ${v.author}\n${link}`;
  const reply_markup = {
    inline_keyboard: [[{ text: "▶ Watch on YouTube", url: link }]],
  };

  const thumbs = [
    `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
  ];

  for (const photo of thumbs) {
    try {
      await tg("sendPhoto", { chat_id: CHAT, photo, caption, reply_markup });
      return;
    } catch (e) {
      console.error("thumbnail fail:", e.message);
    }
  }

  // aakhri bachao: sirf link bhejo (bada preview ke saath)
  await tg("sendMessage", {
    chat_id: CHAT,
    text: caption,
    reply_markup,
    link_preview_options: { url: link, prefer_large_media: true },
  });
}

// Backup: feed 404 de toh channel ke /videos aur /shorts pages se video IDs nikalta hai
async function scrapeChannel(ch) {
  const out = [];
  for (const tab of ["videos", "shorts"]) {
    try {
      const res = await fetch(`https://www.youtube.com/channel/${ch.id}/${tab}`, {
        headers: HEADERS,
      });
      if (!res.ok) {
        console.error(`${ch.name}/${tab}: page HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const seen = new Set();
      const re = /"videoId":"([\w-]{11})"/g;
      let m;
      let idx = 0;
      while ((m = re.exec(html)) && idx < 15) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        const win = html.slice(m.index, m.index + 1500);
        const t =
          win.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) ||
          win.match(/"(?:headline|title)":\{"simpleText":"((?:[^"\\]|\\.)*)"/);
        let title = `New video from ${ch.name}`;
        if (t) {
          try {
            title = JSON.parse(`"${t[1]}"`);
          } catch (_) {}
        }
        out.push({
          id: m[1],
          title,
          author: ch.name,
          // page se date nahi milti, isliye order ke hisaab se nakli date
          published: new Date(Date.now() - (idx + (tab === "shorts" ? 0.5 : 0)) * 36e5),
        });
        idx++;
      }
    } catch (e) {
      console.error(`${ch.name}/${tab}: ${e.message}`);
    }
  }
  return out;
}

async function main() {
  const candidates = [];

  for (const ch of CHANNELS) {
    try {
      let videos;
      try {
        videos = parseVideos(await fetchFeed(ch.id));
      } catch (e) {
        console.error(`${ch.name}: feed fail (${e.message}), page se try kar raha hu`);
        videos = await scrapeChannel(ch);
      }
      console.log(`${ch.name}: ${videos.length} videos mile`);
      for (const v of videos) {
        if (!v.id || isNaN(v.published)) continue;
        const ageHours = (Date.now() - v.published.getTime()) / 36e5;
        if (ageHours > MAX_AGE_HOURS) continue;
        if (posted.includes(v.id)) continue;
        candidates.push(v);
      }
    } catch (e) {
      console.error(`${ch.name}: ${e.message}`);
    }
    await sleep(500);
  }

  console.log(`${candidates.length} naye video(s) candidate hain`);

  // sabse naye pehle
  candidates.sort((a, b) => b.published - a.published);

  let sent = 0;
  for (const v of candidates) {
    if (sent >= MAX_POSTS_PER_RUN) break;
    try {
      await postVideo(v);
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
