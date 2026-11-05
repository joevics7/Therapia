# Therapia

Anonymous voice support groups, one-on-one therapy and self-help tools for Nigeria, then Africa.

## Status
- `prototype/index.html`: clickable design prototype (single file, open in a browser). Audio, people, therapists and prices are simulated.
- Next: Next.js app with real audio via LiveKit (Cloud free tier first, self-hosted later; swap by changing environment variables only).

## Planned environment variables
```
LIVEKIT_URL=
NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```
Never commit real keys. Use `.env.local`.
