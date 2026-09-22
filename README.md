# Questlog

A gamified to-do list. Every quest you add is graded by an AI for difficulty and
importance and worth XP. Finish quests to level up, climb ranks, keep your streak
and see how your week went. Questlog installs to an iPhone home screen as an app,
works offline, and can send you push notifications.

## Features

| | |
|---|---|
| **AI XP grading** | Each quest is sorted into Mundane (5–15 XP), Personal (15–30), Work / School (35–70) or Major goal (60–100). Chores earn little; work and school earn a lot. With no AI set up, a keyword table is used instead. |
| **Leveling** | Level 1 needs 100 XP, and each level needs 0.5% more, so level 100 (150 XP) is ~50% harder than level 1. |
| **Ranks** | Novice → Apprentice → Adept → Expert → Veteran → Master → Elite, by level band. |
| **Focus timer** | The Add button's ▾ dropdown can add a quest and start a stopwatch: +1 XP per 5 focused minutes, capped at +15. |
| **Due dates** | Optional, set from the same dropdown. A quest with no due date is due by the end of the day it was added. |
| **Views** (☰ menu) | Questlog, Weekly summary, Completed tasks, Calendar, Badges, Customization, Settings. Every quest shows when it was added, is due and was completed. |
| **Themes** | Dark and Light, plus Ocean and Sunset. |
| **Settings** | *AI engine* (pick a provider and enter your own key), *Guided hand* (how each quest was categorized, by which engine, with re-grade), *Notifications*, screen time, keywords, save file. |
| **Calendar notes** | Notes are stamped with the exact moment you save them (to the second) and filed on that day. |
| **Weekly summary** | Quests succeeded and failed, a consistency score, XP, streak, a day-by-day strip, and the quests you fail most often. |
| **PWA** | Installable, works offline (service worker + IndexedDB copy of your save), web push for a morning plan, a daily streak check and an evening check-in. |

### How "failed" and "consistency" work

- A quest **succeeds** if it's completed by its due time, or by midnight of the day it
  was added if it has no due date. It **fails** if that time passes while it's still
  open, or if it's completed late.
- **Consistency** (0–100) = 60% on-time rate (succeeded ÷ (succeeded + failed)) + 40%
  share of days this week with at least one completed quest.
- **Most often failed** groups quests with the same text, ignoring case and punctuation.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (app + push worker)
npm run lint
npm run build && npm run preview   # production build; the service worker only runs here
```

Deploy the `dist/` folder to any static host over HTTPS (Cloudflare Pages, Netlify,
Vercel, GitHub Pages…). Service workers and push both need HTTPS.

### Install on iPhone

1. Open your deployed Questlog URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open Questlog from the home screen icon. Notifications need this step and
   iOS 16.4 or later.

## AI providers

Open **Settings → AI engine**, pick a provider and paste an API key:

| Provider | API |
|---|---|
| Anthropic (Claude) | Messages API, default model `claude-haiku-4-5` |
| OpenAI | Chat Completions |
| Google Gemini | Gemini's OpenAI-compatible endpoint |
| OpenRouter, Groq | OpenAI-compatible |
| Ollama | local, no key |
| Custom | any OpenAI-compatible `/chat/completions` URL |

- Each provider remembers its own key and model, so you can switch back and forth.
- There are **no keys in the code or the build**. Keys are typed into Settings, stored
  only in this device's local save, sent only to the provider you picked, and
  left out of exported save files.
- Because calls go straight from the browser, a key is visible to anyone who has
  your device. Use a key with a spending limit.
- If a call fails, Questlog falls back to keyword grading and says so in *Guided hand*.

To add a provider, add an entry to `PROVIDERS` in `src/lib/providers.js`.

## Push notifications

iPhone web push needs a server that holds VAPID keys and sends the pushes.
Questlog uses a small **Cloudflare Worker** in [`push-worker/`](push-worker/). It
runs every 15 minutes (cron) and stores subscriptions in Workers KV. It has no
runtime dependencies, and the free plan is plenty for personal use.

It sends three notifications a day, each at a time you choose, in your own time zone:

- **☀️ Morning plan**: quests due today and what's overdue.
- **🔥 Streak check**: your streak count and the quests (and XP) still at risk today,
  or confirmation that the streak is secured.
- **🌙 Evening check-in**: what you finished today, the XP earned, and what's still open.

### One-time setup

You need a Cloudflare account; the free plan is enough.

```bash
cd push-worker
npm install
npx wrangler login

# 1. KV namespace for subscriptions. Paste the printed id into wrangler.toml.
npx wrangler kv namespace create SUBSCRIPTIONS

# 2. VAPID keys. Generate once and keep them: changing them invalidates
#    every existing subscription.
npm run generate-vapid-keys
npx wrangler secret put VAPID_PUBLIC_KEY    # paste the public key
npx wrangler secret put VAPID_PRIVATE_KEY   # paste the private key
```

3. In `push-worker/wrangler.toml`, set:
   - `VAPID_SUBJECT` to a `mailto:` address (or `https:` URL) push services can
     contact you at. Use a real one; Apple can reject invalid subjects.
   - `ALLOWED_ORIGINS` to your deployed Questlog origin, e.g.
     `https://questlog.example.com,http://localhost:4173`.
4. Deploy with `npx wrangler deploy`. It prints the worker URL, e.g.
   `https://questlog-push.<you>.workers.dev`.
5. In Questlog, open **Settings → Notifications**, paste the worker URL and tap
   **Turn on notifications**. To pre-fill the URL for every install, set
   `VITE_PUSH_SERVER_URL` at build time (see `.env.example`).

Use **Send one now** in the same screen to test each notification.

### What the worker stores

Per device:
- the push subscription and time zone
- the three notification times
- a snapshot of your open quests (title, XP, due time) and the times of your
  completions over the last 60 days

The app re-syncs the snapshot shortly after changes and whenever it's backgrounded.
Turning notifications off, or resetting all data, deletes the record. A random
128-bit id known only to your device is the credential for updating it.

### Local development

```bash
cd push-worker
npm run generate-vapid-keys | head -2 > .dev.vars   # git-ignored
npx wrangler dev                                    # http://localhost:8787
```

Then run the app with `npm run build && npm run preview` (port 4173, already in
`ALLOWED_ORIGINS`) and point Settings → Notifications at `http://localhost:8787`.

Limits worth knowing:
- Workers KV's free tier allows 1,000 writes a day. The app debounces snapshot
  syncs, so one person uses a small fraction of that.
- Apple drops the subscription if you remove the home screen app. Turn
  notifications back on after reinstalling.

## Project layout

```
src/
  App.jsx                 state + wiring
  components/             one component per view; settings/ has each settings tab
  lib/
    xp.js                 XP curve, ranks, timer bonus
    grading.js            categories + keyword grading
    providers.js          AI provider registry and grading calls
    outcomes.js           deadlines, succeeded/failed, streaks
    summary.js            weekly summary, consistency, most-failed
    xpAdjustments.js      hook for XP changes outside quests (screen time)
    storage.js, idb.js    localStorage + backup + IndexedDB saves
    push.js, pwa.js       push subscription/sync, install helpers
public/
  manifest.webmanifest, sw.js, icons/
push-worker/              Cloudflare Worker that sends web push
```

### Tuning

- **Ranks**: edit `RANKS` in `src/lib/xp.js`, as `{ min: level, name }`.
- **XP curve**: `xpToNext` in `src/lib/xp.js`.
- **Timer bonus**: `TIMER_BONUS_PER_MIN` / `TIMER_BONUS_CAP` in `src/lib/xp.js`.
- **Category XP ranges**: `CATS` in `src/lib/grading.js`. AI grades are clamped to
  these ranges.

## Future: phone screen time

A manual "minutes on social media" log (**Settings → Screen time**) docks XP today:
−1 XP for every 2 minutes over 30 a day. The penalty goes through
`src/lib/xpAdjustments.js`, a registry of XP adjustment sources. Real phone
screen-time data isn't built yet. It would plug in as another source there, for
example from a native companion app or an iOS Shortcut posting Screen Time
totals. The module comments describe the expected data shape.
