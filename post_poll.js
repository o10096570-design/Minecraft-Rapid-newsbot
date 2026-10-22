// post_poll.js - Roz ek Minecraft poll ya quiz Telegram channel pe post karta hai
// Sawaal list mein se ek ke baad ek aata hai, khatam hone pe dobara shuru.
// Node 18+ chahiye (fetch built-in hai).

const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHANNEL || "@minecraftrapidnews";
const STATE_FILE = "poll_state.json";
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN) {
  console.error("BOT_TOKEN missing");
  process.exit(1);
}

// type "poll" = opinion poll, type "quiz" = sahi jawab wala (correct = option ka number, 0 se shuru)
const QUESTIONS = [
  {
    type: "poll",
    q: "Sabse best biome kaunsa hai?",
    options: ["Plains", "Forest", "Mountains", "Desert", "Cherry Grove"],
  },
  {
    type: "quiz",
    q: "Creeper kis janwar se darta hai aur door bhaagta hai?",
    options: ["Wolf", "Cat", "Villager", "Iron Golem"],
    correct: 1,
    explain: "Creepers cats (aur ocelots) se door bhaagte hain. Cat paas rakho, creeper se bacho!",
  },
  {
    type: "poll",
    q: "Tumhara favourite mob kaunsa hai?",
    options: ["Creeper", "Enderman", "Axolotl", "Wolf", "Villager"],
  },
  {
    type: "quiz",
    q: "Nether portal ka frame kis block se banta hai?",
    options: ["Stone", "Obsidian", "Bedrock", "Netherrack"],
    correct: 1,
    explain: "Nether portal obsidian se banta hai (minimum 10 blocks) aur flint and steel se jalta hai.",
  },
  {
    type: "poll",
    q: "Java ya Bedrock, tum kaunsa khelte ho?",
    options: ["Java", "Bedrock (mobile/console)", "Dono"],
  },
  {
    type: "quiz",
    q: "Wither banane ke liye kitni Wither Skeleton skulls chahiye?",
    options: ["1", "2", "3", "4"],
    correct: 2,
    explain: "Wither ke liye 3 Wither Skeleton skulls aur 4 Soul Sand/Soul Soil chahiye hote hain.",
  },
  {
    type: "poll",
    q: "Survival mein sabse pehle kya karte ho?",
    options: ["Ped kaatna", "Ghar banana", "Khana dhundhna", "Mining"],
  },
  {
    type: "quiz",
    q: "Netherite Ingot banane ke liye 4 Netherite Scrap ke saath kya chahiye?",
    options: ["4 Iron Ingots", "4 Gold Ingots", "4 Diamonds", "4 Emeralds"],
    correct: 1,
    explain: "4 Netherite Scrap + 4 Gold Ingots = 1 Netherite Ingot.",
  },
  {
    type: "poll",
    q: "Best weapon kaunsa hai?",
    options: ["Sword", "Axe", "Bow", "Trident", "Mace"],
  },
  {
    type: "quiz",
    q: "Villagers trade mein kaunsi cheez (currency) lete aur dete hain?",
    options: ["Gold Ingot", "Emerald", "Diamond", "Iron Ingot"],
    correct: 1,
    explain: "Villagers ki main currency Emerald hai.",
  },
  {
    type: "poll",
    q: "Tumhara favourite dimension kaunsa hai?",
    options: ["Overworld", "Nether", "The End"],
  },
  {
    type: "quiz",
    q: "Warden kis biome mein milta hai?",
    options: ["Lush Caves", "Deep Dark", "Dripstone Caves", "Mushroom Fields"],
    correct: 1,
    explain: "Warden Deep Dark biome ke Ancient Cities mein milta hai. Chup chaap chalna!",
  },
  {
    type: "poll",
    q: "Sabse irritating mob kaunsa hai?",
    options: ["Creeper", "Phantom", "Skeleton", "Silverfish", "Pillager"],
  },
  {
    type: "quiz",
    q: "Survival mode mein kaunsa block normal tareeke se toda nahi ja sakta?",
    options: ["Obsidian", "Bedrock", "Diamond Block", "Netherite Block"],
    correct: 1,
    explain: "Bedrock survival mein normal tareeke se nahi tootta.",
  },
  {
    type: "poll",
    q: "Tum Minecraft kis device pe khelte ho?",
    options: ["Mobile", "PC / Laptop", "Console"],
  },
  {
    type: "quiz",
    q: "Phantoms kab spawn hote hain?",
    options: [
      "Zyada mining karne pe",
      "Kuch din bina soye rehne pe",
      "Barish mein",
      "Sirf Nether mein",
    ],
    correct: 1,
    explain: "Kuch in-game din bina soye rehne pe Phantoms aate hain. Bed use karo!",
  },
  {
    type: "poll",
    q: "Best pet kaunsa hai?",
    options: ["Wolf", "Cat", "Parrot", "Horse", "Axolotl"],
  },
  {
    type: "quiz",
    q: "Elytra (udne wale wings) kahan milta hai?",
    options: ["Nether Fortress", "End City ke ship mein", "Ocean Monument", "Village"],
    correct: 1,
    explain: "Elytra End Cities ke End Ship mein item frame mein milta hai.",
  },
  {
    type: "poll",
    q: "Kaunsa game mode pasand hai?",
    options: ["Survival", "Creative", "Hardcore", "Adventure"],
  },
  {
    type: "quiz",
    q: "Bijli girne pe pig kya ban jata hai?",
    options: ["Zombie", "Zombified Piglin", "Piglin Brute", "Hoglin"],
    correct: 1,
    explain: "Pig pe bijli girne se wo Zombified Piglin ban jata hai.",
  },
  {
    type: "poll",
    q: "Ghar kis block ka banana pasand karte ho?",
    options: ["Wood", "Stone / Cobblestone", "Bricks", "Quartz / Glass"],
  },
  {
    type: "quiz",
    q: "Axolotl ko pakadne ke liye kya chahiye?",
    options: ["Water Bucket", "Lava Bucket", "Milk Bucket", "Net"],
    correct: 0,
    explain: "Axolotl ko Water Bucket se pakda ja sakta hai.",
  },
];

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

const TOPICS = [
  "mobs", "biomes", "crafting recipes", "redstone", "enchantments", "blocks",
  "items aur tools", "structures (village, temple, stronghold)", "farming",
  "mining aur ores", "Nether", "The End", "building aur design", "PvP aur weapons",
  "potions aur brewing", "pets aur animals", "survival tips", "mobile players ke tips",
  "Minecraft history", "fun aur funny situations",
];

function validate(o, type) {
  if (!o || typeof o.q !== "string" || !Array.isArray(o.options)) return null;
  const options = o.options
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((s) => s.slice(0, 90));
  if (options.length < 2) return null;
  const item = { type, q: o.q.trim().slice(0, 250), options };
  if (type === "quiz") {
    const c = Number(o.correct);
    if (!Number.isInteger(c) || c < 0 || c >= options.length || !o.explain) return null;
    item.correct = c;
    item.explain = String(o.explain).slice(0, 190);
  }
  return item;
}

function extractJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (_) {
    return null;
  }
}

async function askGroq(prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function askGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 1 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// AI se naya sawaal banwata hai. Fail hone pe null deta hai (tab purani list use hogi)
async function generateWithAI(type, recent) {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const isQuiz = type === "quiz";
  const prompt = `Tum ek Minecraft expert ho. Telegram channel ke liye ek ${
    isQuiz ? "quiz sawaal (sirf ek sahi jawab)" : "opinion poll sawaal"
  } banao. Topic: ${topic}.
Bhasha: friendly Hinglish (Roman Hindi + English Minecraft words).
Rules: sirf pakke aur sahi Minecraft facts likho, andaza mat lagao. Sawaal 200 characters se chhota. 3 se 5 options, har option 60 characters se chhota.${
    isQuiz
      ? " 'correct' mein sahi option ka index (0 se shuru) do aur 'explain' mein 150 characters se chhota explanation do."
      : ""
  }
Ye sawaal pehle aa chuke hain, inhe ya inse milte-julte mat banao:
${recent.slice(-40).map((q) => "- " + q).join("\n") || "(koi nahi)"}
Sirf valid JSON do, aur kuch nahi: {"q":"...","options":["...","..."]${
    isQuiz ? ',"correct":0,"explain":"..."' : ""
  }}`;

  const askers = [];
  if (GROQ_KEY) askers.push(["Groq", askGroq]);
  if (GEMINI_KEY) askers.push(["Gemini", askGemini]);

  for (const [name, ask] of askers) {
    try {
      const item = validate(extractJson(await ask(prompt)), type);
      if (!item) {
        console.error(`${name}: jawab sahi format mein nahi tha`);
        continue;
      }
      if (recent.some((q) => q.toLowerCase() === item.q.toLowerCase())) {
        console.error(`${name}: sawaal repeat tha`);
        continue;
      }
      console.log(`Sawaal ${name} se bana (topic: ${topic})`);
      return item;
    } catch (e) {
      console.error(`${name}: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : {};
  state.next = state.next || 0;
  state.count = state.count || 0;
  state.recent = state.recent || [];

  // ek din poll, ek din quiz
  const wantType = state.count % 2 === 0 ? "poll" : "quiz";
  let item = await generateWithAI(wantType, state.recent);
  let i = -1;

  if (!item) {
    console.log("AI se nahi bana, list wala sawaal use kar raha hu");
    i = state.next % QUESTIONS.length;
    item = QUESTIONS[i];
  }

  const payload = {
    chat_id: CHAT,
    question: `⛏️ ${item.q}`,
    options: item.options,
    is_anonymous: true, // channels mein poll anonymous hi hota hai
  };

  if (item.type === "quiz") {
    payload.type = "quiz";
    payload.correct_option_id = item.correct;
    payload.explanation = item.explain;
  }

  await tg("sendPoll", payload);
  console.log(`Posted ${item.type}: ${item.q}`);

  state.count += 1;
  state.recent = [...state.recent, item.q].slice(-60);
  if (i >= 0) state.next = (i + 1) % QUESTIONS.length;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
