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
