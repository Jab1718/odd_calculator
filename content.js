// PokerNow Odds Calculator v2.0 - Content Script

(function () {
  'use strict';

  if (window.__POKER_ODDS_LOADED__) return;
  window.__POKER_ODDS_LOADED__ = true;

  // ============================================================
  // CARD PARSING
  // ============================================================
  const VALUE_MAP = {
    '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
    'T':10,'10':10,'J':11,'Q':12,'K':13,'A':14
  };
  const VALUE_STR = ['','','2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const SUIT_SYM  = { h:'♥', d:'♦', c:'♣', s:'♠' };

  function parseCardEl(el) {
    const classes = Array.from(el.classList);
    let suit = null, val = null;
    for (const c of classes) {
      if (/^card-[hdcs]$/.test(c)) suit = c[5];
      const m = c.match(/^card-s-(.+)$/);
      if (m) val = VALUE_MAP[m[1]] !== undefined ? VALUE_MAP[m[1]] : parseInt(m[1]);
    }
    return (suit && val) ? { suit, val } : null;
  }

  function cardId(c) { return c.val * 4 + ['h','d','c','s'].indexOf(c.suit); }
  function cardLabel(c) { return VALUE_STR[c.val] + SUIT_SYM[c.suit]; }

  function readCards() {
    const community = [];
    const boardSelectors = [
      '.table-cards .card-container.flipped',
      '.table-cards .card-container',
      '[class*="table-cards"] [class*="card-container"]'
    ];
    for (const sel of boardSelectors) {
      document.querySelectorAll(sel).forEach(el => {
        const c = parseCardEl(el);
        if (c && !community.find(x => cardId(x) === cardId(c))) community.push(c);
      });
      if (community.length > 0) break;
    }

    let hole = [];
    const handSelectors = [
      '.table-player-cards .card-container.flipped',
      '.table-player-cards .card-container',
      '[class*="player-cards"] [class*="card-container"]'
    ];
    for (const sel of handSelectors) {
      const containers = document.querySelectorAll(sel);
      const byParent = new Map();
      containers.forEach(el => {
        const p = el.closest('[class*="player-cards"]');
        if (!p) return;
        if (!byParent.has(p)) byParent.set(p, []);
        const c = parseCardEl(el);
        if (c) byParent.get(p).push(c);
      });
      for (const [, cards] of byParent) {
        if (cards.length >= 2) { hole = cards.slice(0, 2); break; }
      }
      if (hole.length === 2) break;
    }
    return { hole, community };
  }

  // ============================================================
  // HAND EVALUATOR
  // ============================================================
  function evaluate5(cards) {
    const vals  = cards.map(c => c.val).sort((a,b) => b-a);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = false, straightHigh = 0;
    if (new Set(vals).size === 5 && vals[0] - vals[4] === 4) { isStraight = true; straightHigh = vals[0]; }
    if (!isStraight && vals[0]===14 && vals[1]===5 && vals[2]===4 && vals[3]===3 && vals[4]===2) {
      isStraight = true; straightHigh = 5;
    }
    if (isStraight && isFlush) return 8e8 + straightHigh;
    const cnt = {};
    vals.forEach(v => cnt[v] = (cnt[v]||0)+1);
    const grp = Object.entries(cnt).map(([v,n])=>[+v,n]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
    const [g0v,g0n] = grp[0];
    const g1n = grp[1]?.[1]||0, g1v = grp[1]?.[0]||0;
    if (g0n===4) return 7e8 + g0v*100 + g1v;
    if (g0n===3 && g1n===2) return 6e8 + g0v*100 + g1v;
    if (isFlush)    return 5e8 + vals[0]*1e6+vals[1]*1e4+vals[2]*100+vals[3]*10+vals[4];
    if (isStraight) return 4e8 + straightHigh;
    if (g0n===3) { const k=grp.slice(1).map(x=>x[0]); return 3e8+g0v*1e4+k[0]*100+k[1]; }
    if (g0n===2 && g1n===2) {
      const p1=Math.max(g0v,g1v), p2=Math.min(g0v,g1v);
      return 2e8+p1*1e4+p2*100+(grp[2]?.[0]||0);
    }
    if (g0n===2) { const k=grp.slice(1).map(x=>x[0]); return 1e8+g0v*1e6+(k[0]||0)*1e4+(k[1]||0)*100+(k[2]||0); }
    return vals[0]*1e6+vals[1]*1e4+vals[2]*100+vals[3]*10+vals[4];
  }

  function evaluate7(cards) {
    let best = 0;
    for (let i=0;i<7;i++) for (let j=i+1;j<7;j++) {
      const s = evaluate5(cards.filter((_,x)=>x!==i&&x!==j));
      if (s>best) best=s;
    }
    return best;
  }

  function evalBest(cards) {
    if (cards.length < 5) return 0;
    if (cards.length === 5) return evaluate5(cards);
    if (cards.length === 7) return evaluate7(cards);
    let best = 0;
    const n = cards.length;
    for (let i=0;i<n-4;i++) for (let j=i+1;j<n-3;j++) for (let k=j+1;k<n-2;k++)
      for (let l=k+1;l<n-1;l++) for (let m=l+1;m<n;m++) {
        const s = evaluate5([cards[i],cards[j],cards[k],cards[l],cards[m]]);
        if (s>best) best=s;
      }
    return best;
  }

  function handName(s) {
    if (s>=8e8) return 'Straight Flush';
    if (s>=7e8) return 'Four of a Kind';
    if (s>=6e8) return 'Full House';
    if (s>=5e8) return 'Flush';
    if (s>=4e8) return 'Straight';
    if (s>=3e8) return 'Three of a Kind';
    if (s>=2e8) return 'Two Pair';
    if (s>=1e8) return 'One Pair';
    return 'High Card';
  }

  // ============================================================
  // MONTE CARLO
  // ============================================================
  function buildDeck(exclude) {
    const ex = new Set(exclude.map(cardId));
    const d = [];
    for (let v=2;v<=14;v++) for (const s of ['h','d','c','s']) {
      const c={val:v,suit:s};
      if (!ex.has(cardId(c))) d.push(c);
    }
    return d;
  }

  function pShuffle(arr, n) {
    for (let i=0;i<n;i++) {
      const j = i + (Math.random()*(arr.length-i)|0);
      const t=arr[i]; arr[i]=arr[j]; arr[j]=t;
    }
  }

  // Full runout simulation (current equity)
  function simulate(hole, community, opponents, iters) {
    iters = iters || 8000;
    const deck = buildDeck([...hole,...community]);
    const need = 5 - community.length;
    const perDeal = need + opponents*2;
    if (deck.length < perDeal) return null;

    let wins=0, ties=0;
    const hc = {
      'High Card':0,'One Pair':0,'Two Pair':0,'Three of a Kind':0,
      'Straight':0,'Flush':0,'Full House':0,'Four of a Kind':0,'Straight Flush':0
    };

    for (let i=0;i<iters;i++) {
      pShuffle(deck, perDeal);
      const board = [...community, ...deck.slice(0, need)];
      const myCards = [...hole, ...board];
      const myScore = myCards.length===7 ? evaluate7(myCards) : evalBest(myCards);
      hc[handName(myScore)]++;

      let iWin=true, iTie=false;
      for (let o=0;o<opponents;o++) {
        const opp=[deck[need+o*2], deck[need+o*2+1]];
        const os=[...opp,...board];
        const oppScore = os.length===7 ? evaluate7(os) : evalBest(os);
        if (oppScore > myScore) { iWin=false; iTie=false; break; }
        if (oppScore === myScore) { iWin=false; iTie=true; }
      }
      if (iWin) wins++;
      else if (iTie) ties++;
    }
    return {
      win:  wins/iters*100,
      tie:  ties/iters*100,
      lose: (iters-wins-ties)/iters*100,
      hands: Object.fromEntries(Object.entries(hc).map(([k,v])=>[k,v/iters*100]))
    };
  }

  // Next-street simulation: deal exactly 1 more card and evaluate equity there
  // Only meaningful on the flop (3 community cards) — shows turn equity if you call
  function simulateNextStreet(hole, community, opponents, iters) {
    if (community.length !== 3) return null;
    iters = iters || 6000;
    const deck = buildDeck([...hole, ...community]);
    const perDeal = 1 + opponents * 2; // 1 turn card + opponent hole cards
    if (deck.length < perDeal) return null;

    let wins = 0, ties = 0;
    for (let i = 0; i < iters; i++) {
      pShuffle(deck, perDeal);
      // Only the turn card — no river
      const board = [...community, deck[0]];
      const myCards = [...hole, ...board];
      const myScore = evalBest(myCards);

      let iWin = true, iTie = false;
      for (let o = 0; o < opponents; o++) {
        const opp = [deck[1 + o*2], deck[2 + o*2]];
        const os = [...opp, ...board];
        const oppScore = evalBest(os);
        if (oppScore > myScore) { iWin = false; iTie = false; break; }
        if (oppScore === myScore) { iWin = false; iTie = true; }
      }
      if (iWin) wins++;
      else if (iTie) ties++;
    }
    return {
      win:  wins / iters * 100,
      tie:  ties / iters * 100,
      lose: (iters - wins - ties) / iters * 100
    };
  }

  // ============================================================
  // CSS — Shadow DOM isolated
  // ============================================================
  const CSS = `
    :host {
      all: initial;
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      z-index: 2147483647 !important;
      display: block !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    #panel {
      width: 100%;
      min-width: 200px;
      background: linear-gradient(150deg, rgba(10,14,23,0.98) 0%, rgba(7,10,18,0.99) 100%);
      border: 1px solid rgba(78,201,163,0.28);
      border-radius: 12px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(78,201,163,0.04);
      overflow: hidden;
      position: relative;
    }

    /* ── Header ── */
    #header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px;
      background: linear-gradient(90deg, rgba(78,201,163,0.1) 0%, transparent 70%);
      border-bottom: 1px solid rgba(78,201,163,0.13);
      cursor: move; user-select: none;
    }
    #title {
      font-weight: 700; font-size: 11px;
      color: #4ec9a3; letter-spacing: 0.13em; text-transform: uppercase;
      display: flex; align-items: center; gap: 8px;
    }
    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4ec9a3;
      box-shadow: 0 0 7px #4ec9a3, 0 0 16px rgba(78,201,163,0.35);
      animation: pulse 2.5s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.75)} }

    /* ── Buttons ── */
    .hbtns { display: flex; gap: 4px; }
    button {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.5);
      width: 24px; height: 24px; border-radius: 6px;
      cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      padding: 0; line-height: 1; font-family: inherit;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    button:hover { background: rgba(78,201,163,0.18); color: #4ec9a3; border-color: rgba(78,201,163,0.4); }
    .adj {
      width: 20px; height: 20px; font-size: 16px;
      color: #4ec9a3; border-color: rgba(78,201,163,0.2);
      background: rgba(78,201,163,0.05);
    }

    /* ── Body ── */
    #body { padding: 11px 12px 13px; }

    .orow {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 9px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 7px; margin-bottom: 12px;
    }
    .olbl { color: rgba(255,255,255,0.3); flex: 1; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; }
    .oval { color: #fff; font-weight: 700; min-width: 18px; text-align: center; font-size: 13px; }

    /* ── Section label ── */
    .slbl {
      font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase;
      color: rgba(255,255,255,0.2); font-weight: 600;
      margin-bottom: 5px; margin-top: 11px;
    }
    .slbl:first-child { margin-top: 0; }

    /* ── Cards ── */
    .card {
      display: inline-flex; align-items: center; justify-content: center;
      background: #fff; border-radius: 5px;
      padding: 2px 5px; font-weight: 800; font-size: 13px;
      height: 26px; min-width: 28px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.55);
      letter-spacing: -0.01em; line-height: 1;
    }
    .card.h, .card.d { color: #dc2626; }
    .card.s, .card.c { color: #0d1117; }
    .hole-row { display: flex; gap: 3px; }

    /* ── Board streets ── */
    .board-streets {
      display: flex; gap: 8px; flex-wrap: wrap;
      align-items: flex-end;
    }
    .street-group { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .street-lbl {
      font-size: 7.5px; letter-spacing: 0.1em; text-transform: uppercase;
      color: rgba(255,255,255,0.2); font-weight: 700;
    }
    .street-cards { display: flex; gap: 3px; }
    .no-board { color: rgba(255,255,255,0.2); font-size: 10px; font-style: italic; padding: 3px 0; }

    /* ── Divider ── */
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 10px 0; }

    /* ── Win / Tie / Lose boxes ── */
    .winrow {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      gap: 5px; margin-bottom: 9px;
    }
    .wbox {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 8px 4px; text-align: center;
    }
    .wbox.w { border-color: rgba(78,201,163,0.4); background: rgba(78,201,163,0.08); }
    .wbox.l { border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.07); }
    .wbox.t { border-color: rgba(251,191,36,0.3);  background: rgba(251,191,36,0.06); }
    .wlbl { font-size: 7.5px; color: rgba(255,255,255,0.27); letter-spacing: 0.13em; margin-bottom: 4px; font-weight: 700; }
    .wpct { font-size: 16px; font-weight: 800; line-height: 1; }
    .wbox.w .wpct { color: #4ec9a3; }
    .wbox.l .wpct { color: #f87171; }
    .wbox.t .wpct { color: #fbbf24; }

    /* ── Win probability bar ── */
    .wbar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .wbar-track {
      flex: 1; height: 5px;
      background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden;
    }
    .wbar-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #2a9d78 0%, #4ec9a3 100%);
      transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
    }
    .wbar-pct { font-size: 11px; font-weight: 700; color: #4ec9a3; min-width: 38px; text-align: right; }

    /* ── Next street callout ── */
    .ns-box {
      background: rgba(78,201,163,0.055);
      border: 1px solid rgba(78,201,163,0.2);
      border-radius: 9px; padding: 8px 11px; margin-bottom: 10px;
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
    }
    .ns-left { flex: 1; }
    .ns-tag {
      font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em;
      color: rgba(78,201,163,0.65); text-transform: uppercase; margin-bottom: 2px;
    }
    .ns-label { font-size: 10px; color: rgba(255,255,255,0.42); }
    .ns-right { text-align: right; }
    .ns-win { font-size: 19px; font-weight: 800; color: #4ec9a3; line-height: 1; }
    .ns-sub { font-size: 8.5px; color: rgba(255,255,255,0.22); margin-top: 2px; }

    /* ── Hand distribution grid ── */
    .hgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 10px; }
    .hrow {
      display: flex; justify-content: space-between;
      padding: 2.5px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .hrow:last-child { border-bottom: none; }
    .hn { font-size: 9.5px; color: rgba(255,255,255,0.32); }
    .hv { font-size: 9.5px; font-weight: 600; color: rgba(255,255,255,0.55); }
    .hv.hi { color: #4ec9a3; }

    /* ── Status / loading ── */
    .status {
      text-align: center; padding: 22px 0;
      color: rgba(255,255,255,0.28); font-size: 10px; line-height: 1.9;
    }
    .status.err { color: #f87171; }
    .spin {
      display: inline-block; width: 13px; height: 13px;
      border: 2px solid rgba(78,201,163,0.15); border-top-color: #4ec9a3;
      border-radius: 50%; animation: spin 0.7s linear infinite;
      vertical-align: middle; margin-right: 5px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Resize handle ── */
    .resize-h {
      position: absolute; bottom: 0; right: 0;
      width: 20px; height: 20px;
      cursor: se-resize; opacity: 0;
      transition: opacity 0.18s;
    }
    #panel:hover .resize-h { opacity: 1; }
    .resize-h::after {
      content: '';
      position: absolute; bottom: 4px; right: 4px;
      width: 9px; height: 9px;
      border-right: 2px solid rgba(78,201,163,0.55);
      border-bottom: 2px solid rgba(78,201,163,0.55);
      border-radius: 1px;
    }

    .hidden { display: none !important; }
  `;

  // ============================================================
  // STATE
  // ============================================================
  let host, shadowRoot, oppCount = 1, calcTimer = null, busy = false, lastState = '';
  const DEFAULT_W = 255;

  // ============================================================
  // BUILD UI
  // ============================================================
  function buildUI() {
    host = document.createElement('div');
    host.id = '__poker-odds-host__';
    host.style.cssText = `position:fixed;top:16px;right:16px;width:${DEFAULT_W}px;z-index:2147483647;`;

    shadowRoot = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadowRoot.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.innerHTML = `
      <div id="header">
        <div id="title"><span class="dot"></span>Odds Calc</div>
        <div class="hbtns">
          <button id="refresh" title="Recalculate">↻</button>
          <button id="minimize" title="Minimize">−</button>
        </div>
      </div>
      <div id="body">
        <div class="orow">
          <span class="olbl">Opponents</span>
          <button class="adj" id="dec">−</button>
          <span class="oval" id="oppnum">1</span>
          <button class="adj" id="inc">+</button>
        </div>
        <div id="content"><div class="status">Waiting for cards…</div></div>
      </div>
      <div class="resize-h" id="resize-h"></div>
    `;
    shadowRoot.appendChild(panel);

    const target = document.body || document.documentElement;
    target.appendChild(host);

    // ── Drag ──────────────────────────────────────────────────
    let dragging = false, ox = 0, oy = 0;
    shadowRoot.getElementById('header').addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      ox = e.clientX - host.offsetLeft;
      oy = e.clientY - host.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (dragging) {
        host.style.right = 'auto';
        host.style.left = Math.max(0, e.clientX - ox) + 'px';
        host.style.top  = Math.max(0, e.clientY - oy) + 'px';
      }
      if (resizing) {
        const nw = Math.max(200, Math.min(500, rsw + (e.clientX - rsx)));
        host.style.width = nw + 'px';
      }
    });
    document.addEventListener('mouseup', () => { dragging = false; resizing = false; });

    // ── Resize ────────────────────────────────────────────────
    let resizing = false, rsx = 0, rsw = 0;
    shadowRoot.getElementById('resize-h').addEventListener('mousedown', e => {
      resizing = true;
      rsx = e.clientX;
      rsw = host.offsetWidth;
      e.preventDefault();
      e.stopPropagation();
    });

    // ── Minimize ──────────────────────────────────────────────
    shadowRoot.getElementById('minimize').addEventListener('click', () => {
      const body = shadowRoot.getElementById('body');
      const btn  = shadowRoot.getElementById('minimize');
      body.classList.toggle('hidden');
      btn.textContent = body.classList.contains('hidden') ? '+' : '−';
    });

    // ── Refresh ───────────────────────────────────────────────
    shadowRoot.getElementById('refresh').addEventListener('click', () => calc(true));

    // ── Opponents ─────────────────────────────────────────────
    shadowRoot.getElementById('dec').addEventListener('click', () => {
      if (oppCount > 1) { oppCount--; shadowRoot.getElementById('oppnum').textContent = oppCount; calc(true); }
    });
    shadowRoot.getElementById('inc').addEventListener('click', () => {
      if (oppCount < 8) { oppCount++; shadowRoot.getElementById('oppnum').textContent = oppCount; calc(true); }
    });
  }

  // ============================================================
  // RENDER
  // ============================================================
  function cardHtml(c) {
    return `<span class="card ${c.suit}">${cardLabel(c)}</span>`;
  }

  function renderBoard(comm) {
    if (comm.length === 0) return '<span class="no-board">Pre-flop</span>';
    let h = '<div class="board-streets">';
    if (comm.length >= 3) {
      h += `<div class="street-group">
              <div class="street-lbl">Flop</div>
              <div class="street-cards">${comm.slice(0,3).map(cardHtml).join('')}</div>
            </div>`;
    }
    if (comm.length >= 4) {
      h += `<div class="street-group">
              <div class="street-lbl">Turn</div>
              <div class="street-cards">${cardHtml(comm[3])}</div>
            </div>`;
    }
    if (comm.length >= 5) {
      h += `<div class="street-group">
              <div class="street-lbl">River</div>
              <div class="street-cards">${cardHtml(comm[4])}</div>
            </div>`;
    }
    return h + '</div>';
  }

  function renderResult(res, nextRes, hole, comm) {
    const HANDS = [
      'Straight Flush','Four of a Kind','Full House','Flush',
      'Straight','Three of a Kind','Two Pair','One Pair','High Card'
    ];

    const handsHtml = HANDS.map(h => {
      const p = res.hands[h] || 0;
      return `<div class="hrow">
        <span class="hn">${h}</span>
        <span class="hv${p > 12 ? ' hi' : ''}">${p.toFixed(1)}%</span>
      </div>`;
    }).join('');

    // Next street panel — only appears on the flop
    const nextStreetHtml = (nextRes && comm.length === 3) ? `
      <div class="ns-box">
        <div class="ns-left">
          <div class="ns-tag">If you call</div>
          <div class="ns-label">Turn equity (1 card)</div>
        </div>
        <div class="ns-right">
          <div class="ns-win">${nextRes.win.toFixed(1)}%</div>
          <div class="ns-sub">tie ${nextRes.tie.toFixed(1)}%</div>
        </div>
      </div>` : '';

    const content = shadowRoot && shadowRoot.getElementById('content');
    if (!content) return;
    content.innerHTML = `
      <div class="slbl">Your Hand</div>
      <div class="hole-row">${hole.map(cardHtml).join('')}</div>

      <div class="slbl">Board</div>
      ${renderBoard(comm)}

      <hr>

      <div class="winrow">
        <div class="wbox w"><div class="wlbl">WIN</div><div class="wpct">${res.win.toFixed(1)}%</div></div>
        <div class="wbox t"><div class="wlbl">TIE</div><div class="wpct">${res.tie.toFixed(1)}%</div></div>
        <div class="wbox l"><div class="wlbl">LOSE</div><div class="wpct">${res.lose.toFixed(1)}%</div></div>
      </div>

      <div class="wbar-row">
        <div class="wbar-track">
          <div class="wbar-fill" style="width:${Math.min(res.win, 100)}%"></div>
        </div>
        <div class="wbar-pct">${res.win.toFixed(1)}%</div>
      </div>

      ${nextStreetHtml}

      <hr>

      <div class="slbl">Hand Distribution</div>
      <div class="hgrid">${handsHtml}</div>
    `;
  }

  // ============================================================
  // CALCULATION
  // ============================================================
  function setContent(html) {
    const c = shadowRoot && shadowRoot.getElementById('content');
    if (c) c.innerHTML = html;
  }

  function calc(force) {
    if (busy && !force) return;
    clearTimeout(calcTimer);
    calcTimer = setTimeout(_calc, force ? 0 : 600);
  }

  function _calc() {
    const { hole, community } = readCards();
    if (hole.length < 2) {
      setContent('<div class="status">No hole cards found.<br>Make sure you\'re in a hand.</div>');
      return;
    }
    setContent('<div class="status"><span class="spin"></span>Calculating…</div>');
    busy = true;

    setTimeout(() => {
      try {
        const res = simulate(hole, community, oppCount, 9000);
        if (!res) {
          setContent('<div class="status err">Not enough cards in deck.<br>Reduce opponent count.</div>');
        } else {
          // Next-street simulation (flop only; returns null otherwise)
          const nextRes = simulateNextStreet(hole, community, oppCount, 6000);
          renderResult(res, nextRes, hole, community);
        }
      } catch (e) {
        setContent(`<div class="status err">Error: ${e.message}</div>`);
      }
      busy = false;
    }, 20);
  }

  // ============================================================
  // WATCH FOR CARD CHANGES
  // ============================================================
  function stateKey() {
    const { hole, community } = readCards();
    return JSON.stringify({ h: hole, c: community });
  }

  function watchCards() {
    const state = stateKey();
    if (state !== lastState) {
      lastState = state;
      calc(false);
    }
    setTimeout(watchCards, 1200);
  }

  // ============================================================
  // INIT
  // ============================================================
  function tryInit() {
    if (!document.body && !document.documentElement) { setTimeout(tryInit, 300); return; }
    buildUI();
    watchCards();
    setTimeout(() => calc(true), 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

})();
