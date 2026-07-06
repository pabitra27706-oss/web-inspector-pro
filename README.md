
# Web Inspector Pro

Full web analysis platform combining Chrome DevTools, GTmetrix, Ahrefs, and VirusTotal features into a single mobile-friendly PWA.

## Features

- **HTML & DOM Analysis** — Source viewer, DOM tree, hidden elements, comments, forms, iFrames
- **Network Inspector** — HTTP requests, API endpoints, third-party services, CDN detection, auth tokens
- **Security Scanner** — API key detection, credential finder, XSS hints, SQLi points, CORS analysis, SSL details, security headers, robots.txt, sitemap, admin panel finder, source maps, JWT analyzer
- **Performance Analyzer** — Load time, TTFB, FCP, LCP, render blocking, unused CSS/JS, image optimization, compression, cache analysis
- **Design Inspector** — Color palette, font detector, CSS variables, animations, breakpoints, dark mode check, framework detector, screenshots
- **SEO Analyzer** — Meta tags, OG tags, Twitter cards, schema markup, keywords, headings, alt tags, canonical, sitemap
- **Storage Inspector** — Cookies, localStorage, sessionStorage, IndexedDB, cache storage, service workers
- **AI Insights** — Stack detection, security explainer, performance explainer, bug finder, improvement suggestions, accessibility check
- **Reports** — PDF export, share links, scan history, favorites, site comparison

## Tech Stack

- **Frontend** — HTML, CSS, JavaScript (Vanilla), PWA
- **Backend** — Firebase Functions, Firestore, Realtime Database, Storage, Auth
- **Scraping** — Puppeteer on Replit (screenshots, deep DOM, JS rendering)
- **AI** — OpenAI GPT-4o-mini (primary), Gemini 1.5 Flash (fallback)
- **Proxy** — allorigins.win, corsproxy.io

## Project Structure

```
web-inspector-pro/
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── firebase-config.js
│   ├── auth.js
│   ├── settings.js
│   ├── manifest.json
│   ├── service-worker.js
│   ├── components/
│   │   ├── navbar.js
│   │   ├── tabs.js
│   │   ├── cards.js
│   │   └── loader.js
│   └── assets/
├── functions/
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── analyze.js
│       ├── security.js
│       ├── performance.js
│       ├── network.js
│       ├── seo.js
│       ├── design.js
│       ├── ai.js
│       ├── storage.js
│       └── reports.js
├── puppeteer-server/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── screenshot.js
│       ├── deepScan.js
│       └── jsRender.js
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
└── storage.rules
```

## License

MIT
```

---

FILE: DEPLOYMENT_GUIDE.md

```markdown
# Deployment Guide — Web Inspector Pro

## Prerequisites

- Android phone with Termux installed
- GitHub account
- Firebase account (free Spark plan works for testing, Blaze plan required for Functions)
- Replit account (free tier works)
- OpenAI API key (optional but recommended)
- Google Gemini API key (optional fallback)

---

## STEP 1 — Install Tools in Termux

Open Termux and run these one by one:

```bash
pkg update && pkg upgrade -y
pkg install nodejs -y
pkg install git -y
npm install -g firebase-tools
```

Verify installations:
```bash
node --version
npm --version
firebase --version
git --version
```

---

## STEP 2 — Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Name it `web-inspector-pro` (or any name)
4. Disable Google Analytics (optional)
5. Click **Create project**

### Enable Firebase Services

Inside your project:

**Authentication:**
- Go to Build → Authentication → Get Started
- Enable **Email/Password**
- Enable **Google** sign-in method

**Firestore:**
- Go to Build → Firestore Database → Create database
- Choose **Start in production mode**
- Select your region (choose closest to you)

**Realtime Database:**
- Go to Build → Realtime Database → Create database
- Choose your region
- Start in locked mode

**Storage:**
- Go to Build → Storage → Get started
- Start in production mode

**Functions:**
- Requires Blaze (pay-as-you-go) plan
- Go to Build → Functions → Upgrade project
- Add a billing account (you get $300 free credit)

### Get Firebase Config

1. Go to Project Settings (gear icon)
2. Scroll to **Your apps**
3. Click **Add app** → Web app
4. Register app with nickname `web-inspector-pro`
5. Copy the `firebaseConfig` object

---

## STEP 3 — Set Up Project Files

Clone or create your repo:
```bash
mkdir web-inspector-pro
cd web-inspector-pro
git init
```

Copy all project files into the correct directories as structured in README.md.

Update `frontend/firebase-config.js` with your real Firebase config values:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Update `.firebaserc` with your real project ID:
```json
{
  "projects": {
    "default": "your-real-project-id"
  }
}
```

---

## STEP 4 — Set Up Puppeteer on Replit

1. Go to https://replit.com
2. Create a new Repl → choose **Node.js**
3. Name it `web-inspector-pro-puppeteer`
4. Upload these files to your Repl:
   - `puppeteer-server/server.js` → `server.js`
   - `puppeteer-server/package.json` → `package.json`
   - `puppeteer-server/src/screenshot.js` → `src/screenshot.js`
   - `puppeteer-server/src/deepScan.js` → `src/deepScan.js`
   - `puppeteer-server/src/jsRender.js` → `src/jsRender.js`

5. Create `.env` file in Replit Secrets (use the Secrets tab):
```
SERVER_SECRET=choose_a_long_random_secret_string_here
ALLOWED_ORIGINS=https://your-project-id.web.app,https://your-project-id.firebaseapp.com
MAX_CONCURRENT_BROWSERS=2
SCREENSHOT_TIMEOUT=25000
DEEP_SCAN_TIMEOUT=30000
JS_RENDER_TIMEOUT=30000
NODE_ENV=production
```

6. In Replit Shell run:
```bash
npm install
```

7. Click **Run** — note your Replit app URL (e.g. `https://web-inspector-pro-puppeteer.your-username.repl.co`)

8. Keep the Repl running (use Replit's Always On feature if available, or UptimeRobot to ping it)

---

## STEP 5 — Configure Firebase Functions Environment

In Termux inside your project folder:

```bash
firebase login
firebase use your-real-project-id
```

Set environment variables for Functions:
```bash
firebase functions:config:set \
  openai.key="YOUR_OPENAI_API_KEY" \
  gemini.key="YOUR_GEMINI_API_KEY" \
  puppeteer.url="https://your-replit-app-url.repl.co" \
  puppeteer.secret="choose_a_long_random_secret_string_here"
```

The `puppeteer.secret` must exactly match `SERVER_SECRET` in your Replit `.env`.

Verify config was set:
```bash
firebase functions:config:get
```

---

## STEP 6 — Install Function Dependencies

```bash
cd functions
npm install
cd ..
```

---

## STEP 7 — Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

---

## STEP 8 — Deploy Firebase Functions

```bash
firebase deploy --only functions
```

This will take several minutes on first deploy. If it times out in Termux, try:
```bash
firebase deploy --only functions --debug
```

After deploy succeeds you will see function URLs in the output. Note the region your functions deployed to.

---

## STEP 9 — Create App Icons

You need PNG icons in `frontend/assets/` at these sizes:
- icon-72.png
- icon-96.png
- icon-128.png
- icon-144.png
- icon-152.png
- icon-192.png
- icon-384.png
- icon-512.png

Use any online icon generator. Recommended:
- https://realfavicongenerator.net
- https://www.favicon-generator.org

Design: ◈ symbol in `#00ff88` on `#0a0a0a` background using JetBrains Mono font.

Place all generated PNG files in `frontend/assets/`.

Also add placeholder screenshots (can be any images initially):
- `frontend/assets/screenshot-mobile.png` (390x844px)
- `frontend/assets/screenshot-desktop.png` (1440x900px)

---

## STEP 10 — Deploy Frontend to Firebase Hosting

```bash
firebase deploy --only hosting
```

Your app is now live at:
- `https://your-project-id.web.app`
- `https://your-project-id.firebaseapp.com`

---

## STEP 11 — Add Authorized Domains

1. Go to Firebase Console → Authentication → Settings
2. Under **Authorized domains** add:
   - `your-project-id.web.app`
   - `your-project-id.firebaseapp.com`
   - `localhost` (for testing)

---

## STEP 12 — Update Replit CORS

Go back to your Replit Secrets and update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-project-id.web.app,https://your-project-id.firebaseapp.com
```

Restart the Replit server after updating.

---

## STEP 13 — Configure Firestore Database Rules

The rules are already deployed from Step 7. Verify in Firebase Console → Firestore → Rules that they match `firestore.rules` from the project.

---

## STEP 14 — Test Everything

Open your app URL in browser and test:

1. **Auth** — Create an account, sign in, sign out
2. **Basic Scan** — Scan `example.com` without deep scan
3. **Deep Scan** — Enable deep scan and screenshot, scan again
4. **AI Analysis** — Enable AI toggle, verify AI insights appear
5. **History** — Check scan appears in history
6. **Favorites** — Add a site to favorites
7. **PDF Export** — Export a report
8. **PWA Install** — Install the app from browser

---

## Troubleshooting

**Functions deploy fails:**
```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

**CORS errors in browser:**
- Check Replit ALLOWED_ORIGINS matches your hosting URL exactly
- Check Firebase authorized domains list

**AI not working:**
- Verify API keys with: `firebase functions:config:get`
- Check Functions logs: `firebase functions:log`

**Puppeteer not responding:**
- Check Replit server is running (visit health endpoint: `your-replit-url/health`)
- Verify SERVER_SECRET matches puppeteer.secret exactly

**Scan always fails:**
- Open browser DevTools → Console → check error message
- Check Functions logs in Firebase Console → Functions → Logs

**Functions timeout:**
- Functions have 300 second timeout configured
- If still timing out, check network from Functions to target URL

---

## Keeping Puppeteer Server Alive

Free Replit servers sleep after inactivity. To keep alive:

1. Create free account at https://uptimerobot.com
2. Add new monitor → HTTP(s)
3. URL: `https://your-replit-url.repl.co/health`
4. Interval: every 5 minutes
5. This pings your server and keeps it awake

---

## Updating the App

After making changes to frontend files:
```bash
firebase deploy --only hosting
```

After making changes to functions:
```bash
firebase deploy --only functions
```

Deploy everything at once:
```bash
firebase deploy
```

After making changes to Puppeteer server:
- Edit files directly in Replit editor
- The server auto-restarts on file save in development
- Click Run again if it stops

---

## Cost Estimates (Firebase Blaze Plan)

For personal/light use the costs are essentially zero:

- **Hosting** — 10GB storage free, 360MB/day transfer free
- **Functions** — 2M invocations/month free, 400K GB-seconds free
- **Firestore** — 50K reads/day free, 20K writes/day free, 1GB storage free
- **Storage** — 5GB storage free, 1GB/day download free
- **Authentication** — Free for email/password and Google

You will only be charged if you exceed these free tier limits significantly.

---

## Security Checklist Before Going Public

- [ ] Never commit `.env` files to GitHub
- [ ] Never commit Firebase config with real keys to public repos
- [ ] Verify Firestore rules only allow users to read/write their own data
- [ ] Verify Storage rules only allow users to access their own files
- [ ] Rotate all API keys if accidentally exposed
- [ ] Enable Firebase App Check for additional protection
- [ ] Set up Firebase budget alerts in Google Cloud Console
- [ ] Review Functions logs periodically for abuse
```
