# Deploying MOSAIC

The app works with no backend at all — without credentials every network call is a no-op and events stay in `localStorage`. These steps add the backend and put it online.

Steps 1, 2 and 5 need an account, so they are yours. Everything else is already wired.

---

## 1. Create the Supabase project

1. At <https://supabase.com/dashboard>, create a new project.
2. Pick a region near your school and save the database password somewhere safe (this app never needs it).
3. Wait for provisioning to finish.

> Use a **new project**, not the one behind an earlier study. The event taxonomy is different, and mixing two instruments in one `events` table makes every analysis query start with a filter you will eventually forget.

## 2. Create the tables

Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql), run it. Safe to re-run.

Then confirm RLS is actually on — this is the check worth doing by hand:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('sessions','events');
```

Both rows must show `rowsecurity = true`. If they do not, one student can read every other student's session.

## 3. Get the keys

**Project Settings → API**:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public** key → `VITE_SUPABASE_ANON_KEY`

The anon key is *meant* to be public; it ships in the client bundle and anyone can read it from devtools. RLS is what protects the data.

> **Never** put the `service_role` key in this app, in `.env`, or in the repo. It bypasses RLS completely. Use it only from your own machine when pulling data for analysis.

## 4. Test locally

```bash
cp .env.example .env.local
```

Fill in the two values, then:

```bash
npm run dev
```

Play a full session. In Supabase → **Table Editor** you should see one `sessions` row and a stream of `events` rows with `seq` starting at 1 and no gaps.

## 5. Deploy to Vercel

```bash
npx vercel
```

Follow the prompts to link or create the project, then add the same two environment variables — dashboard under **Settings → Environment Variables**, or:

```bash
npx vercel env add VITE_SUPABASE_URL
```

```bash
npx vercel env add VITE_SUPABASE_ANON_KEY
```

Add them to **Production, Preview and Development**. They are build-time values, so redeploy after adding:

```bash
npx vercel --prod
```

---

## Study-day checklist

- `npm run verify-levels` passes.
- Full run on the actual classroom hardware, not a laptop simulating touch.
- Press-and-hold tested with a finger, not a mouse — it is how a student sees which regions touch.
- Airplane mode mid-session: the puzzle continues, events flush when the network returns.
- Refresh mid-session: resumes on the same screen, same session id, no duplicate `sessions` row.
- `?reset` on the URL clears a device between students.
- Free Supabase projects pause after about a week idle and take a minute or two to wake. Wake it the morning of, and **test the wake path at least once** — the first student otherwise hits a dead endpoint.

## If a device never reached the network

On the end screen, tap the **MOSAIC COMPLETE** header five times. That downloads the whole session as JSON, including every event that never flushed. It is the last resort in the chain, not the plan.

## Pulling the data

From your own machine, with the service_role key (never in the app):

```sql
select s.id, s.first_name, s.last_initial, s.grade, min(e.server_ts) filter (where e.type = 'session_start') as started, max(e.server_ts) filter (where e.type = 'session_end') as ended, bool_or(e.type = 'session_end') as completed from sessions s left join events e on e.session_id = s.id group by s.id order by started;
```

More starter queries are at the bottom of `supabase/schema.sql`.
