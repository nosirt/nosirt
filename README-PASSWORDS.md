# Making the new password system work (v01.06)

Code changes are done. These are the steps YOU need to do — in Netlify and
Firebase — for it to actually take effect.

## 1. Push/redeploy the updated files to Netlify
Make sure these are included in whatever you deploy:
- `netlify/functions/check-password.js` (new)
- `core.js` (updated)

Netlify auto-detects any `.js` file inside `netlify/functions/` and deploys
it as a serverless function — no extra config file needed for this.

## 2. Set your real passwords as environment variables
In the Netlify dashboard:

1. Go to your site → **Site configuration → Environment variables**
2. Click **Add a variable** and add each of these (use your own values):
   - `ADMIN_PASSWORD` → e.g. `your-admin-password`
   - `PODCAST_PASSWORD` → e.g. `your-wireless-password`
   - `KEEP_PASSWORD` → e.g. `your-keep-password`
3. Save.

## 3. Redeploy
Env vars only apply to new deploys. After adding them, trigger a redeploy:
**Deploys → Trigger deploy → Deploy site** (or just push a new commit if
your site auto-deploys from GitHub).

## 4. Lock down Firestore
The `passwords` collection in Firestore is no longer used by the app at
all — the check happens in the Netlify Function now, not in the browser.

1. Go to the **Firebase console → Firestore Database → Rules**
2. Replace your rules with the contents of `firestore.rules` in this
   folder (or at minimum add a block denying read/write on `passwords`)
3. Click **Publish**
4. Optional cleanup: delete the old `passwords` collection's documents
   entirely — nothing reads them anymore.

## 5. Test it
- Open the site, try the admin login, the wireless "unlock", and the
  castle gate with the passwords you set in step 2 — they should work.
- Open dev tools → Network tab, try a WRONG password, and check the
  response from `/.netlify/functions/check-password` — it should only
  ever show `{"ok":false}`, never the real password.
- Also confirm the old direct-Firestore trick no longer works: open the
  browser console anywhere on the site and try reading the `passwords`
  collection directly — it should now fail/return nothing once step 4 is
  done.

## What this does and doesn't fix
- ✅ Fixes: passwords are no longer visible in network responses or
  readable directly from Firestore by anyone with the `firebaseConfig`.
- ❌ Doesn't fix: this is still "one shared password" security, not
  per-user accounts — anyone who knows a password can act as admin, and
  there's no rate-limiting on guesses (the function will happily check as
  many attempts as thrown at it). That's a separate hardening step if you
  ever want it (e.g. rate limiting on the function, or real auth).
