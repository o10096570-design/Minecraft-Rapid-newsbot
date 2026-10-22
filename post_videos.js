// Minecraft Rapid newsBot 🎮
// YouTube videos → Telegram channel

const TOKEN =
  process.env.BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN;

const CHAT =
  process.env.TELEGRAM_CHAT_ID ||
  "@minecraftrapidnews";

const MAX_POSTS_PER_RUN = 1;
const MAX_AGE_HOURS = 24 * 365;

const CHANNELS = [
  {
    name: "IMTIYANO",
    id: "UCR86w7GYzQhYJvNHO5QeUzA"
  },
  {
    name: "RODIEENO",
    id: "UCjBN6VhzOiJr52TayrXKD9A"
  },
  {
    name: "SillyTroll",
    id: "UCGfncqvN4RGTFDrHuDFKqEQ"
  },
  {
    name: "KiLLeRs | Anas",
    id: "UComdhq9zb8N6Qw7OvpOyDBg"
  }
];

const fs = require("fs");
const path = require("path");

const POSTED_FILE = path.join(
  process.cwd(),
  "posted_videos.json"
);

if (!TOKEN) {
  throw new Error("Telegram bot token is missing!");
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; MinecraftRadarBot/1.0)"
};

async function tg(method, data) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.description || "Telegram API error"
    );
  }

  return result;
}

function decode(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function loadPosted() {
  try {
    return JSON.parse(
      fs.readFileSync(POSTED_FILE, "utf8")
    );
  } catch {
    return [];
  }
}

function savePosted(ids) {
  fs.writeFileSync(
    POSTED_FILE,
    JSON.stringify(ids.slice(-1000), null, 2)
  );
}

async function getChannelVideos(channel) {
  const feedUrl =
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;

  const response = await fetch(feedUrl, {
    headers: HEADERS
  });

  if (!response.ok) {
    throw new Error(
      `YouTube feed error for ${channel.name}: ${response.status}`
    );
  }

  const xml = await response.text();
  const entries = xml.split("<entry>").slice(1);

  return entries.map(entry => {
    const id =
      (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];

    const rawTitle =
      (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";

    const published =
      (entry.match(/<published>([^<]+)<\/published>/) || [])[1];

    const author =
      (entry.match(/<name>([\s\S]*?)<\/name>/) || [])[1];

    return {
      id,
      title: decode(rawTitle),
      published: published ? new Date(published) : new Date(0),
      author: decode(author || channel.name),
      url: `https://www.youtube.com/watch?v=${id}`
    };
  }).filter(video => video.id && video.title);
}

async function postVideo(video) {
  const channelName = video.author || "Minecraft Creator";

  const title = video.title.length > 850
    ? video.title.slice(0, 847) + "..."
    : video.title;

  const caption =
    `🔥 ${title}\n\n` +
    `🎮 Minecraft Videos\n` +
    `📺 Channel: ${channelName}\n\n` +
    `📢 @minecraftrapidnews`;

  const keyboard = {
    inline_keyboard: [[
      {
        text: "▶ Watch on YouTube",
        url: video.url
      }
    ]]
  };

  const thumbnails = [
    `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
  ];

  for (const photo of thumbnails) {
    try {
      await tg("sendPhoto", {
        chat_id: CHAT,
        photo,
        caption,
        reply_markup: keyboard
      });

      console.log("Posted video:", video.title);
      return;
    } catch (error) {
      console.log("Thumbnail failed:", error.message);
    }
  }

  await tg("sendMessage", {
    chat_id: CHAT,
    text: caption,
    disable_web_page_preview: true,
    reply_markup: keyboard
  });

  console.log("Posted without thumbnail:", video.title);
}

async function main() {
  const posted = loadPosted();
  const postedSet = new Set(posted);
  const cutoff =
    Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;

  let videos = [];

  for (const channel of CHANNELS) {
    try {
      const channelVideos = await getChannelVideos(channel);

      videos.push(...channelVideos);

      console.log(
        `Fetched ${channelVideos.length} videos from ${channel.name}`
      );
    } catch (error) {
      console.error(
        `Could not fetch ${channel.name}:`,
        error.message
      );
    }
  }

  videos = videos
    .filter(video =>
      video.id &&
      video.title &&
      video.published.getTime() >= cutoff &&
      !postedSet.has(video.id)
    )
    .sort((a, b) =>
      b.published.getTime() - a.published.getTime()
    );

  const selected = videos.slice(0, MAX_POSTS_PER_RUN);

  if (selected.length === 0) {
    console.log("No new eligible videos found.");
    return;
  }

  for (const video of selected) {
    await postVideo(video);

    posted.push(video.id);
    postedSet.add(video.id);
    savePosted(posted);
  }
}

main().catch(error => {
  console.error("Bot failed:", error);
  process.exitCode = 1;
});
