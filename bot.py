import os, datetime, random, requests

TOKEN = os.environ["BOT_TOKEN"]
CHAT = os.environ["CHANNEL_ID"]
API = "https://api.telegram.org/bot" + TOKEN + "/sendMessage"


def send(text):
    r = requests.post(API, data={"chat_id": CHAT, "text": text}, timeout=30)
    print(r.status_code, r.text[:200])


def news():
    url = "https://launchercontent.mojang.com/v2/javaPatchNotes.json"
    entries = requests.get(url, timeout=30).json()["entries"]
    latest = entries[0]
    ver = latest.get("version", "")
    seen = ""
    if os.path.exists("seen.txt"):
        seen = open("seen.txt").read().strip()
    if ver and ver != seen:
        msg = "NEW Minecraft Update: " + latest.get("title", ver)
        msg += "\nVersion: " + ver
        msg += "\n\n" + latest.get("shortText", "")
        msg += "\n\nDetails: https://www.minecraft.net/en-us/updates"
        send(msg)
        open("seen.txt", "w").write(ver)


TIPS = [
    "MOBILE TIP: Settings > Controls mein buttons ka size aur jagah badlo.",
    "MOBILE TIP: Lag ho to render distance 6-8 chunks rakho.",
    "MOBILE TIP: Sneak ko toggle par rakho, bridging aasaan hoti hai.",
    "PC TIP: F3 dabao, coordinates aur FPS dikhte hain.",
    "PC TIP: Shift + click se items turant chest mein jaate hain.",
    "PC TIP: Sodium mod se FPS kaafi badhta hai.",
    "TIP: Diamond ke liye Y = -59 ke aas-paas dhoondo.",
    "TIP: Water bucket saath rakho, girne par bacha leti hai.",
    "TIP: Raat se pehle bed bana ke spawn set kar lo.",
]


def tip():
    send(random.choice(TIPS))


news()
if datetime.datetime.utcnow().hour == 3:
    tip()
