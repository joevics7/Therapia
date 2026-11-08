# Therapia

Anonymous voice support groups, one-on-one therapy and self-help tools for Nigeria, then Africa.

## What works
- **Anonymous accounts** (Supabase). No email or phone. Optional 6-word recovery phrase restores the account on a new phone.
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
1. Turn **Anonymous sign-ins** on.
2. Turn **Confirm email** off (the recovery phrase uses a private, never-emailed address).

Create a facilitator: add the user in Authentication > Users, then in the SQL editor:
```sql
update public.profiles set role = 'facilitator' where user_id = '<their user id>';
update public.rooms set host_id = '<their user id>' where id = 'safe';
```
Use `role = 'admin'` for yourself to manage every group.

## Privacy design
- Each person gets a random **alias per group**, so they can't be linked across groups. Chat and audio use the alias.
- Listeners are never asked for personal details. Hosts can't see user ids; reports hide who reported.
- Only the database decides who is a member or host. The shared host key and shared women-only code are gone.

## LiveKit: Cloud now, self-hosted later
Change only the three `LIVEKIT_*` values. `docker-compose.yml` and `infra/livekit.yaml` are ready for self-hosting.

## Housekeeping (automatic, in the database)
Chat deleted after 7 days. Reports after 30 days. Code attempts after 1 day.

## Known gaps
- Payments are not implemented; bookings are requests. Therapists and library items are samples in `src/lib/data.ts`.
- Anonymous accounts that are never used again are not cleaned up yet.
- The audio token route has no rate limit yet.
- Crisis protocol and verified helpline numbers still need adding.
