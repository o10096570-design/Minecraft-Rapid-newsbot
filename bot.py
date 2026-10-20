import os, json, random, datetime, requests

TOKEN = os.environ["BOT_TOKEN"]
CHAT = os.environ["CHANNEL_ID"]
API = f"https://api.telegram.org/bot{TOKEN}/sendMessage"

def send(text):
    r = requests.post(API, data={"chat_id": CHAT, "text": text}, timeout=30)
    print(r.status_code, r.text[:200])

def news():
    url = "https://launchercontent.mojang.com/v2/javaPatchNotes.json"
    entries = requests.get(url, timeout=30).json()["entries"]
    latest = entries[0]
    ver = latest.get("version", "")
    seen = open("seen.txt").read().strip() if os.path.exists("seen.txt") else ""
    if ver and ver != seen:
        send(f"🆕 Minecraft Update: {latest.get('title', ver)}\n"
             f"Version: {ver} ({latest.get('type', '')})\n\n"
             f"{latest.get('shortText', '')}\n\n"
             "Details: https://www.minecraft.net/en-us/updates")
        open("seen.txt", "w").write(ver)

MOBILE = [
    "📱 Bedrock par Settings > Controls mein buttons ka size aur jagah apne hisaab se badlo.",
    "📱 Phone garam ho raha hai? Render distance 6-8 chunks rakho, lag kam hoga.",
    "📱 Sneak button ko toggle par rakho, bridging aasaan ho jaati hai.",
]
LAPTOP = [
    "💻 F3 dabao: coordinates, biome aur FPS dikhte hain.",
    "💻 Shift + click se items turant chest aur inventory ke beech jaate hain.",
    "💻 OptiFine ya Sodium daalo, FPS kaafi badh jaata hai.",
]
GENERAL = [
    "⛏️ Diamond ke liye Y = -59 ke aas-paas dhoondo.",
    "⛏️ Water bucket gir ke bachne ke kaam aati hai, 
