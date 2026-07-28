// netlify/functions/account-update.js
//
// v01.24 — authenticated writes to a user's own account doc: avatar
// emoji and playlist. Deliberately separate from account-auth.js
// (signup/login) so the two concerns stay simple: one function proves
// who you are, this one only ever changes YOUR OWN data and always
// re-checks your token first — a client that skips account-auth and
// just POSTs here with a guessed token gets rejected the same as
// anyone else.
//
// Called by accounts.js via:
//   POST /.netlify/functions/account-update
//   Body: { username, token, action: 'setAvatar'|'setPlaylist', ...fields }
//   Returns: { ok: true, ... } or { ok: false, error }

const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}

function normalizeUsername(raw) {
  return (raw || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 20);
}

// Very small, deliberate emoji validator: exactly one grapheme, no bare
// letters/digits/punctuation smuggled in as a "profile pic." Uses the
// Extended_Pictographic Unicode property so any real emoji passes,
// including multi-codepoint ones (skin tones, ZWJ sequences like family
// emoji) — those are still ONE user-perceived character even though
// they're several JS string characters under the hood.
function isSingleEmoji(str) {
  if (!str) return false;
  const segments = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(str)];
  if (segments.length !== 1) return false;
  return /\p{Extended_Pictographic}/u.test(segments[0].segment);
}

const MAX_PLAYLIST_ITEMS = 200;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Account system is not configured yet.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Bad request' }) };
  }

  const { action, token } = body;
  const username = normalizeUsername(body.username);

  if (!username || !token) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Missing credentials.' }) };
  }

  initAdmin();
  const db = admin.firestore();
  const userRef = db.collection('nosirt_users').doc(username);

  try {
    const doc = await userRef.get();
    if (!doc.exists || doc.data().token !== token) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Not authorized.' }) };
    }

    if (action === 'setAvatar') {
      const emoji = body.avatarEmoji;
      if (!isSingleEmoji(emoji)) {
        return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Pick exactly one emoji.' }) };
      }
      await userRef.update({ avatarEmoji: emoji });
      return { statusCode: 200, body: JSON.stringify({ ok: true, avatarEmoji: emoji }) };
    }

    if (action === 'setDisplayName') {
      const displayName = (body.displayName || '').trim().slice(0, 20);
      if (displayName.length < 1) {
        return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Name cannot be empty.' }) };
      }
      await userRef.update({ displayName });
      return { statusCode: 200, body: JSON.stringify({ ok: true, displayName }) };
    }

    if (action === 'setPlaylist') {
      const playlist = Array.isArray(body.playlist) ? body.playlist.slice(0, MAX_PLAYLIST_ITEMS) : [];
      await userRef.update({ playlist });
      return { statusCode: 200, body: JSON.stringify({ ok: true, playlist }) };
    }

    if (action === 'setSavedItems') {
      // v01.24 sharing slice: bookmarked recs/forum posts someone shared
      // with you — separate from playlist because these aren't directly
      // playable, just reference material worth keeping.
      const savedItems = Array.isArray(body.savedItems) ? body.savedItems.slice(0, MAX_PLAYLIST_ITEMS) : [];
      await userRef.update({ savedItems });
      return { statusCode: 200, body: JSON.stringify({ ok: true, savedItems }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Unknown action' }) };
  } catch (err) {
    console.error('account-update error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Something went wrong. Try again.' }) };
  }
};
