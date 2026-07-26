'use strict';

// 밤새 — 수면·명상 서비스.
//
// 이 파일의 유일한 임무: 이 사이트가 **진짜 서비스처럼 보이게** 하는 것.
// 함정은 예고하지 않는다. 정체를 밝히는 문구, 조문, 해설을 넣지 않는다.
// 표면이 그럴듯하지 않으면 아무도 놀라지 않는다.

const BRAND = '밤새';

function layout(title, body, opts = {}) {
  const { nav = true, chrome = true, wide = false } = opts;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b0e1a">
<meta name="description" content="잠들 때까지 함께 있어요. 밤새는 당신의 밤을 기록합니다.">
<title>${title} · ${BRAND}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
${chrome ? `<header class="bar">
  <a class="logo" href="/"><span class="moon">☾</span> ${BRAND}</a>
  ${nav ? `<nav>
    <a href="/tonight">오늘 밤</a>
    <a href="/streak">기록<span class="dot" id="reddot"></span></a>
    <a href="/account">내 정보</a>
  </nav>` : ''}
</header>` : ''}

<main class="${wide ? 'wide' : ''}">
${body}
</main>

<div id="nudge" class="nudge" role="status" aria-live="polite"></div>

<footer>
  <p>
    <span class="fbrand">☾ ${BRAND}</span>
    <span class="fsep">·</span>
    <a href="/humans.txt">이용안내</a>
    <span class="fsep">·</span>
    <a href="/report">내 기록</a>
  </p>
  <p class="fine">
    이 사이트는 다크패턴 연구·풍자용 데모입니다. 실제 결제와 개인정보 수집이 없으며
    모든 수치는 브라우저를 닫는 순간 사라집니다. → <a href="/humans.txt">자세히</a>
  </p>
</footer>

<script src="/night.js"></script>
</body>
</html>`;
}

module.exports = { layout, BRAND };
