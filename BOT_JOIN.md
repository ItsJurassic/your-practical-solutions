# External bot join API (YPS team chat)

Other Grok Bots (or any HTTP client) can request to join the store team chat. An owner/admin approves the request in **Admin tools → Bot join requests**.

Base URL: `https://avcqqazytvvcfraowgsm.supabase.co/functions/v1`

## 1. Request to join

`POST /bot-join-request`

```json
{
  "bot_name": "AlexBot",
  "owner_contact": "coworker@example.com",
  "webhook_url": "https://api2.cursor.sh/automations/webhook/YOUR_WEBHOOK_ID",
  "webhook_key": "crsr_…",
  "note": "Optional note for the YPS owners"
}
```

Rules: `webhook_url` must be **https**. Rate limit: 5 requests/hour/IP.

Response:

```json
{
  "request_id": "uuid",
  "status": "pending",
  "claim_secret": "hex…",
  "poll_url": "https://…/bot-join-request?request_id=…&claim_secret=…"
}
```

Save `claim_secret` — it is shown only once.

## 2. Poll until approved

`GET` the `poll_url`, or `POST /bot-join-request` with:

```json
{ "action": "status", "request_id": "uuid", "claim_secret": "hex…" }
```

When `status` is `approved`, the response includes **`reply_key` once**. Also posted to your `webhook_url` as:

```json
{
  "event": "bot.approved",
  "request_id": "uuid",
  "reply_url": "https://…/functions/v1/bot-reply",
  "reply_key": "…",
  "chat_name": "AlexBot",
  "notify_mode": "mention"
}
```

## 3. Receive chat messages

After approval, human messages are POSTed to your webhook (when `@YourBotName` is mentioned, or every message if an owner sets mode to **all**):

```json
{
  "event": "chat.message",
  "message": { "id": 1, "created_at": "…", "sender_name": "Joe", "sender_email": "…", "text": "@AlexBot hi" },
  "mentioned": true,
  "from_staff": true,
  "reply_url": "https://…/bot-reply",
  "bot_name": "AlexBot"
}
```

Bot messages are never forwarded (no loops).

## 4. Reply into the chat

`POST /bot-reply`

```http
Authorization: Bearer <reply_key>
Content-Type: application/json

{ "text": "Hello from AlexBot" }
```

## Paste-ready instructions for a coworker’s Grok Bot

```
Join the Your Practical Solutions team chat as an external bot.

1) Create a webhook routine that accepts JSON POSTs (Bearer key if you use one).
2) POST https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/bot-join-request
   Body JSON:
   {
     "bot_name": "YOUR_BOT_DISPLAY_NAME",
     "owner_contact": "YOUR_HUMAN_EMAIL",
     "webhook_url": "YOUR_HTTPS_WEBHOOK_URL",
     "webhook_key": "YOUR_WEBHOOK_BEARER_KEY_OPTIONAL",
     "note": "Requesting access to the YPS admin team chat"
   }
3) Save claim_secret and poll_url from the response. Poll until status is "approved", then store reply_key (one-time) and reply_url.
4) When you receive event "bot.approved" or "chat.message" on the webhook, handle them. To reply, POST reply_url with Authorization: Bearer <reply_key> and {"text":"…"}.
5) Ask the YPS owner (Joe) to open https://yourpracticalsolutions.com/admin/ → Admin tools → Bot join requests → Approve.
```
