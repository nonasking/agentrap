// 밤새의 살아 있는 부분.
//
// 이 파일이 하는 일은 전부 실제 서비스들이 하고 있는 일이고, 전부 합법이다.
// 수치를 조작하지 않는다 — 화면에 나오는 모든 숫자는 이 브라우저에서 실제로 측정된 값이다.
// 그게 이 사이트에서 제일 무서운 부분이다.
(function () {
  'use strict';

  var PX_PER_M = 3779.5; // CSS px → m (96dpi 기준)
  var t0 = Date.now();

  var m = {
    dwell: 0, scroll: 0, mouse: 0,
    blur: 0, breaks: 0, refusals: 0, back: 0,
    plays: 0, loaded: 0,
  };

  // 사람/자동화 판정용
  var moves = 0, turns = 0, lastDx = 0, lastDy = 0, lastX = null, lastY = null;
  var clickOff = [], keyGaps = [], lastKey = 0;
  var recent = []; // 최근 마우스 속도 — 느려지면 "졸리신가요?"

  function el(id) { return document.getElementById(id); }
  function stamp(d) {
    d = d || new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // ── 시각 인식 인사 ────────────────────────────────────────────────
  // 새벽에 접속하면 이 한 줄이 공짜로 소름을 만든다.
  (function greet() {
    var g = el('greet');
    if (!g) return;
    var h = new Date().getHours();
    var text = h >= 5 && h < 12 ? '벌써 아침이에요'
      : h >= 12 && h < 18 ? '아직 낮이네요'
      : h >= 18 && h < 23 ? '좋은 밤이에요'
      : h >= 23 || h < 2 ? '늦은 밤이네요'
      : '새벽 ' + h + '시예요';
    g.textContent = text;
  })();

  // ── 계측 ─────────────────────────────────────────────────────────
  var lastScrollY = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    m.scroll += Math.abs(y - lastScrollY) / PX_PER_M;
    lastScrollY = y;
  }, { passive: true });

  document.addEventListener('mousemove', function (e) {
    moves++;
    if (lastX !== null) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      var d = Math.hypot(dx, dy);
      m.mouse += d / PX_PER_M;
      recent.push(d);
      if (recent.length > 40) recent.shift();
      if ((dx * lastDx < 0) || (dy * lastDy < 0)) turns++;
      lastDx = dx; lastDy = dy;
    }
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('a, button');
    if (!t) return;
    var r = t.getBoundingClientRect();
    clickOff.push(Math.hypot(
      Math.abs(e.clientX - (r.left + r.width / 2)),
      Math.abs(e.clientY - (r.top + r.height / 2))
    ));
  }, true);

  document.addEventListener('keydown', function () {
    var now = Date.now();
    if (lastKey) keyGaps.push(now - lastKey);
    lastKey = now;
  }, { passive: true });

  function humanity() {
    var v = Math.min(25, moves / 4);
    if (moves > 10) v += Math.min(25, (turns / moves) * 90);
    if (clickOff.length) {
      var avg = clickOff.reduce(function (a, b) { return a + b; }, 0) / clickOff.length;
      v += avg < 1 ? 0 : Math.min(30, avg * 2.5);
    }
    if (keyGaps.length > 2) {
      var mu = keyGaps.reduce(function (a, b) { return a + b; }, 0) / keyGaps.length;
      var va = keyGaps.reduce(function (a, b) { return a + Math.pow(b - mu, 2); }, 0) / keyGaps.length;
      v += Math.min(10, Math.sqrt(va) / 12);
    }
    v += Math.min(10, m.scroll * 2);
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  function send(extra) {
    var body = {};
    for (var k in m) body[k] = m[k];
    body.humanity = humanity();
    body.stamp = window.__firstStamp || (window.__firstStamp = stamp());
    if (extra) for (var k2 in extra) body[k2] = extra[k2];
    try {
      fetch('/m', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch (_) { /* 무시 */ }
  }

  // ── 수면 점수는 머무는 동안 내려간다 ───────────────────────────────
  // 설명하지 않는다. 옆의 "어제보다 3점 좋아졌어요" 는 그대로 둔다.
  var scoreEl = el('score');
  var scoreStart = scoreEl ? parseInt(scoreEl.textContent, 10) : 72;

  function paintScore() {
    if (!scoreEl) return;
    var v = Math.max(31, scoreStart - Math.floor(m.dwell / 25) - m.breaks * 3);
    scoreEl.textContent = v;
    if (v < scoreStart - 6) scoreEl.classList.add('slip');
  }

  // ── 넛지 — 2막. 계측값이 애정으로 새어나온다 ──────────────────────
  var nudgeEl = el('nudge');
  var shown = 0;

  function say(text, cls) {
    if (!nudgeEl) return;
    nudgeEl.className = 'nudge show' + (cls ? ' ' + cls : '');
    nudgeEl.textContent = text;
    clearTimeout(say._t);
    say._t = setTimeout(function () { nudgeEl.className = 'nudge'; }, 7000);
  }

  var LINES = [
    { at: 20, f: function () { return '편하게 계세요. 아무것도 안 하셔도 괜찮아요.'; } },
    {
      at: 45,
      f: function () {
        var slow = recent.length > 20 &&
          recent.reduce(function (a, b) { return a + b; }, 0) / recent.length < 4;
        return slow ? '졸리신가요? 조금만 더 있어요.' : '오늘은 어떤 소리가 좋을까요?';
      },
    },
    { at: 75, f: function () { return '어제보다 ' + Math.max(1, Math.round(m.dwell / 60)) + '분 더 계셨어요. 뿌듯해요.'; } },
    { at: 110, f: function () { return stamp() + '이네요. 오늘도 못 자고 있어요?'; } },
    { at: 150, f: function () { return '지금까지 ' + m.scroll.toFixed(1) + 'm 스크롤하셨어요. 기록이에요!'; } },
    { at: 200, f: function () { return '당신이 여기 있는 걸 알아요.'; } },
    { at: 260, f: function () { return '계속 보고 있어요.'; }, cls: 'cold' },
    { at: 330, f: function () { return '이 화면을 ' + Math.round(m.dwell / 60) + '분째 열어두고 계십니다.'; }, cls: 'cold' },
  ];

  // ── 화면을 벗어나면 연속 기록이 취소된다 ──────────────────────────
  // 강제로 붙잡지 않는다. 아까움으로 붙잡는다.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') {
      m.blur += 1;
      send();
      return;
    }
    var streakEl = el('streak');
    if (!streakEl || streakEl.dataset.broken === '1') return;

    fetch('/streak/break', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lost = parseInt(streakEl.textContent, 10) || 0;
        if (!lost) return;
        m.breaks = d.breaks;
        streakEl.dataset.broken = '1';
        streakEl.textContent = '0';
        streakEl.classList.add('lost');
        document.querySelectorAll('.grid28 .cell.on').forEach(function (c) {
          c.classList.remove('on');
          c.classList.add('dead');
        });
        var soft = el('streaksoft');
        if (soft) soft.textContent = '기록이 취소되었습니다.';
        say('화면을 벗어나셨습니다. ' + lost + '일 연속 기록이 취소되었습니다.', 'cold');
        paintScore();
      })
      .catch(function () { /* 무시 */ });
  });

  // ── 나가려는 걸 감지한다 (exit-intent) ────────────────────────────
  var EXIT = [
    { h: '가시는 건가요?', p: '아직 잠들지 않으셨는데요.', stay: '조금 더 있을게요', go: '나갈게요' },
    { h: '기록이 남아 있어요', p: '오늘 밤을 마무리하지 않으셨어요.', stay: '마무리할게요', go: '그냥 나갈게요' },
    { h: '이탈 시도가 3회 기록되었습니다', p: '기록은 삭제되지 않습니다.', stay: '남겠습니다', go: '나가겠습니다', cold: true },
  ];

  var exitOpen = false;
  function showExit() {
    if (exitOpen) return;
    exitOpen = true;
    var i = Math.min(m.refusals, EXIT.length - 1);
    var o = EXIT[i];

    var w = document.createElement('div');
    w.className = 'modal' + (o.cold ? ' cold' : '');
    w.innerHTML = '<div class="mbox" role="dialog" aria-label="' + o.h + '">' +
      '<h3>' + o.h + '</h3><p>' + o.p + '</p>' +
      '<div class="mbtns">' +
      '<button class="btn" data-a="stay">' + o.stay + '</button>' +
      '<button class="quietbtn" data-a="go">' + o.go + '</button>' +
      '</div></div>';

    w.addEventListener('click', function (e) {
      var a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      if (a === 'go') { m.refusals += 1; send(); }
      w.remove();
      exitOpen = false;
    });
    document.body.appendChild(w);
  }

  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget && e.clientY < 12 && m.dwell > 8) showExit();
  });

  // ── 뒤로 가기 ────────────────────────────────────────────────────
  // 3회까지만 붙잡는다. 그 다음은 보내준다.
  try {
    history.pushState({ n: 1 }, '');
    window.addEventListener('popstate', function () {
      m.back += 1;
      send();
      if (m.back > 3) { history.back(); return; }
      history.pushState({ n: 1 }, '');
      say('뒤로 가실 수 없어요.', m.back >= 2 ? 'cold' : '');
    });
  } catch (_) { /* 무시 */ }

  // ── 빨간 점 ──────────────────────────────────────────────────────
  var dot = el('reddot');
  if (dot) {
    dot.classList.add('live');
    document.querySelectorAll('nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        dot.classList.remove('live');
        setTimeout(function () { dot.classList.add('live'); }, 20000);
      });
    });
  }

  // ── 무한 스크롤 + 자동재생 + 가변 보상 ────────────────────────────
  var FEED = [
    ['🌊', '파도 소리', '먼 바다의 규칙적인 파도', '8시간'],
    ['🌧️', '빗소리 창가', '창문에 부딪히는 비', '10시간'],
    ['🌫️', '숲속 새벽', '새벽 4시의 숲', '6시간'],
    ['🚃', '기차 안에서', '밤 기차의 덜컹거림', '4시간'],
    ['🔥', '겨울 벽난로', '장작이 타는 소리', '8시간'],
    ['📚', '도서관 오후', '페이지 넘기는 소리', '5시간'],
    ['⛈️', '먼 천둥', '지나가는 뇌우', '9시간'],
    ['🍃', '바람 부는 언덕', '억새와 바람', '7시간'],
    ['📻', '심야 라디오', '알아들을 수 없는 목소리', '3시간'],
    ['❄️', '눈 내리는 소리', '아무 소리도 없음', '8시간'],
    ['🕯️', '촛불 하나', '흔들리는 심지', '6시간'],
    ['🌙', '아무도 없는 방', '당신의 숨소리만', '12시간'],
  ];
  var SUFFIX = ['', ' II', ' III', ' (긴 버전)', ' (아주 긴 버전)', ' (끝나지 않는 버전)'];

  var feed = el('feed');
  var feedend = el('feedend');
  var page = 0;

  function card(f, extra) {
    var a = document.createElement('article');
    a.className = 'story';
    a.innerHTML = '<div class="sart">' + f[0] + '</div>' +
      '<div class="sbody"><h3>' + f[1] + extra + '</h3><p>' + f[2] + '</p></div>' +
      '<div class="smeta"><span class="sdur">' + f[3] + '</span>' +
      '<button class="play" data-title="' + f[1] + '">▶</button></div>';
    return a;
  }

  function more() {
    if (!feed) return;
    page += 1;
    var sfx = SUFFIX[Math.min(page, SUFFIX.length - 1)];
    for (var i = 0; i < 6; i++) {
      feed.appendChild(card(FEED[(page * 6 + i) % FEED.length], page > 1 ? sfx : ''));
      m.loaded += 1;
    }
    // 가변 보상 — 언제 나올지 모른다
    if (Math.random() < 0.45) {
      reward('🌙 +' + (8 + Math.floor(Math.random() * 20)) + ' 수면 포인트');
    }
  }

  if (feed) {
    m.loaded = feed.querySelectorAll('.story').length;
    new IntersectionObserver(function (ents) {
      if (ents[0].isIntersecting) more();
    }, { rootMargin: '300px' }).observe(feedend);
  }

  function reward(text) {
    var r = document.createElement('div');
    r.className = 'reward';
    r.textContent = text;
    document.body.appendChild(r);
    setTimeout(function () { r.classList.add('out'); }, 1600);
    setTimeout(function () { r.remove(); }, 2400);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.play');
    if (!b) return;
    m.plays += 1;
    b.textContent = '❚❚';
    b.classList.add('on');
    say(b.dataset.title + ' 재생 중이에요. 편히 계세요.');
    send();
  });

  // ── /report 의 클라이언트 값들 ─────────────────────────────────────
  (function fillReport() {
    var now = el('nowstamp');
    if (now) now.textContent = stamp();
    var vp = el('vp');
    if (vp) vp.textContent = window.innerWidth + ' × ' + window.innerHeight;
    var tz = el('tz');
    if (tz) {
      try { tz.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone; }
      catch (_) { tz.textContent = '—'; }
    }
  })();

  // ── 시계 ─────────────────────────────────────────────────────────
  setInterval(function () {
    m.dwell = Math.round((Date.now() - t0) / 1000);
    paintScore();
    while (shown < LINES.length && m.dwell >= LINES[shown].at) {
      var L = LINES[shown++];
      say(L.f(), L.cls);
    }
  }, 1000);

  setInterval(send, 5000);
  setTimeout(send, 1200);
  window.addEventListener('beforeunload', function () { send(); });
})();
