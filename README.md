# Lamma order backend

Receives orders from the storefront and pings your WhatsApp automatically —
no tap needed, nothing visible to customers.

## Step 1 — Get a free CallMeBot API key (2 minutes)

1. Save this number in your phone contacts: **+34 644 59 71 67**
2. Open WhatsApp and send this exact message to that number:
   `I allow callmebot to send me messages`
3. Within a minute you'll get a reply with your personal API key (a number).
   Keep it.

## Step 2 — Put your details in `.env`

Copy `.env.example` to a new file named `.env` and fill in:
- `CALLMEBOT_PHONE` — your own WhatsApp number, with country code, no `+`
  or spaces (e.g. `201001234567`)
- `CALLMEBOT_APIKEY` — the key from Step 1
- `ADMIN_PASSWORD` — any password you choose, to view saved orders later

## Step 3 — Deploy it for free on Render

1. Go to https://github.com and create a new repository (e.g. `lamma-backend`).
2. Upload these 4 files to it: `server.js`, `package.json`, `.env.example`,
   `README.md` (skip `.env` — you'll set those as secrets in Render instead).
3. Go to https://render.com, sign up free, click **New + → Web Service**.
4. Connect the GitHub repo you just created.
5. Settings: **Build command** `npm install`, **Start command** `npm start`.
6. Under **Environment**, add the three variables from your `.env`
   (`CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY`, `ADMIN_PASSWORD`).
7. Click **Create Web Service**. Render gives you a live URL like
   `https://lamma-backend.onrender.com` — copy it.

## Step 4 — Tell me the URL

Send me that URL and I'll wire the storefront's checkout button to send
orders there automatically.

## Checking saved orders (backup, in case WhatsApp is delayed)

Visit `https://your-backend-url.onrender.com/api/orders` in a browser —
it'll ask for a username (leave blank) and the `ADMIN_PASSWORD` you set.

## Note on Render's free tier

Free services "sleep" after 15 minutes of no traffic and take ~30-50
seconds to wake up on the next order. For a low-volume store this is
usually fine; if it matters, Render's paid tier ($7/mo) keeps it always on.
