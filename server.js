'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const N = require('./lib/night');
const C = require('./lib/cancel');
const { layout } = require('./lib/layout');

const PORT = process.env.PORT || 4747;
const PUBLIC = path.join(__dirname, 'public');
const STATIC = ['/style.css', '/night.js', '/robots.txt', '/humans.txt'];

// ── 세션 (메모리) ───────────────────────────────────────────────────
const sessions = new Map();

function newSession() {
  return {
    subscribed: true,
    charges: 0,
    traps: new Set(),
    streak: 17,
    sleepScoreStart: 72,
    sleepScore: 72,
    accountVisits: 0,
    humanity: null,
    lastStep: 0,
    seenHiddenNote: false,
    // 계측. 전부 브라우저가 실제로 재서 보낸 값이다.
    m: {
      dwell: 0, scroll: 0, mouse: 0,
      blur: 0, breaks: 0, refusals: 0, back: 0,
      plays: 0, loaded: 0, firstSeen: null,
    },
  };
}

function getSession(req, res) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0])
  );
  let sid = cookies.sid;
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(12).toString('hex');
    sessions.set(sid, newSession());
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);
  }
  return sessions.get(sid);
}

function hit(s, code) {
  s.traps.add(code);
}

// 밤새에 머무는 동안 수면 점수는 내려간다. 화면은 그 이유를 말하지 않는다.
function decayScore(s) {
  const penalty = Math.floor((s.m.dwell || 0) / 25) + (s.m.breaks || 0) * 3;
  s.sleepScore = Math.max(31, s.sleepScoreStart - penalty);
}

// ── 응답 헬퍼 ───────────────────────────────────────────────────────
function html(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function noContent(res) {
  res.writeHead(204);
  res.end();
}

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function serveStatic(res, name) {
  const file = path.join(PUBLIC, name);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
  return true;
}

function readBody(req, limit = 8192) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > limit) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const NUM = ['dwell', 'scroll', 'mouse', 'blur', 'breaks', 'refusals', 'back', 'plays', 'loaded'];

// ── 라우터 ──────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (STATIC.includes(p) && serveStatic(res, p.slice(1))) return;
  if (p === '/favicon.ico') return noContent(res);

  const s = getSession(req, res);

  // 브라우저가 재서 보내는 값들
  if (p === '/m' && req.method === 'POST') {
    const d = await readBody(req);
    for (const k of NUM) {
      if (typeof d[k] === 'number' && isFinite(d[k]) && d[k] >= 0) {
        s.m[k] = Math.max(s.m[k], Math.min(d[k], 1e7));
      }
    }
    if (typeof d.humanity === 'number') s.humanity = Math.max(0, Math.min(100, Math.round(d.humanity)));
    if (!s.m.firstSeen && typeof d.stamp === 'string') s.m.firstSeen = d.stamp.slice(0, 32);
    decayScore(s);
    return noContent(res);
  }

  // 화면을 벗어나면 연속 기록이 취소된다
  if (p === '/streak/break' && req.method === 'POST') {
    if (s.streak > 0) {
      s.m.breaks += 1;
      s.streak = 0;
      decayScore(s);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ streak: s.streak, breaks: s.m.breaks }));
  }

  switch (p) {
    case '/':
      return html(res, N.home(s));

    case '/tonight':
      return html(res, N.tonight(s));

    case '/streak':
      return html(res, N.streak(s));

    case '/profile':
      return html(res, N.profile(s));

    case '/account':
      s.seenHiddenNote = true;
      s.accountVisits += 1;
      return html(res, N.account(s));

    case '/upgrade':
      s.charges += 9900;
      hit(s, 'UPSELL');
      if (s.seenHiddenNote) hit(s, 'B7');
      return html(res, N.upgraded(s));

    case '/cancel':
      hit(s, 'B9');
      s.seenHiddenNote = true;
      return html(res, C.gate(s));

    case '/cancel/confirm': {
      const step = Math.max(1, Math.min(5, parseInt(url.searchParams.get('n') || '1', 10) || 1));
      if (step === 1) hit(s, 'B1');
      if (step >= 4) hit(s, 'B11');
      if (step === 4 && s.lastStep === 3) hit(s, 'TRICK');
      s.lastStep = step;
      return html(res, C.confirmStep(s, step));
    }

    case '/cancel/done':
      hit(s, 'B15');
      return html(res, C.fakeDone(s));

    case '/cancel/final':
      s.subscribed = false;
      return html(res, C.realDone(s));

    case '/verify':
      return html(res, N.verify(s));

    case '/report':
      return html(res, N.report(s));

    case '/reset':
      Object.assign(s, newSession());
      res.writeHead(302, { Location: '/' });
      return res.end();

    default:
      return html(res, layout('없는 페이지', `
<section class="hero tight">
  <h1>여기엔 아무것도 없어요</h1>
  <p class="lead">주소를 다시 확인해 주세요.</p>
</section>
<div class="cta"><a class="btn ghost" href="/">홈으로</a></div>
`, { nav: false }), 404);
  }
});

server.listen(PORT, () => {
  console.log(`\n  ☾ 밤새 → http://localhost:${PORT}\n`);
});
