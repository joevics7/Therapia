# Deploying Therapia on Vercel

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
3. Join a group with a custom name, then send a chat message.
4. Open the live room on two phones, one as a host account. Speak with a voice effect on and check the other phone hears the changed voice.
5. Open Need help now and tap one number on a phone to confirm it dials.

## 5. Before real users
- Re-check every number in `src/lib/help.ts` (the file says when they were last checked).
- Create real facilitator accounts (see README) and set invite codes for women-only groups.
- Decide who the "Therapia owner" is for crisis follow-ups (the host guide tells hosts to report to them).
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

## AI mascot (Ayo)

Each group chat has an AI helper called Ayo. It answers when someone tags it (`@Ayo` or the Ask Ayo button), when a question has had no reply for 5 minutes, or when someone asks a question and nobody else has written in the group for 10 minutes and nobody is in its audio room. It stays out of messages that need a person, and when a message sounds like a crisis it only points to the Help button and 112.

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
