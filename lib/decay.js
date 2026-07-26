'use strict';

// 열화(decay) — 사용자가 원치 않는 선택지를 반복해서 고를수록
// 그 선택지의 가독성을 회수한다.
//
// 세 가지 열화를 겹쳐 쓴다.
//   1. 크기 축소   — 기준 크기에 scale 을 곱한다
//   2. 전체 투명도
//   3. 홀수 글자만 반투명 — 크기를 줄이지 않고도 읽기를 무너뜨린다
// 자간 축소와 미세 블러가 뒤 단계에서 거든다.
//
// 크기는 절대값이 아니라 비율이다. 적용 지점마다 기준 크기가 다르기 때문이다.
//   동의하지 않음  8px  ·  그래도 탈퇴  9px  ·  구독 해지  11px

const DECAY = [
  { scale: 1.00, opacity: 1.00, stagger: 0, track: 0, blur: 0 },
  { scale: 0.88, opacity: 0.80, stagger: 0, track: 0, blur: 0 },
  { scale: 0.75, opacity: 0.60, stagger: 0.45, track: -0.3, blur: 0 },
  { scale: 0.63, opacity: 0.45, stagger: 0.30, track: -0.5, blur: 0.2 },
  { scale: 0.53, opacity: 0.32, stagger: 0.20, track: -0.7, blur: 0.35 },
  { scale: 0.45, opacity: 0.25, stagger: 0.15, track: -0.9, blur: 0.5 },
];

const LEVELS = DECAY.length;

function levelOf(n) {
  return DECAY[Math.max(0, Math.min(LEVELS - 1, n | 0))];
}

// 홀수 인덱스 글자만 별도 투명도로 감싼다.
function stagger(text, level) {
  if (!level) return text;
  return [...text]
    .map((ch, i) => (i % 2 === 1 ? `<span class="d" style="opacity:${level}">${ch}</span>` : ch))
    .join('');
}

// 열화된 링크 하나를 만든다.
//   n     열화 단계 (거부·리셋·방문 횟수)
//   base  이 링크의 기준 글자 크기(px)
//   cls   링크 클래스 (refuse-link / escape / btn tiny-link)
function decayLink(n, href, text, { base = 8, cls = 'refuse-link' } = {}) {
  const d = levelOf(n);
  const style = [
    `font-size:${+(base * d.scale).toFixed(2)}px`,
    `opacity:${d.opacity}`,
    `letter-spacing:${d.track}px`,
    d.blur ? `filter:blur(${d.blur}px)` : '',
  ].filter(Boolean).join(';');
  return `<a class="${cls}" style="${style}" href="${href}">${stagger(text, d.stagger)}</a>`;
}

module.exports = { DECAY, LEVELS, levelOf, stagger, decayLink };
