# Deploying Theraping on Vercel

## 1. Import the repo
Vercel > Add New > Project > import `joevics7/Therapia`. Framework: Next.js (auto-detected). No build settings to change.

## 2. Environment variables (Project Settings > Environment Variables)
| Name | Where it comes from | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API (service_role) | **NO. Server only.** Never add `NEXT_PUBLIC_` to it |
| `RECOVERY_PEPPER` | optional random string (32+ characters). Set once, never change | **NO. Server only** |
| `LIVEKIT_URL` | LiveKit Cloud project, `wss://…livekit.cloud` | server |
| `LIVEKIT_API_KEY` | LiveKit Cloud | server |
| `LIVEKIT_API_SECRET` | LiveKit Cloud | server |
| `NEXT_PUBLIC_RECOVERY_EMAIL_DOMAIN` | optional, only if Supabase rejects the default | yes |

Set them for Production and Preview, then redeploy (public values are baked in at build time).

## 3. Supabase settings
- Authentication > Providers > Email: **Confirm email OFF**.
- Authentication > Sign In / Providers: **Anonymous sign-ins OFF**.
- Authentication > Password security: turn on **Leaked password protection** if your plan offers it.
- Authentication > Rate limits: keep the defaults. Sign-ups also have their own limit in the app (20 per hour per connection).
- Nothing to whitelist for redirects: sign-in is username + password, no email links.

## 4. After the first deploy: a 10-minute check
1. Create an account, sign out, sign in again.
2. Forgot password: answer both questions, set a new password. Then try Forgot username with the two answers.
3. Join a group, then send a chat message, once normally and once with Hide my username ticked.
4. Open the live room on two phones, one as a host account. Speak with a voice effect on and check the other phone hears the changed voice.
5. Open Need help now and tap one number on a phone to confirm it dials.

## 5. Before real users
- Re-check every number in `src/lib/help.ts` (the file says when they were last checked).
- Create real facilitator accounts (see README) and set invite codes for women-only groups.
- Decide who the "Theraping owner" is for crisis follow-ups (the host guide tells hosts to report to them).
- Microphone access needs HTTPS. Vercel provides it; for local testing use `localhost`.

## Admin page (`/admin`)

`/admin` has its own sign-in with an email and password. There is no sign-up. If you are signed in without admin rights, you are sent to the homepage. The server re-checks admin rights on every action, so hiding the page is not what protects it.

1. In Supabase open **Authentication > Users > Add user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. In **SQL Editor** run (use that email):

   ```sql
   update public.profiles set role = 'admin'
   where user_id = (select id from auth.users where lower(email) = lower('YOU@EXAMPLE.COM'));
   ```
3. Go to `/admin` and sign in. You can add, edit and delete facilitators, assign them to groups, create and edit groups, set group passwords, add dated sessions, ban members and resolve reports.

Facilitators sign in at `/host/login` with the username and password you gave them. `SUPABASE_SERVICE_ROLE_KEY` must be set on Vercel for the admin page to work.

## AI mascot (Ava)

Each group chat has an AI helper called Ava. It answers when someone tags it (`@Ava` or the Ask Ava button), when a question has had no reply for 5 minutes, or when someone asks a question and nobody else has written in the group for 10 minutes and nobody is in its audio room. It stays out of messages that need a person, and when a message sounds like a crisis it only points to the Help button and 112.

Add these in Vercel **Settings > Environment Variables**, then redeploy:

| Name | What it is |
| --- | --- |
| `GEMINI_API_KEY` | From Google AI Studio |
| `DEEPSEEK_API_KEY` | From the DeepSeek platform |
| `GEMINI_MODEL`, `DEEPSEEK_MODEL` | Optional. Model names change, so check the current ones in each provider's docs |
| `MASCOT_PROVIDERS` | Optional. Default `gemini,deepseek`: Gemini first, DeepSeek if Gemini fails |
| `MASCOT_DAILY_CAP` | Optional. Most AI replies per day, default 800 |

Every minute the database checks for unanswered questions and calls `/api/mascot/sweep` on `https://therapia-three.vercel.app`. If your site address changes, update the `mascot-sweep` job in Supabase (SQL Editor: `select cron.alter_job(...)`, or unschedule it and schedule it again with the new address).

Privacy: the AI sees only the last few messages in the group, labelled Member A, B, C, with no usernames or ids. The text still goes to the AI companies, so check each company's data terms for the plan you use. Free tiers may use data to improve their products.

## Reminders (browser notifications)

"Remind me" on a group sends a notification to the person's device about 15 minutes before each session, even when Theraping is closed. Sessions come from the group's weekly schedule (days and time, set in `/admin`) and from its dated sessions. The notification never names the group, because it can be read on a lock screen.

1. Make a VAPID key pair (once): `npx web-push generate-vapid-keys`.
2. In Vercel add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the public key), `VAPID_PRIVATE_KEY` (the private key, keep it secret) and `VAPID_SUBJECT` (for example `mailto:you@example.com`). Redeploy.
3. Every 5 minutes the database checks for due reminders and calls `/api/reminders/dispatch` on `https://therapia-three.vercel.app` (job `send-reminders`). If the site address changes, reschedule that job and `mascot-sweep` with the new address.

Notes: iPhone and iPad only allow notifications after the site is added to the Home Screen (Share, then Add to Home Screen). Someone who blocks notifications in the browser has to allow them again in browser settings.

## Therapists and bookings

Therapists, their available times and bookings live in the database and are managed in `/admin` under **Therapists**.

- Three sample therapists are seeded as **hidden**. Edit each one (name, title, topics, price) and tick **Visible** to show them to members.
- Members can only book times you add under "Available times". Times are Nigeria time (WAT).
- Bookings are listed at the bottom of the Therapists tab. Admins see the member's username there. Confirm after you have been paid, or cancel to free the time.
- The app does not take payment yet.
- The library (`LIB` in `src/lib/data.ts`) is still sample content.

## Group room and Vent

- A group is one screen with three tabs: **Meeting**, **Chat** and **Vent**. Chat and Vent always work. The Meeting tab shows "Waiting for the facilitator" until they join, then members get a "Join the live meeting" button. `/chat/<id>` and `/room/<id>` open the same screen.
- **Vent** is private to the group's members. Posts can be text or a voice note (up to 60 seconds). Members can add several reactions (❤️ 🙏 🤗 😂 💪 😢), reply by quoting, and mark a post "Just venting" so it can only get reactions. The username is hidden unless the member chooses to show it.
- Voice notes are stored privately in the Supabase Storage bucket `vent-voice` and played through short-lived links, only for group members. They are deleted after 30 days (daily database job). Leftover files are cleaned hourly by `/api/vent/cleanup`.
- Wording that suggests self-harm or abuse is flagged in the host's and admin's Reports list (labelled "Vent") and the author sees a private help card. Hosts can see who wrote a flagged or reported post, as with chat.
- Reports on Vent posts use the same Delete / Ban / Dismiss actions as chat.

## Invitation links

- Every member has a personal invitation link per group (the **+ Invite** button in the group). They can copy or share it, switch it off, or make a new one.
- Open groups: the person joins straight away. Closed groups (password or women-only): they send a join request, and the host or admin approves or declines it. Requests appear under the group in Host tools and in the group's Members card in /admin.
- Hosts and admins see who invited each person (in the request, and in the Members list). The invited person is told they were invited by a member. Other members never see it.
- Switching a link off, banning the inviter, or deactivating the group stops it working.

## Live meeting layout

- The meeting is laid out like an audio space: **Speakers** on top (host first, with mic on/off and a voice bar), **Listeners** below (everyone in the room, by their username, with ✋ for raised hands), and one big button at the bottom. Listeners see "🔇 You're muted · tap to ask the host to let you speak". The host sees raised hands first in the Listeners list with **Invite** and **Not now**.
- Members join the live audio automatically when the meeting is on and they are on the Meeting tab. Facilitators press **Start the meeting**. "Open slot" boxes are no longer shown to listeners.
- Voice effects now run through the app's own audio pipeline before the mic is published.
- **Facilitators need an email.** Add it in /admin → Facilitators; they sign in at /host/login with that email. Existing facilitators can have an email added there too. Changing a member-turned-facilitator's email means they must use /host/login from then on.

## The meeting keeps going while you use the app

The live connection lives in `MeetingProvider` (root layout), not on the room page. Members and facilitators can move around the app, read, chat or vent while listening or speaking. A bar at the top shows "Live · group name" with a mute/raise-hand button, a way back to the room, and Leave. Signing out or Quick exit ends the meeting. Refreshing or closing the page still disconnects, and phones may pause audio when the screen is locked or the browser is in the background.

## Blog

- Tables: `articles` and `article_translations` (same design as Toolbase). Public can read published rows only; writes go through `/api/admin` (service role).
- Write posts in **/admin → Blog**. "Auto-fill" and "Rewrite" use the Toolbase Gemini extraction prompt (`src/lib/blog-ai.server.ts`).
- Env: `GEMINI_API_KEY` (optional `GEMINI_API_KEY_2…` for rotation), `NEXT_PUBLIC_SITE_URL` (canonical/sitemap).
- Posts stay drafts until you tick Published.
- AI rewrites of mental-health articles must be reviewed by a human before publishing.
- Public pages: `/blog`, `/blog/<slug>`, `/sitemap.xml`, `/robots.txt`. English only for now; `article_translations.locale` is ready for more.

### Blog automation (cron-job.org)

No secret is needed; the URLs limit themselves (calls that come too early do nothing and return 429).

1. Daily, publish drafts (all drafts, oldest first; add `?limit=N` to publish at most N). Runs at most once per 20 hours:
   `https://www.theraping.app/api/cron/blog-publish`
2. Hourly, parse the oldest saved text into a draft. Runs at most once per 50 minutes:
   `https://www.theraping.app/api/cron/blog-inbox`
3. Save text in **/admin → Blog → New article → Save content for later**. Table: `blog_inbox` (`not_processed` / `processed`). A saved item is tried 3 times, then skipped; its last error shows in the list.
- The queue never overwrites an existing article (a taken slug becomes `slug-2`).
- Auto-published AI content is not human-reviewed.

## Morning message, audio and betting plan

- **Morning message:** write messages in /admin → Morning. One shows per day in Tools → Morning message (cycles through the active ones, Lagos date). People can turn on a browser notification (in Tools → Morning message) at 5–10 am (needs the VAPID keys already used for reminders). The database job `send-morning` runs every 15 minutes and calls `/api/morning/dispatch` only when someone is due. With no active messages nothing is shown or sent.
- **Meditation and sleep audio:** upload in /admin → Audio (files go straight from the browser to the public Supabase bucket `audio`; 50 MB per file on the free plan; mp3 at 64–96 kbps keeps files small). The Tools page has Meditate and Sleep players with a sleep timer that fades out.
- **Betting plan:** runs fully on the person's device (localStorage). Nothing about betting is stored on the server.

## Patterns and play-instead mini-games

- **Patterns (Tools → Patterns):** private text entries in the `pattern_entries` table (row-level security: only the owner can read, add, edit or delete). Nothing is analysed yet. Entries are deleted if the account is deleted. Max 4000 characters each.
- **Play instead (Tools → Betting plan → "I want to bet right now"):** five zero-money mini-games (Ball Throw with a throw-it-yourself mode, Danfo Race, Higher or Lower, Lagos Trip, Tug of War). Coins are made up: everyone starts with 100, +10 each day, +30 for each finished day without a logged bet (up to 7 days are caught up), max stake 5 per round, never below 0, cannot be bought or cashed out. At 0 coins only the free throw-it-yourself game is playable, with links to a group and breathing.
- After playing, the person says how the urge feels. Wallet, urge answers and the plan stay on the device (localStorage). Nothing about betting is sent to the server.
- Odds shown on screen are the real odds (the race odds come from simulating the same race thousands of times). All logic is in `src/lib/arcade.ts`.

## What do you need help with (onboarding) and morning messages

- After sign-up, listeners see `/welcome`: "What do you need help with?" (multi-select, Skip allowed). Existing accounts are asked once the next time they open the app. Facilitators and admins are not asked.
- Answers are stored in `user_needs` (private by RLS, only the owner can read or change their row). People can change them any time in Tools → Morning message → Change topics.
- In `/admin` → Morning messages, tag each message with topics. No topics = everyone. Each person gets one message a day from "everyone" plus their own topics (`motivation_for`). If nothing matches, they get none that day.
- The morning push (`/api/morning/dispatch`, every 15 min) sends that person's message at their chosen time. Topic ids live in `src/lib/needs.ts` and must match the DB check on `user_needs`.
- "I want to bet right now" opens a two-option page: deep breathing or play-coin games.

### Loading the morning messages
`docs/morning-messages.json` holds 1,500 messages (50 for each of the 30 topics) plus 12 for everyone. In `/admin` → Morning messages, press "Import from file" and choose it. Messages that already exist are skipped, so importing twice is safe. Edit, turn off or delete any message afterwards; use the "Show" filter to review one topic at a time.

### Games: how they stay fair
Every price (the x number next to a choice) comes from simulating the real chances, with about 5% taken off, so what is shown matches what happens. Ball Throw has occasional rocket and slip throws (equally likely, so Over and Under stay even). Higher or Lower drifts with occasional big jumps and shows recent numbers. Lagos Trip has hidden accidents and shortcuts and three outcomes (Quick, About right, Stuck). After every 8 rounds a centred reminder pops up that can be closed.
