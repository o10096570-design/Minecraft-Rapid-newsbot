// post_memes.js - Reddit se top Minecraft memes uthake Telegram channel pe post karta hai
// Har post ke saath original creator ka credit + link jata hai.
// Node 18+ chahiye (fetch built-in hai).

const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHANNEL || "@minecraftrapidnews";
const SUBREDDITS = ["Minecraft", "MinecraftMemes"];
const MAX_POSTS_PER_RUN = 3;
const MIN_SCORE = 500; // sirf viral posts
const POSTED_FILE = "posted.json";

if (!TOKEN) {
  console.error("BOT_TOKEN missing");
  process.exit(1);
}

const posted = fs.existsSync(POSTED_FILE)
  ? JSON.parse(fs.readFileSync(POSTED_FILE, "utf8"))
  : [];

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

async function getTopPosts(sub) {
  const res = await fetch(
    `https://www.reddit.com/r/${sub}/top.json?t=day&limit=25`,
    { headers: { "User-Agent": "minecraft-rapid-newsbot/1.0" } }
  );
  if (!res.ok) throw new Error(`Reddit ${sub}: HTTP ${res.status}`);
  const json = await res.json();
  return json.data.children.map((c) => c.data);
}

function makeCaption(p) {
  const title = p.title.length > 200 ? p.title.slice(0, 197) + "..." : p.title;
  return `${title}\n\nCredit: u/${p.author} on r/${p.subreddit}\nhttps://reddit.com${p.permalink}`;
}

async function main() {
  let sent = 0;

  for (const sub of SUBREDDITS) {
    if (sent >= MAX_POSTS_PER_RUN) break;

    let posts;
    try {
      posts = await getTopPosts(sub);
    } catch (e) {
      console.error(e.message);
      continue;
    }

    for (const p of posts) {
      if (sent >= MAX_POSTS_PER_RUN) break;
      if (p.over_18 || p.stickied || p.score < MIN_SCORE) continue;
      if (posted.includes(p.id)) continue;

      try {
        if (p.post_hint === "image" && /\.(jpe?g|png)$/i.test(p.url)) {
          // Photo / meme
          await tg("sendPhoto", {
            chat_id: CHAT,
            photo: p.url,
            caption: makeCaption(p),
          });
        } else if (p.is_video) {
          // Video: Reddit video mein audio alag hoti hai, isliye link bhejte hain
          // Telegram khud preview dikha deta hai
          await tg("sendMessage", {
            chat_id: CHAT,
            text: makeCaption(p),
          });
        } else {
          continue; // baaki types skip
        }
        posted.push(p.id);
        sent++;
        console.log("Posted:", p.id, p.title);
      } catch (e) {
        console.error("Skip", p.id, e.message);
      }
    }
  }

  fs.writeFileSync(POSTED_FILE, JSON.stringify(posted.slice(-500), null, 2));
  console.log(`Done. ${sent} post(s) sent.`);
}

main();
