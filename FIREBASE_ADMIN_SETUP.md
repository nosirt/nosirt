# Firebase Admin SDK Setup — Required for v01.24 Accounts

Everything else on this site writes straight to Firestore from the browser (client SDK, no real backend authority). The new account system deliberately does NOT do that for `nosirt_users` — signup/login and any account changes go through two Netlify functions using the Firebase **Admin SDK**, which is a different, more privileged credential than the public web config already in `core.js`.

You need to generate this once. It's a one-time setup.

## Step 1: Generate a Service Account Key

1. Go to the [Firebase Console](https://console.firebase.google.com/) → your project (`nosirt-197ae`)
2. Click the gear icon → **Project settings**
3. Go to the **Service accounts** tab
4. Click **Generate new private key** — this downloads a `.json` file
5. **Keep this file private.** It grants full admin access to your Firestore. Never commit it to GitHub, never put it in a public folder.

## Step 2: Extract Three Values

Open the downloaded JSON file. You need three fields from it:

```json
{
  "project_id": "nosirt-197ae",
  "client_email": "firebase-adminsdk-xxxxx@nosirt-197ae.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
}
```

## Step 3: Add to Netlify Environment Variables

Go to your Netlify project → **Site configuration → Environment variables**, and add:

```
FIREBASE_PROJECT_ID = nosirt-197ae
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@nosirt-197ae.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n
```

**Important about `FIREBASE_PRIVATE_KEY`:** paste the ENTIRE value including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines, with the `\n` sequences exactly as they appear in the JSON file (don't manually convert them into real line breaks — Netlify's env var field will store it as one long string, and the code un-escapes the `\n` back into real newlines at runtime).

## Step 4: Lock Down Firestore Rules for `nosirt_users` and `nosirt_dms`

This is the step that actually makes the whole "server verifies your token" design meaningful. Go to **Firestore Database → Rules** in the Firebase Console, and make sure both new collections specifically deny client writes (reads can stay open — your app needs to read other users' avatar/displayName, and read your own DM threads, from the client):

```
match /nosirt_users/{userId} {
  allow read: if true;
  allow write: if false; // writes ONLY happen via Admin SDK (account-auth.js, account-update.js)
}
match /nosirt_dms/{messageId} {
  allow read: if true;
  allow write: if false; // writes ONLY happen via Admin SDK (dm-send.js) — this stops a
                          // message's "from" field from being spoofed via devtools
}
```

If your current rules are wide-open (`allow read, write: if true` for everything), you specifically want to carve out an exception for these two collections. Everything else on the site can stay exactly as permissive as it already is — this only matters for account data and private messages.

## Step 5: Redeploy

Once the env vars are set and rules updated, redeploy. Test by:
1. Opening your profile panel
2. Signing up with a test username
3. Refreshing the page — you should still be logged in (this confirms the verify flow works)
4. Tapping your avatar and setting an emoji
5. Opening the site in an incognito window (a "different browser") and confirming that username is now taken but you can't log into it there — that's the intended behavior

---

**If you skip this setup:** the account system will show a friendly "Account system is not configured yet" message instead of crashing — nothing else on the site breaks, it just won't let anyone sign up until you do this.
