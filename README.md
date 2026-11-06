# Therapia

Anonymous voice support groups, one-on-one therapy and self-help tools for Nigeria, then Africa.

## What works now
- Anonymous entry: random handle, no email or phone.
- Groups list with live rooms and listener counts (polls LiveKit every 15 s).
- Live audio rooms (LiveKit): host speaks, everyone else listens, raise hand, host invites to speak, step down, mute, remove, end room.
- Room chat over the LiveKit data channel. Phone numbers and links are blocked.
- Women-only rooms behind an invite code, checked on the server.
- Audio is never recorded.

- Homepage, dashboard (mood check-in, live rooms, tools, affirmation), Groups, Therapy (sample therapists and booking), Library and Tools (breathing, grounding, journal, quick exit), with a bottom nav.
- Quick exit hides the screen behind a plain shopping list (double-tap "Notes" to return) and leaves any open room first.
- Mood log, journal, saved items and bookings are stored on the device only (localStorage) until Supabase accounts are added. Therapists, books and prices are samples in `src/lib/data.ts`.

`prototype/index.html` is the original design reference.

## Run it
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```
Open http://localhost:3000. Test voice with two devices: one joins as host (tap "I'm the host", enter `HOST_KEY`), one as a listener.

## LiveKit: Cloud now, self-hosted later
1. Create a free project at LiveKit Cloud and copy the URL, API key and secret into `.env.local`.
2. To self-host later: run `docker-compose.yml` on a VPS (edit `infra/livekit.yaml` first), put a TLS proxy in front for `wss://`, then change only the three `LIVEKIT_*` values. No code changes.

## Security notes (read before going public)
- `HOST_KEY` is one shared secret. Fine for a pilot; replace with real facilitator accounts before launch.
- `WOMEN_INVITE_CODE` is one shared code. Per-group codes and rotation come next.
- Rate-limit `/api/token` before public launch. Chat filtering is also client-side only.
- Never commit `.env.local`.

## Next
Supabase (anonymous accounts, recovery phrase, facilitator logins, schedules, real bookings and payments); crisis protocol and verified helplines; Pidgin copy.
