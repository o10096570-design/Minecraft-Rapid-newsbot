// post_memes.js - Minecraft memes Telegram channel pe post karta hai
// Reddit seedha GitHub ko block karta hai (403), isliye meme-api.com use karte hain.
// Har post ke saath original creator ka credit + link jata hai.
// Node 18+ chahiye (fetch built-in hai).

const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHANNEL || "@minecraftrapidnews";
const SUBREDDITS = ["Minecraft", "MinecraftMemes"];
const MAX_POSTS_PER_RUN = 3;
const MIN_SCORE = 300; // sirf popular posts
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

async function getMemes(sub) {
  const res = await fetch(`https://meme-api.com/gimme/${sub}/30`, {
    headers: { "User-Agent": "minecraft-rapid-newsbot/1.0" },
  });
  if (!res.ok) throw new Error(`meme-api ${sub}: HTTP ${res.status}`);
  const json = await res.json();
  return json.memes || [];
}

function makeCaption(m) {
  const title = m.title.length > 200 ? m.title.slice(0, 197) + "..." : m.title;
  return `😂 ${title}\n\nCredit: u/${m.author} on r/${m.subreddit}\n${m.postLink}\n\n#Minecraft #MinecraftMemes\n📢 @minecraftrapidnews`;
}

async function main() {
  let sent = 0;

  for (const sub of SUBREDDITS) {
    if (sent >= MAX_POSTS_PER_RUN) break;

    let memes;
    try {
      memes = await getMemes(sub);
    } catch (e) {
      console.error(e.message);
      continue;
    }
    console.log(`${sub}: ${memes.length} memes mile`);

    // sabse popular pehle
    memes.sort((a, b) => b.ups - a.ups);

    for (const m of memes) {
      if (sent >= MAX_POSTS_PER_RUN) break;
      if (m.nsfw || m.spoiler || m.ups < MIN_SCORE) continue;
      if (posted.includes(m.postLink)) continue;
      const isGif = /\.gif$/i.test(m.url);
      if (!isGif && !/\.(jpe?g|png)$/i.test(m.url)) continue;

      try {
        if (isGif) {
          // GIF / animation
          await tg("sendAnimation", {
            chat_id: CHAT,
            animation: m.url,
            caption: makeCaption(m),
          });
        } else {
          await tg("sendPhoto", {
            chat_id: CHAT,
            photo: m.url,
            caption: makeCaption(m),
          });
        }
        posted.push(m.postLink);
        sent++;
        console.log("Posted:", m.postLink);
      } catch (e) {
        console.error("Skip", m.postLink, e.message);
      }
    }
  }

  fs.writeFileSync(POSTED_FILE, JSON.stringify(posted.slice(-500), null, 2));
  console.log(`Done. ${sent} post(s) sent.`);
}

main();
