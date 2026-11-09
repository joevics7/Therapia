# Therapia

Anonymous voice support groups, one-on-one therapy and self-help tools for Nigeria, then Africa.

## What works
- **Username + password accounts** (Supabase). No email or phone. A **security question** lets someone set a new password if they forget it. People pick how anonymous to be: they appear as their username by default, or type another name for any single group.
- **Voice effects** (Deeper, Higher, Bass boost, Robot). They run on the speaker's own device and are applied before the audio is published, so the natural voice is never sent.
- **Groups** from the database, with live status and listener counts (LiveKit), schedules and reminders.
- **Live audio rooms** (LiveKit): host speaks, listeners raise a hand, host invites, step down, mute, remove, end. Audio is never recorded.
- **Text chat per group**, saved in Supabase and shown live. Messages are deleted after 7 days. Phone numbers and links are blocked on the server. Members can report; hosts review.
- **Women-only groups**: per-group invite codes set by the host (stored scrambled, can expire).
- **Facilitator sign-in** and **Host tools**: schedule, dated sessions, invite code, reports (delete message, block, dismiss).
- **Therapy bookings** and **saved library items** stored in the user's account (no payment yet).
- Dashboard, tools (breathing, grounding, journal, quick exit). Mood log and journal stay on the device only.

## Set up
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```
Supabase settings (Authentication, in the dashboard):
1. Turn **Confirm email** off (accounts use a private, never-emailed address built from the username).
2. Turn **Anonymous sign-ins OFF**. They are no longer used, and the database rejects them when joining a group, but switching them off closes the door completely.
3. Add `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API) to `.env.local` and to Vercel. It is **server-only**: it creates accounts and resets passwords. Never prefix it with `NEXT_PUBLIC_`.

Create a facilitator: add the user in Authentication > Users, then in the SQL editor:
```sql
update public.profiles set role = 'facilitator' where user_id = '<their user id>';
update public.rooms set host_id = '<their user id>' where id = 'safe';
```
Use `role = 'admin'` for yourself to manage every group.

## Privacy design
- In a group a person appears by their **username** (default) or a **custom name** for that group. Behind the scenes each membership still has a random alias that chat and audio use, so hosts never see account ids. Custom names can't copy another user's username or pose as staff.
- Security answers are stored only as bcrypt hashes, 5 tries per hour per username, and are reachable only from the server.
- No device ID is stored.
- Listeners are never asked for personal details. Hosts can't see user ids; reports hide who reported.
- Only the database decides who is a member or host. The shared host key and shared women-only code are gone.

## LiveKit: Cloud now, self-hosted later
Change only the three `LIVEKIT_*` values. `docker-compose.yml` and `infra/livekit.yaml` are ready for self-hosting.

## Housekeeping (automatic, in the database)
Chat deleted after 7 days. Reports after 30 days. Code and recovery attempts after 1 day. Rate-limit counters after 2 hours.

## Rate limits
Sign-up 20 per hour and password recovery 30 per hour per connection (the IP is hashed, never stored); audio tokens 30 per 10 minutes and host controls 120 per minute per account. The counters live in the database, so they work on Vercel.

## Deploying
See [docs/DEPLOY.md](docs/DEPLOY.md) for the Vercel steps, every environment variable, and a first-deploy checklist.

## Crisis help
The Need help now button (every app screen, and inside live rooms and group chat) shows verified helplines from `src/lib/help.ts`, with the date they were last checked. Hosts have a short "If someone is in crisis" guide on the Host tools page. Re-check the numbers before launch.

## Known gaps
- Payments are not implemented; bookings are requests. Therapists and library items are samples in `src/lib/data.ts`.
- A forgotten **username** can't be recovered (there is no email or phone to look it up by). The sign-up screen tells people to write it down.
- Security questions are weaker than a recovery code. If you want a stronger option later, add a 6-word code shown once at sign-up.
- Voice effects are a disguise, not a guarantee. They make a voice harder to recognise but not impossible.
- Helpline numbers were verified from public directories on 9 Nov 2026. Confirm them with each organisation before launch; ask SURPIN or MANI whether they will accept referrals from Therapia hosts.
