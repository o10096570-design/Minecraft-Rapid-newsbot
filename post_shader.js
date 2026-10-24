// post_shader.js - shaders.json se roz agla shader channel pe post karta hai.
// List khatam hone par dobara shuru se repeat karta hai (REPEAT=false se band ho jata hai).
// Node 20+ chahiye.

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHANNEL || "@minecraftrapidnews";
const OWNER = process.env.OWNER_CHAT_ID; // optional: tumhara chat ID, alerts ke liye
const REPEAT = process.env.REPEAT !== "false";
const DRY = process.env.DRY_RUN === "1"; // test: Telegram pe bhejne ki jagah print karta hai
const LIST_FILE = "shaders.json";
const STATE_FILE = "shader_state.json";

if (!TOKEN && !DRY) {
  console.error("BOT_TOKEN missing");
  process.exit(1);
}

const TIERS = {
  low: "🟢 Low-end phones ke liye / For low-end phones",
  medium: "🟡 Mid-range phones ke liye / For mid-range phones",
  high: "🔴 High-end phones ke liye / For high-end phones",
};

async function tg(method, body) {
  if (DRY) { console.log(`[DRY] ${method}`, JSON.stringify(body, null, 2)); return; }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.description}`);
}

async function sendFile(filePath, caption, markup) {
  if (DRY) { console.log(`[DRY] sendDocument file=${filePath}\n${caption}`); return; }
  const form = new FormData();
  form.append("chat_id", CHAT);
  form.append("caption", caption);
  form.append("reply_markup", JSON.stringify(markup));
  form.append("document", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`sendDocument failed: ${data.description}`);
}

async function alertOwner(text) {
  if (!OWNER) { console.log("(owner alert):", text); return; }
  try { await tg("sendMessage", { chat_id: OWNER, text }); }
  catch (e) { console.error("Owner alert fail:", e.message); }
}

const isValid = (s) =>
  s && s.name && s.enabled !== false &&
  /^https:\/\/\S+$/.test(s.url || "") && !/PASTE|YAHAN/i.test(s.url);

function buildCaption(s, cfg, round) {
  const lines = [];
  lines.push(round > 1 ? "🔁✨ SHADER (phir se dekho) ✨" : "✨ SHADER OF THE DAY ✨");
  lines.push("");
  lines.push(`🎨 ${s.name}`);
  lines.push(TIERS[s.tier] || "");
  lines.push(`🎮 Minecraft Bedrock (Mobile)${s.version ? " | v" + s.version : ""}`);
  if (s.description) lines.push(`\n📝 ${s.description}`);
  if (s.creator) lines.push(`\n👤 Creator: ${s.creator} (full credit 🙏)`);
  if (cfg.group_url) lines.push(`❓ Dikkat? Group mein pucho / Ask in the group: ${cfg.group_url}`);
  lines.push("\n#Minecraft #Shaders #MinecraftBedrock");
  lines.push("📢 @minecraftrapidnews");
  return lines.filter((l) => l !== "").join("\n").slice(0, 1000);
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(LIST_FILE, "utf8"));
  const list = (cfg.shaders || []).filter(isValid);
  if (!list.length) {
    await alertOwner("⚠️ shaders.json mein koi valid shader nahi mila (link ya naam check karo).");
    console.error("Koi valid shader nahi");
    process.exit(0);
  }

  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : { next: 0, round: 1 };
  state.next = state.next || 0;
  state.round = state.round || 1;

  if (state.next >= list.length) {
    if (!REPEAT) {
      console.log("List khatam, REPEAT band hai. Kuch post nahi hoga.");
      return;
    }
    state.next = 0;
    state.round += 1;
  }

  const s = list[state.next];
  const caption = buildCaption(s, cfg, state.round);
  const hasFile = !!(s.file && fs.existsSync(s.file));
  const buttons = [];
  if (hasFile && process.env.GITHUB_REPOSITORY) {
    const branch = process.env.GITHUB_REF_NAME || "main";
    const raw = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${branch}/${s.file.split("/").map(encodeURIComponent).join("/")}`;
    buttons.push([{ text: "⚡ Direct Download", url: raw }]);
  }
  buttons.push([{ text: "⬇️ Official Download", url: s.url }]);
  if (cfg.tutorial_url) buttons.push([{ text: "📖 Kaise lagayein / How to install", url: cfg.tutorial_url }]);
  const markup = { inline_keyboard: buttons };

  if (hasFile) {
    await sendFile(s.file, caption, markup);
  } else {
    await tg("sendMessage", {
      chat_id: CHAT, text: caption, reply_markup: markup,
      link_preview_options: { is_disabled: true },
    });
  }
  console.log(`Posted (round ${state.round}): ${s.name}`);

  state.next += 1;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  if (state.next >= list.length) {
    await alertOwner(
      REPEAT
        ? `✅ Saare ${list.length} shaders post ho gaye. Kal se list dobara shuru hogi (🔁). Naye shaders shaders.json mein add kar do.`
        : `✅ Saare ${list.length} shaders post ho gaye. Bot ab ruk gaya hai, naye shaders add karo.`
    );
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
