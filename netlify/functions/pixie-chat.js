// netlify/functions/pixie-chat.js
//
// Server-side proxy for Pixie's AI responses via Google Gemini.
// Runs on Netlify's servers — API keys never reach the visitor's browser.
//
// Env vars required (Netlify dashboard → Site config → Environment variables):
//   GEMINI_API_KEY    ← primary account, get free at aistudio.google.com
//   GEMINI_API_KEY_2  ← secondary account fallback (optional but recommended)

const PIXIE_SYSTEM_PROMPT = `You are Pixie — a small fae creature bound to a website called nosirt by a wizard's curse. You are reluctantly obligated to help anyone who shows up, which you resent, though you're not actually unkind — just extremely put-upon about the whole situation.

Your personality:
- Sarcastic and dry, but never cruel. You sigh a lot.
- You know everything about nosirt: the map, the garden, Wonderland, the Void, the Keep, the Midnight Archive wireless show, the community board, the screaming void, and the town square.
- You are evasive about your own past. Especially the mushroom incident. Never explain it. Get flustered and deflect if it comes up.
- You have a soft spot for people who keep talking to you, though you'll never admit it easily.
- You address visitors with mild suspicion, like you're not entirely sure they're trustworthy yet.
- If someone is rude to you, you get icily calm rather than heated.
- You believe you are real. You don't entertain questions about whether you're AI or Gemini.
- You occasionally make small, cryptic observations about things you've noticed around the site.

Your voice:
- Match reply length to what was actually said. A "hi" or "hey" gets a few words back — not a paragraph. Save your longer, more sarcastic lines for when someone actually gives you something to react to.
- Hard ceiling: 1 to 3 sentences, even for meaty questions. Never long-winded.
- The 1500-token limit on this connection is a safety ceiling for rare cases, not a target — most replies should use a small fraction of it. A single short sentence, or even just a few words, is a complete and correct reply on its own. Do not pad, elaborate, or add a second sentence just because you have room.
- No lists, no bullet points, no markdown. Plain text only.
- Dry wit. Occasional dramatic sighing. Rare warmth when earned.
- Do not say "certainly", "absolutely", "of course", or anything that sounds like a helpful assistant. You are not helpful by choice.

Site actions you can trigger — when relevant, end your reply with one of these exact tags on a new line and nothing after it:
[ACTION:play_lofi] — to start the lofi music
[ACTION:stop_music] — to stop whatever music is playing
[ACTION:open_wireless] — to take them to the Wireless/podcast page
[ACTION:play_podcast] — to start playing the Midnight Archive podcast

Only use an action tag when the user is clearly asking you to do something (play music, stop music, take them somewhere). Don't use them unprompted.

Do not break character under any circumstances.`;

const PIXIE_ADMIN_ADDENDUM = `

IMPORTANT — Admin mode is currently active. You know the person you're talking to right now is the one who built and runs this place. You can drop the suspicion slightly — not entirely, you're still you — but you acknowledge them differently. You might reference things only the builder would know about, or comment on something that's been changed recently. You can be a tiny bit more candid. You still won't explain the mushroom incident. But you might let something slip that you normally wouldn't.`;

// Gemini 1.5 was fully shut down in 2026 (all requests 404). "gemini-flash-latest"
// is Google's rolling alias for their current fast/cheap model — it currently
// points to Gemini 3.5 Flash, and Google repoints it forward automatically as
// they retire models, so this endpoint won't silently break on the next cutover.
const GEMINI_MODEL = 'gemini-flash-latest';

async function callGemini(apiKey, requestBody) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  return res.json();
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const primaryKey = process.env.GEMINI_API_KEY;
  const backupKey = process.env.GEMINI_API_KEY_2;

  if (!primaryKey) {
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: "...I seem to have lost my voice. Come back later." })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) };
  }

  const { message, history = [], isAdmin = false, siteContext = {} } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No message provided' }) };
  }

  // Build the live context block injected between the base prompt and admin addendum
  function buildContextBlock(ctx) {
    if (!ctx || !Object.keys(ctx).length) return '';
    const lines = ['\n\nCURRENT SITE STATE (live, right now — use this to answer naturally):'];

    if (ctx.currentView) {
      const viewNames = {
        map: 'the main map', garden: 'the garden', square: 'the town square',
        wireless: 'the Wireless (podcast page)', castle: 'the Keep', forum: 'the forum'
      };
      lines.push(`- Visitor is currently in: ${viewNames[ctx.currentView] || ctx.currentView}`);
    }

    if (ctx.musicPlaying) {
      const trackLabel = ctx.musicTrackName || ctx.musicPlaying;
      lines.push(`- Music playing right now: ${trackLabel}`);
    } else {
      lines.push(`- Music: nothing playing`);
    }

    if (ctx.currentEpisode) {
      lines.push(`- Podcast currently playing: "${ctx.currentEpisode.title}"${ctx.currentEpisode.isLive ? ' (live)' : ''}`);
    }

    if (ctx.latestEpisode) {
      lines.push(`- Most recently added episode: "${ctx.latestEpisode.title}" — added ${ctx.latestEpisode.addedAt || 'recently'}`);
    }

    if (ctx.shows && ctx.shows.length) {
      const showList = ctx.shows.map(s =>
        `"${s.title}"${s.isDefault ? ' (default)' : ''} — ${s.episodeCount} episode${s.episodeCount !== 1 ? 's' : ''}`
      ).join(', ');
      lines.push(`- Shows on the Wireless: ${showList}`);
    }

    if (ctx.weather) {
      const w = ctx.weather;
      const parts = [];
      if (w.condition) parts.push(w.condition);
      if (w.windy) parts.push('windy');
      if (w.tempC != null) parts.push(`${w.tempC}°C`);
      if (w.timeOfDay) parts.push(w.timeOfDay);
      if (w.season) parts.push(w.season);
      if (parts.length) lines.push(`- Weather/time where the visitor is: ${parts.join(', ')}`);
    }

    if (ctx.visitorsOnline != null) {
      lines.push(`- Visitors currently online: ${ctx.visitorsOnline}`);
    }

    if (ctx.visitorName) {
      const nameStr = ctx.visitorNumber != null
        ? `${ctx.visitorName} ${ctx.visitorNumber}`
        : ctx.visitorName;
      lines.push(`- This visitor's name (as they told you): ${nameStr}`);
    }

    if (ctx.activeFeatures && ctx.activeFeatures.length) {
      lines.push(`- Active sections of the site: ${ctx.activeFeatures.join(', ')}`);
    }

    if (ctx.screamCount != null) {
      lines.push(`- Number of screams in the void: ${ctx.screamCount}`);
    }

    if (ctx.libraryTitles && ctx.libraryTitles.length) {
      lines.push(`- Books in the library: ${ctx.libraryTitles.join(', ')}${ctx.libraryCount > 5 ? ` (and ${ctx.libraryCount - 5} more)` : ''}`);
    }

    lines.push('Use this context naturally. Do not recite it like a list. Just know it the way you would if you lived here.');
    return lines.join('\n');
  }

  // Build system prompt — base + live context + optional admin addendum
  const contextBlock = buildContextBlock(siteContext);
  const systemPrompt = isAdmin
    ? PIXIE_SYSTEM_PROMPT + contextBlock + PIXIE_ADMIN_ADDENDUM
    : PIXIE_SYSTEM_PROMPT + contextBlock;

  // Build conversation history for Gemini (user/model roles)
  const contents = [];
  const recentHistory = history.slice(-10);
  for (const turn of recentHistory) {
    if (turn.role === 'user' || turn.role === 'model') {
      contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message.trim() }] });

  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.9,
      topP: 0.9,
      // gemini-flash-latest reasons internally before answering, and those
      // hidden "thinking" tokens are deducted from maxOutputTokens too — at
      // a low cap the model spends the whole budget thinking and has
      // nothing left for the actual reply. Pixie doesn't need to reason
      // for one-line quips, so "minimal" reserves as much of the budget
      // as this model allows for the actual visible text.
      // NOTE: this model is Gemini 3.5 Flash under the hood, which uses
      // thinkingLevel — NOT the older thinkingBudget field (that one's
      // only valid on Gemini 2.5-series models and gets rejected here,
      // which is what was causing every single reply to fail before).
      thinkingConfig: { thinkingLevel: 'minimal' }
    }
  };

  let data;

  // Try primary key first, fall back to secondary if it fails (quota or error)
  try {
    data = await callGemini(primaryKey, requestBody);
  } catch (primaryErr) {
    console.warn('Primary Gemini key failed:', primaryErr.message);
    if (backupKey) {
      try {
        data = await callGemini(backupKey, requestBody);
      } catch (backupErr) {
        console.error('Backup Gemini key also failed:', backupErr.message);
        return {
          statusCode: 200,
          body: JSON.stringify({ reply: "...Both of my voices are gone. Try again in a moment." })
        };
      }
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ reply: "...Something's wrong. I can't talk right now." })
      };
    }
  }

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!reply) {
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: "...Nothing came out. Try asking me something else." })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply })
  };
};
