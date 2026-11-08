"""Dynamic tool registry. Add a tool = add one decorated function (+ its integration below)."""
import json, uuid, base64, httpx
from urllib.parse import quote
from email.mime.text import MIMEText
from app.core.config import settings

FILES = settings.FILES_DIR
REGISTRY = {}


def F(key, label, secret=False, optional=False, placeholder="", help=""):
    return dict(key=key, label=label, secret=secret, optional=optional, placeholder=placeholder, help=help)


GOOGLE_OAUTH = [
    F("client_id", "OAuth Client ID", placeholder="1234-abc.apps.googleusercontent.com"),
    F("client_secret", "OAuth Client Secret", secret=True, placeholder="GOCSPX-..."),
    F("refresh_token", "Refresh Token", secret=True, placeholder="1//0g...",
      help="Google Cloud Console → Credentials → OAuth client. Then get a refresh token from developers.google.com/oauthplayground "
           "(gear icon → use your own client)."),
]

# Tool tiles shown in the agent builder. Credentials are entered per agent and stored encrypted.
INTEGRATIONS = [
    {"id": "gmail", "name": "Gmail", "icon": "mail", "caption": "Search and send email",
     "fields": GOOGLE_OAUTH, "note": "Scopes: gmail.readonly, gmail.send"},
    {"id": "calendar", "name": "Google Calendar", "icon": "calendar", "caption": "Read and create events",
     "fields": GOOGLE_OAUTH + [F("calendar_id", "Calendar ID", optional=True, placeholder="primary"),
                               F("timezone", "Time zone", optional=True, placeholder="Asia/Kolkata")],
     "note": "Scope: calendar"},
    {"id": "telegram", "name": "Telegram", "icon": "send", "caption": "Send messages to a chat",
     "fields": [F("bot_token", "Bot Token", secret=True, placeholder="123456789:AA...", help="Create a bot with @BotFather"),
                F("chat_id", "Chat ID", placeholder="987654321", help="Message your bot, then open api.telegram.org/bot<token>/getUpdates")],
     "note": ""},
    {"id": "http", "name": "Custom HTTP", "icon": "globe", "caption": "Call any REST API",
     "fields": [F("base_url", "Base URL", optional=True, placeholder="https://api.example.com"),
                F("auth_header", "Auth header name", optional=True, placeholder="Authorization"),
                F("auth_value", "Auth header value", secret=True, optional=True, placeholder="Bearer sk-...")],
     "note": "All fields optional. The auth header is added to every request."},
    {"id": "search", "name": "Web Search", "icon": "search", "caption": "Live web results",
     "fields": [F("api_key", "Tavily API Key", secret=True, placeholder="tvly-...", help="Free key at tavily.com")], "note": ""},
    {"id": "documents", "name": "PDF & Slides", "icon": "file", "caption": "Generate PDF and PowerPoint", "fields": [], "note": ""},
]
LLM_FIELDS = {
    "groq": [F("api_key", "Groq API Key", secret=True, placeholder="gsk_...", help="console.groq.com/keys")],
    "gemini": [F("api_key", "Gemini API Key", secret=True, placeholder="AIza...", help="aistudio.google.com/apikey")],
    "ollama": [F("base_url", "Ollama URL", optional=True, placeholder="http://localhost:11434/v1"),
               F("api_key", "API Key", secret=True, optional=True)],
}
ALL_FIELDS = {i["id"]: i["fields"] for i in INTEGRATIONS} | LLM_FIELDS
INTEGRATION_FIELDS = {k: [f["key"] for f in v if not f["optional"]] for k, v in ALL_FIELDS.items()}  # required keys


def tool(name, desc, props, integ, risky=False):
    def deco(fn):
        p = {k: (v if isinstance(v, dict) else {"type": "string", "description": v}) for k, v in props.items()}
        REGISTRY[name] = dict(name=name, desc=desc, risky=risky, integ=integ, fn=fn,
                              params={"type": "object", "properties": p, "required": list(p)})
        return fn
    return deco


async def req(method, url, **kw):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, url, **kw)
        r.raise_for_status()
        return r.json() if "json" in r.headers.get("content-type", "") else r.text


async def google_headers(c):
    """Exchange the stored refresh token for a fresh access token (no hourly re-login)."""
    r = await req("POST", "https://oauth2.googleapis.com/token", data={
        "client_id": c["client_id"], "client_secret": c["client_secret"],
        "refresh_token": c["refresh_token"], "grant_type": "refresh_token"})
    return {"Authorization": f"Bearer {r['access_token']}"}


@tool("web_search", "Search the web for up-to-date information", {"query": "search query"}, "search")
async def web_search(c, query):
    r = await req("POST", "https://api.tavily.com/search", json={"api_key": c["api_key"], "query": query, "max_results": 3})
    return [{"title": x["title"], "url": x["url"], "content": x["content"][:350]} for x in r["results"]]


@tool("generate_pdf", "Create a PDF document; returns a download link", {"title": "title", "content": "body text, paragraphs separated by blank lines"}, "documents")
async def generate_pdf(c, title, content):
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    path, s = f"{FILES}/{uuid.uuid4().hex[:8]}.pdf", getSampleStyleSheet()
    parts = [Paragraph(title, s["Title"])] + [x for p in content.split("\n\n") for x in (Paragraph(p.replace("\n", "<br/>"), s["BodyText"]), Spacer(1, 8))]
    SimpleDocTemplate(path).build(parts)
    return {"download": "/" + path}


@tool("generate_ppt", "Create a PowerPoint deck; returns a download link", {"title": "deck title", "slides": {
    "type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "bullets": {"type": "array", "items": {"type": "string"}}}}}}, "documents")
async def generate_ppt(c, title, slides):
    from pptx import Presentation
    p = Presentation()
    s = p.slides.add_slide(p.slide_layouts[0]); s.shapes.title.text = title
    for sl in slides:
        s = p.slides.add_slide(p.slide_layouts[1]); s.shapes.title.text = sl.get("title", "")
        s.placeholders[1].text = "\n".join(sl.get("bullets", []))
    path = f"{FILES}/{uuid.uuid4().hex[:8]}.pptx"
    p.save(path)
    return {"download": "/" + path}


@tool("send_telegram", "Send a Telegram message to the user's chat", {"text": "message text"}, "telegram", risky=True)
async def send_telegram(c, text):
    await req("POST", f"https://api.telegram.org/bot{c['bot_token']}/sendMessage", json={"chat_id": c["chat_id"], "text": text})
    return "sent"


GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"


@tool("search_emails", "Search Gmail (Gmail search syntax)", {"query": "e.g. is:unread newer_than:2d"}, "gmail")
async def search_emails(c, query):
    h = await google_headers(c)
    ids = (await req("GET", GMAIL, headers=h, params={"q": query, "maxResults": 5})).get("messages", [])
    out = []
    for m in ids:
        r = await req("GET", f"{GMAIL}/{m['id']}", headers=h, params={"format": "metadata", "metadataHeaders": ["From", "Subject"]})
        hd = {x["name"]: x["value"] for x in r["payload"]["headers"]}
        out.append({"from": hd.get("From"), "subject": hd.get("Subject"), "snippet": r.get("snippet")})
    return out


@tool("send_email", "Send an email via Gmail", {"to": "recipient", "subject": "subject", "body": "plain text body"}, "gmail", risky=True)
async def send_email(c, to, subject, body):
    m = MIMEText(body); m["to"], m["subject"] = to, subject
    await req("POST", f"{GMAIL}/send", headers=await google_headers(c), json={"raw": base64.urlsafe_b64encode(m.as_bytes()).decode()})
    return "sent"


cal_url = lambda c: f"https://www.googleapis.com/calendar/v3/calendars/{quote(c.get('calendar_id') or 'primary')}/events"


@tool("list_calendar_events", "List upcoming Google Calendar events", {"time_min": "ISO datetime with Z, e.g. 2026-01-01T00:00:00Z"}, "calendar")
async def list_calendar_events(c, time_min):
    r = await req("GET", cal_url(c), headers=await google_headers(c),
                  params={"timeMin": time_min, "singleEvents": "true", "orderBy": "startTime", "maxResults": 10})
    return [{"summary": e.get("summary"), "start": e["start"].get("dateTime") or e["start"].get("date")} for e in r.get("items", [])]


@tool("create_calendar_event", "Create a Google Calendar event", {"summary": "title", "start": "ISO datetime", "end": "ISO datetime"}, "calendar", risky=True)
async def create_calendar_event(c, summary, start, end):
    tz = {"timeZone": c["timezone"]} if c.get("timezone") else {}
    r = await req("POST", cal_url(c), headers=await google_headers(c),
                  json={"summary": summary, "start": {"dateTime": start, **tz}, "end": {"dateTime": end, **tz}})
    return {"id": r["id"], "link": r.get("htmlLink")}


@tool("http_request", "Call an HTTP API (path is appended to the configured base URL)", {"method": "GET/POST/...", "url": "full URL or path", "body": "JSON string or empty"}, "http", risky=True)
async def http_request(c, method, url, body=""):
    if c.get("base_url") and not url.startswith("http"):
        url = c["base_url"].rstrip("/") + "/" + url.lstrip("/")
    headers = {c.get("auth_header") or "Authorization": c["auth_value"]} if c.get("auth_value") else {}
    return str(await req(method.upper(), url, headers=headers, json=json.loads(body) if body else None))[:4000]
