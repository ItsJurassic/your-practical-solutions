# Team chat ↔ Shoppie bot

The admin page (`/admin/`, tab **Team chat**) is a realtime chat for the owner and invited partners,
stored in Supabase project `avcqqazytvvcfraowgsm`. Shoppie is connected in both directions:

```
 browser ──insert──▶ public.yps_chat_messages ──trigger (pg_net)──▶ edge fn shoppie-notify ──POST──▶ SHOPPIE_WEBHOOK_URL
                                   ▲                                                               (Shoppie)
                                   └──────────── edge fn shoppie-reply ◀──POST + key──────────────────┘
```

## 1. Outbound: chat → Shoppie (`shoppie-notify`)

Every new **human** message fires the `yps_chat_notify` trigger, which calls
`https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/shoppie-notify` (authenticated with an internal
token kept in Supabase Vault as `shoppie_notify_token`). The function forwards the message to Shoppie
only when a webhook URL is configured.

**Configuration (currently ON, mode = mention):**

| Setting | Where it lives now | Meaning |
|---|---|---|
| Webhook URL | Vault `shoppie_webhook_url` = `https://api2.cursor.sh/automations/webhook/0b5c8c1b-a25b-592e-87c7-ac1672ecb396` | Where messages are POSTed. Edge secret `SHOPPIE_WEBHOOK_URL` overrides it if set. |
| Webhook key | Vault `shoppie_webhook_key` (copied from the box env var `SHOPPIE_WEBHOOK_KEY`) | Sent as `Authorization: Bearer <key>`. Edge secret `SHOPPIE_WEBHOOK_KEY` overrides it if set. |
| Mode | `private.yps_chat_config.notify_mode` = `mention` | `mention` = only messages containing `@Shoppie`; `all` = every message. Edge secret `SHOPPIE_NOTIFY_MODE` overrides. |
| `SHOPPIE_WEBHOOK_SECRET` | optional edge secret | If set, also sent as header `x-yps-webhook-secret`. |

To rotate the webhook key from the box without it appearing in any log:

```bash
python3 - <<'PY'
import os, json, urllib.request
k = open('/workspace/kpi-site/.secrets/shoppie_reply_key').read().strip()
req = urllib.request.Request("https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/shoppie-reply",
    data=json.dumps({"set_webhook_key": os.environ["SHOPPIE_WEBHOOK_KEY"]}).encode(), method="POST",
    headers={"authorization": "Bearer " + k, "content-type": "application/json"})
print(urllib.request.urlopen(req).read().decode())   # {"ok":true,"stored_length":N}
PY
```

The owner can also switch the mode in the admin page (Owner tools → "Shoppie receives"); that writes
`private.yps_chat_config.notify_mode`. The `SHOPPIE_NOTIFY_MODE` secret, if set, wins.

**Request Shoppie receives:**

```http
POST <SHOPPIE_WEBHOOK_URL>
Content-Type: application/json
Authorization: Bearer <shoppie_webhook_key>
x-yps-webhook-secret: <SHOPPIE_WEBHOOK_SECRET>   (only if that secret is set)

{
  "event": "chat.message",
  "message": {
    "id": 42,
    "created_at": "2026-11-09T20:15:00.123+00:00",
    "sender_name": "Joe",
    "sender_email": "contact@yourpracticalsolutions.com",
    "text": "@Shoppie what sold best last week?"
  },
  "mentioned": true,
  "reply_url": "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/shoppie-reply"
}
```

Shoppie's own messages are never forwarded (no loops).

## 2. Inbound: Shoppie → chat (`shoppie-reply`)

```http
POST https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/shoppie-reply
Authorization: Bearer <SHOPPIE_REPLY_KEY>        (or header  x-shoppie-key: <SHOPPIE_REPLY_KEY>)
Content-Type: application/json

{ "text": "No orders yet — I'll post a summary when sales start." }
```

- `text` (or `message`): 1–4000 characters. Posted as sender **Shoppie** (`is_bot = true`) and shown live
  to everyone in the chat.
- Responses: `200 {"ok":true,"id":43,"created_at":"…"}` · `400` bad body · `401 {"error":"invalid key"}`.

curl example (reads the key from the box without printing it):

```bash
curl -s -X POST https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/shoppie-reply \
  -H "Authorization: Bearer $(cat /workspace/kpi-site/.secrets/shoppie_reply_key)" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello from Shoppie"}'
```

**Where the key lives**

- Box: `/workspace/kpi-site/.secrets/shoppie_reply_key` (mode 600, git-ignored). Give this value to Shoppie.
- Supabase: Vault secret `shoppie_reply_key` (checked by the `yps_shoppie_post` database function).
  The function also accepts an Edge Function secret `SHOPPIE_REPLY_KEY`; if you set it in the dashboard
  it takes priority over the Vault value. (The connector used to build this cannot write Edge Function
  secrets, which is why the Vault copy exists.)
- Rotate: generate a new value, update the box file, then in SQL:
  `select vault.update_secret((select id from vault.secrets where name='shoppie_reply_key'), '<new key>');`

## 3. Who can use the chat

- Table `public.yps_chat_members` lists allowed emails. RLS on `public.yps_chat_messages` lets only
  members (plus the KPI admin) read and post. Members can post only as themselves, and only the
  `shoppie-reply` path can post as Shoppie.
- Owner: `contact@yourpracticalsolutions.com` (seeded).
- Invite a partner: Admin → Team chat → Owner tools → *Invite a partner*. That calls edge function
  `chat-invite`, which adds the email to `yps_chat_members` and sends a Supabase Auth invite (or a
  sign-in link if the account already exists). Partners see the chat only, not the KPI tab.
