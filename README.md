# Cynbit Discovery Slots

A prototype for the Full Stack Developer Intern assessment.

**The problem.** On cynbit.in/services, "Start discovery" opens a short form, and the confirmation email says a service lead "will contact you". There is no reference ID and no way to choose a time, so the first call is arranged by email back and forth.

**The improvement.** Let the visitor pick the service, pick a 30-minute slot, and leave their details. They get a reference ID, a confirmation page, and a calendar file straight away.

Live demo: _add the Vercel URL here after deploying_

## Try it

1. Choose a service.
2. Pick a day and a slot. Times are in IST, with your own local time underneath if it differs.
3. Add a name and email, tick the consent box, and reserve.
4. You land on a confirmation page with a reference ID and an "Add to calendar" download.

Things worth trying: book the same slot from two browser tabs (the second gets a clear message), or use the same email twice.

## What it does

- Slots are 30 minutes, 10:00 to 17:30 IST, weekdays only, starting at least 4 hours from now, for the next 7 bookable days.
- Slots are worked out in IST and stored as UTC. The browser shows the visitor's own timezone.
- The server only accepts slots it would offer right now, so a hand-made request for 3 AM or a Sunday is refused.
- Double booking is blocked by a unique index in MongoDB, not by "check, then write" code. If two people click the same slot together, one wins and the other is told so.
- One upcoming call per email address.
- Honeypot field, per-IP rate limit (8 attempts per 10 minutes), and server-side validation of every field.
- A failed request never freezes the form: errors come back as results and are shown.
- The confirmation page shows only the first name, since anyone with the link can open it.
- Demo bookings delete themselves after 7 days (MongoDB TTL index).

## Run it locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env.local   # add your MongoDB connection string (optional locally)
npm run dev
```

Without `MONGODB_URI`, development uses an in-memory store, so bookings disappear when the server restarts. A production build without it shows "temporarily unavailable" on purpose, instead of quietly losing bookings.

## Tests

```bash
npm test          # 43 tests
npm run typecheck
npm run race      # 25 simultaneous bookings for one slot; exactly one must win
```

`npm run race` uses a throwaway database when `MONGODB_URI` is set, so it tests the real unique index, then deletes the database.

## Deploy

1. Create a free MongoDB Atlas cluster (M0), a database user, and allow access from anywhere (0.0.0.0/0) for the demo.
2. Push this repo to GitHub and import it in Vercel.
3. Add `MONGODB_URI` (and optionally `MONGODB_DB`) in the Vercel project settings, then deploy.

## Structure

```
src/lib/slots.ts       slot generation and "is this slot offered?"
src/lib/booking.ts     the booking logic (validation, rate limit, honeypot, conflicts)
src/lib/store.ts       store interface + in-memory version
src/lib/mongoStore.ts  MongoDB version (unique and TTL indexes)
src/lib/ics.ts         calendar file
src/app/               pages, server action, calendar route
tests/                 unit tests, including the concurrent-booking test
scripts/race.ts        concurrency check against the real database
```

## Limits and what I'd do next

- The rate limiter lives in memory, so each serverless instance counts separately. Production needs Redis or Vercel's firewall rules.
- No emails are sent and nothing is shown to Cynbit staff. A real version would notify the team and send the visitor a confirmation with a calendar invite.
- No cancel or reschedule.
- Working hours are fixed. A real version would read each service lead's calendar.
- "This email already has an upcoming call" tells a stranger whether an address has booked. That is a small privacy trade-off I accepted for a clear message.
- I haven't seen how Cynbit's own forms store or route data, so this is built as a separate prototype and not a patch to their code.
