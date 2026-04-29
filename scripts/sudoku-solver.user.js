// ==UserScript==
// @name         数独自动求解器
// @namespace    https://sub.hdd.sb/
// @version      1.0.0
// @description  数独 AI — 约束传播 + 回溯求解
// @match        https://sub.hdd.sb/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) {
    return;
  }

  const API = '/sudoku-api';
  const PAGE_POLL_MS = 800;
  const PREFIX = '[sudoku-solver]';

  // ─── Utilities ───
  const $ = (id) => document.getElementById(id);
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function getToken() {
    try { return localStorage.getItem('auth_token') || ''; } catch { return ''; }
  }

  async function api(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(API + path, opts);
    if (!res.ok) {
      throw new Error(`API ${path} → ${res.status}`);
    }
    return res.json();
  }

  // ─── Sudoku Solver (Constraint Propagation + Backtracking) ───
  const SudokuSolver = (() => {
    const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ALL = new Set(DIGITS);

    function peers(row, col) {
      const p = new Set();
      for (let i = 0; i < 9; i++) {
        if (i !== col) {
          p.add(row * 9 + i);
        }
        if (i !== row) {
          p.add(i * 9 + col);
        }
      }
      const br = Math.floor(row / 3) * 3;
      const bc = Math.floor(col / 3) * 3;
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (r !== row || c !== col) {
            p.add(r * 9 + c);
          }
        }
      }
      return [...p];
    }

    // Pre-compute peer lists
    const PEERS = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        PEERS.push(peers(r, c));
      }
    }

    function solve(flat) {
      // Build candidate sets
      const cands = Array.from({ length: 81 }, () => new Set(ALL));
      // Assign givens
      for (let i = 0; i < 81; i++) {
        if (flat[i] !== 0) {
          if (!assign(cands, i, flat[i])) return null;
        }
      }
      return search(cands);
    }

    function assign(cands, idx, val) {
      const other = [...cands[idx]].filter((v) => v !== val);
      for (const v of other) {
        if (!eliminate(cands, idx, v)) return false;
      }
      return true;
    }

    function eliminate(cands, idx, val) {
      if (!cands[idx].has(val)) return true;
      cands[idx].delete(val);
      if (cands[idx].size === 0) {
        return false;
      }
      if (cands[idx].size === 1) {
        const v = [...cands[idx]][0];
        for (const p of PEERS[idx]) {
          if (!eliminate(cands, p, v)) return false;
        }
      }
      // Hidden singles in peers' units
      // Check if val can only go in one place within each unit containing idx
      const row = Math.floor(idx / 9);
      const col = idx % 9;
      const unitPeers = PEERS[idx];
      // For each peer group (row, col, box), check hidden singles
      for (const groups of getGroups(row, col)) {
        const places = groups.filter((i) => cands[i].has(val));
        if (places.length === 0) {
          return false;
        }
        if (places.length === 1) {
          if (!assign(cands, places[0], val)) return false;
        }
      }
      return true;
    }

    function getGroups(row, col) {
      const groups = [];
      // Row
      const rg = [];
      for (let c = 0; c < 9; c++) {
        rg.push(row * 9 + c);
      }
      groups.push(rg);
      // Col
      const cg = [];
      for (let r = 0; r < 9; r++) {
        cg.push(r * 9 + col);
      }
      groups.push(cg);
      // Box
      const br = Math.floor(row / 3) * 3;
      const bc = Math.floor(col / 3) * 3;
      const bg = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          bg.push(r * 9 + c);
        }
      }
      groups.push(bg);
      return groups;
    }

    function search(cands) {
      // Check if solved
      let solved = true;
      for (let i = 0; i < 81; i++) {
        if (cands[i].size !== 1) { solved = false; break; }
      }
      if (solved) {
        return cands.map((s) => [...s][0]);
      }

      // MRV: pick cell with fewest candidates > 1
      let minSize = 10, minIdx = -1;
      for (let i = 0; i < 81; i++) {
        if (cands[i].size > 1 && cands[i].size < minSize) {
          minSize = cands[i].size;
          minIdx = i;
          if (minSize === 2) {
            break;
          }
        }
      }
      if (minIdx === -1) {
        return null;
      }

      for (const val of cands[minIdx]) {
        const copy = cands.map((s) => new Set(s));
        if (assign(copy, minIdx, val)) {
          const result = search(copy);
          if (result) {
            return result;
          }
        }
      }
      return null;
    }

    return { solve };
  })();

  // ─── State ───
  const ui = {
    running: false,
    sessionId: null,
    difficulty: 'easy',
    givens: null,
    userBoard: null,
    solution: null,
  };
  let gameConfig = null;

  // ─── Logging ───
  function log(msg, color) {
    const el = $('sd-log');
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    if (color) {
      line.style.color = color;
    }
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
    console.log(PREFIX, msg);
  }

  function setStatus(text, color) {
    const el = $('sd-status');
    el.textContent = text;
    el.style.color = color || '#e7ecf7';
  }

  // ─── Board Visualization ───
  function renderBoard(givens, solution) {
    const el = $('sd-board');
    el.innerHTML = '';
    if (!givens) {
      return;
    }
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        const cell = document.createElement('span');
        cell.className = 'sd-cell';
        const v = solution ? solution[i] : givens[i];
        cell.textContent = v || '';
        if (givens[i] !== 0) {
          cell.classList.add('sd-given');
        }
        if (r % 3 === 0 && r > 0) {
          cell.style.borderTop = '2px solid #4a5a8a';
        }
        if (c % 3 === 0 && c > 0) {
          cell.style.borderLeft = '2px solid #4a5a8a';
        }
        el.appendChild(cell);
      }
    }
  }

  function normalizeBoard(board) {
    if (!Array.isArray(board)) return null;
    const flat = Array.isArray(board[0]) ? board.flat() : board.slice();
    return flat.length === 81 ? flat.map((value) => Number(value) || 0) : null;
  }

  function getFillDelayMs(fallback = 50) {
    const configured = parseInt($('sd-delay').value, 10);
    const base = Number.isFinite(configured) ? configured : fallback;
    const jitter = $('sd-jitter').checked ? Math.floor(Math.random() * 40) : 0;
    const minInterval = Number(gameConfig?.min_interval_ms || 0);
    return Math.max(base + jitter, minInterval, 30);
  }

  function inferDifficultyFromSession(session) {
    return session?.difficulty || session?.level || session?.mode || ui.difficulty || $('sd-diff').value;
  }

  function applySession(session, source) {
    const givens = normalizeBoard(session.givens || session.puzzle || session.initial_board || session.board);
    if (!givens) {
      return false;
    }
    ui.difficulty = inferDifficultyFromSession(session);
    if ($('sd-diff')) {
      $('sd-diff').value = ui.difficulty;
    }
    ui.sessionId = session.session_id;
    ui.givens = givens;
    ui.userBoard = normalizeBoard(session.user_board || session.current_board || session.progress_board) || givens.slice();
    ui.solution = null;
    renderBoard(ui.givens, ui.userBoard);
    log(`${source} (session=${session.session_id})`, '#6cf');
    return true;
  }

  function getRemainingPlays(me, difficulty) {
    const value = me?.daily_plays_remaining;
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      return value[difficulty] ?? value.remaining ?? JSON.stringify(value);
    }
    return '?';
  }

  function logAccountInfo(me, difficulty) {
    const balance = me?.user?.balance ?? me?.balance ?? '?';
    const remaining = getRemainingPlays(me, difficulty);
    log(`余额: ${balance} | 难度: ${difficulty || '未知'} | 剩余: ${remaining}`, '#999');
  }

  function hasNoRemainingPlays(me, difficulty) {
    const remaining = getRemainingPlays(me, difficulty);
    return typeof remaining === 'number' ? remaining <= 0 : /^\d+$/.test(String(remaining)) && Number(remaining) <= 0;
  }

  async function startGame(options = {}) {
    const diff = $('sd-diff').value;
    ui.difficulty = diff;
    let account = null;

    try {
      account = await api('GET', '/me');
      logAccountInfo(account, diff);
    } catch (e) {
      log(`读取账号信息失败: ${e.message}`, '#fa6');
    }

    if (options.resume !== false) {
      try {
        const active = account?.active_session;
        if (active && !active.game_over && !active.won && applySession(active, '继续未完局')) {
          showToast('已接管未完成数独', 'warn');
          return active;
        }
      } catch (e) {
        log(`读取未完局失败: ${e.message}`, '#fa6');
      }
    }

    if (account && hasNoRemainingPlays(account, diff)) {
      log(`当前难度 ${diff} 今日次数已用完`, '#fa6');
      setStatus('次数用完', '#fa6');
      showToast('今日次数已用完', 'warn');
      return null;
    }

    try {
      const startRes = await api('POST', '/start', { difficulty: diff });
      applySession(startRes, `已开始 (难度=${diff})`);
      showToast('数独已开始', 'info');
      return startRes;
    } catch (e) {
      if (String(e.message || '').includes('409') && options.adoptConflict !== false) {
        const me = await api('GET', '/me');
        const active = me?.active_session;
        if (active && applySession(active, '已接管冲突牌局')) {
          showToast('已接管未完成数独', 'warn');
          return active;
        }
      }
      if (String(e.message || '').includes('409')) {
        log('存在未完成数独，预览模式不会接管或放弃旧局', '#fa6');
        showToast('已有未完成数独', 'warn');
        return null;
      }
      throw e;
    }
  }

  // ─── Auto-play ───
  async function autoPlay() {
    if (ui.running) {
      return;
    }
    ui.running = true;

    try {
      setStatus('开始游戏…', '#6cf');
      if (!await startGame()) {
        ui.running = false;
        return;
      }
      renderBoard(ui.givens, null);

      // Solve locally
      setStatus('求解中…', '#fc6');
      const t0 = performance.now();
      const solution = SudokuSolver.solve(ui.givens);
      const elapsed = (performance.now() - t0).toFixed(1);
      if (!solution) {
        log('求解失败！棋盘无效。', '#f66');
        setStatus('求解失败', '#f66');
        ui.running = false;
        return;
      }
      ui.solution = solution;
      log(`求解完成 (${elapsed}ms)`, '#6f6');
      renderBoard(ui.givens, solution);

      // Fill cells one by one
      let filled = 0;
      for (let i = 0; i < 81; i++) {
        if (!ui.running) { log('用户中止', '#fa6'); break; }
        if (ui.givens[i] !== 0) {
          continue;
        }
        if (ui.userBoard?.[i]) {
          continue;
        }

        const row = Math.floor(i / 9);
        const col = i % 9;
        const val = solution[i];

        const res = await api('POST', '/fill', {
          session_id: ui.sessionId,
          row,
          col,
          value: val,
        });
        filled++;
        ui.userBoard = normalizeBoard(res.user_board || res.current_board) || ui.userBoard || ui.givens.slice();
        ui.userBoard[i] = val;
        renderBoard(ui.givens, ui.userBoard);

        if (res.conflicts && res.conflicts.length > 0) {
          log(`冲突 @ (${row},${col}): ${JSON.stringify(res.conflicts)}`, '#f66');
        }

        if (res.won) {
          log(`🎉 已完成！填入 ${filled} 格，奖励: ${res.session?.reward_amount ?? '?'}`, '#6f6');
          setStatus('完成！🎉', '#6f6');
          ui.running = false;
          showToast('🎉 数独完成', 'success');
          return;
        }

        // Respect rate limit
        await sleep(getFillDelayMs(50));
      }

      setStatus(ui.running ? '完成' : '已中止', ui.running ? '#6f6' : '#fa6');
      if (ui.running) {
        showToast('数独填写完成', 'success');
      }
    } catch (e) {
      log(`错误: ${e.message}`, '#f66');
      setStatus('出错', '#f66');
      showToast('数独自动填写失败', 'error');
    }
    ui.running = false;
  }

  function stopPlay() {
    ui.running = false;
    log('已请求停止', '#fa6');
  }

  async function solveOnly() {
    try {
      if (!await startGame({ resume: false, adoptConflict: false })) return;
      renderBoard(ui.givens, null);

      const t0 = performance.now();
      const solution = SudokuSolver.solve(ui.givens);
      const elapsed = (performance.now() - t0).toFixed(1);
      if (!solution) {
        log('求解失败', '#f66');
        return;
      }
      ui.solution = solution;
      renderBoard(ui.givens, solution);
      log(`求解完成 (${elapsed}ms) — 点击一键填写提交`, '#6f6');

      // Abandon this session since we only wanted to preview
      await api('POST', '/abandon', { session_id: ui.sessionId });
      log('预览会话已丢弃', '#999');
      showToast('数独预览完成', 'info');
      ui.userBoard = null;
    } catch (e) {
      log(`错误: ${e.message}`, '#f66');
      showToast('数独求解失败', 'error');
    }
  }

  async function fillOneByOne() {
    // Same as autoPlay but with visible step-by-step
    if (!ui.solution) {
      log('请先点击"求解"预览', '#fa6');
      return;
    }
    if (ui.running) {
      return;
    }
    ui.running = true;

    try {
      // Start a fresh game
      setStatus('开始新游戏…', '#6cf');
      if (!await startGame()) {
        ui.running = false;
        return;
      }

      // Re-solve in case givens differ
      const sol = SudokuSolver.solve(ui.givens);
      if (!sol) { log('求解失败', '#f66'); ui.running = false; return; }
      ui.solution = sol;
      if (!ui.userBoard) {
        ui.userBoard = ui.givens.slice();
      }

      log(`逐步填写中 (delay=${getFillDelayMs(100)}ms)…`, '#fc6');
      let filled = 0;
      for (let i = 0; i < 81; i++) {
        if (!ui.running) {
          break;
        }
        if (ui.givens[i] !== 0) {
          continue;
        }
        if (ui.userBoard?.[i]) {
          continue;
        }

        const row = Math.floor(i / 9);
        const col = i % 9;
        const val = ui.solution[i];

        const res = await api('POST', '/fill', {
          session_id: ui.sessionId,
          row, col, value: val,
        });
        filled++;
        ui.userBoard = normalizeBoard(res.user_board || res.current_board) || ui.userBoard || ui.givens.slice();
        ui.userBoard[i] = val;

        // Update board to show progress
        renderBoard(ui.givens, ui.userBoard);

        if (res.won) {
          log(`🎉 完成！奖励: ${res.session?.reward_amount ?? '?'}`, '#6f6');
          setStatus('完成！🎉', '#6f6');
          ui.running = false;
          showToast('🎉 数独完成', 'success');
          return;
        }

        await sleep(getFillDelayMs(100));
      }
      setStatus('完成', '#6f6');
      showToast('数独逐步填写完成', 'success');
    } catch (e) {
      log(`错误: ${e.message}`, '#f66');
      setStatus('出错', '#f66');
      showToast('数独逐步填写失败', 'error');
    }
    ui.running = false;
  }

  async function fetchConfig() {
    try {
      gameConfig = await api('GET', '/config');
      const delayInput = $('sd-delay');
      if (delayInput && gameConfig.min_interval_ms) {
        delayInput.min = String(gameConfig.min_interval_ms);
        if (parseInt(delayInput.value, 10) < gameConfig.min_interval_ms) {
          delayInput.value = String(gameConfig.min_interval_ms);
        }
      }
      log(`配置已加载: min_interval=${gameConfig?.min_interval_ms ?? '?'}`, '#999');
      return true;
    } catch (e) {
      log(`加载配置失败: ${e.message}`, '#fa6');
      return false;
    }
  }

  function isSudokuPage() {
    const text = `${document.title}\n${document.body?.innerText || ''}`;
    return /数独|sudoku/i.test(text) || location.pathname.includes('sudoku');
  }

  function ensurePanelVisible() {
    const panel = $('sd-panel');
    if (!panel) {
      buildUI();
      return;
    }
    panel.style.display = '';
  }

  function bootstrapWhenReady() {
    ensurePanelVisible();
    fetchConfig();
    log('已加载，选难度后点"一键填写"');
  }

  function watchPage() {
    let ready = false;
    const tick = () => {
      const nowReady = isSudokuPage();
      if (nowReady && !ready) {
        ready = true;
        bootstrapWhenReady();
      } else if (!nowReady && ready) {
        ready = false;
      }
    };
    tick();
    setInterval(tick, PAGE_POLL_MS);
  }

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? '#2f7a3a' :
               type === 'error' ? '#7a2f2f' :
               type === 'warn' ? '#7a5a2f' : '#3a4a7a';
    toast.style.cssText = `
      position:fixed;top:20px;left:50%;transform:translateX(-50%);
      z-index:100000;background:${bg};color:#fff;padding:10px 18px;
      border-radius:8px;font-size:14px;font-weight:700;
      box-shadow:0 4px 16px rgba(0,0,0,.4);transition:opacity .35s ease;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 2600);
  }

  // ─── UI ───

  // --- Drag handler ---
  function makeDraggable(panel, handle) {
    let dx=0, dy=0, ox=0, oy=0, dragging=false;
    handle.addEventListener('mousedown', e => {
      if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
      dragging=true; dx=e.clientX; dy=e.clientY;
      const r=panel.getBoundingClientRect();
      ox=r.left; oy=r.top;
      panel.style.bottom='auto'; panel.style.right='auto'; panel.style.top='auto'; panel.style.left='auto';
      panel.style.position='fixed'; panel.style.left=ox+'px'; panel.style.top=oy+'px';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if(!dragging) return;
      panel.style.left=(ox+e.clientX-dx)+'px';
      panel.style.top=(oy+e.clientY-dy)+'px';
    });
    document.addEventListener('mouseup', ()=>{ dragging=false; });
  }
  function buildUI() {
    const existingPanel = $('sd-panel');
    if (existingPanel) {
      return existingPanel;
    }

    let style = document.getElementById('sd-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'sd-style';
      style.textContent = `
      #sd-panel { position:fixed; top:16px; left:16px; z-index:99999;
        background:#121727; color:#e7ecf7; border:1px solid #2c3652;
        border-radius:12px; padding:12px 14px; width:300px; font:13px/1.4 system-ui,sans-serif;
        box-shadow:0 4px 24px rgba(0,0,0,.5); }
      #sd-panel h3 { margin:0 0 8px; font-size:14px; }
      #sd-panel button { padding:6px 12px; border:none; border-radius:6px; color:#fff;
        cursor:pointer; font-size:12px; margin:2px; }
      #sd-btn-solve { background:#3a4a7a; }
      #sd-btn-fill { background:#2f7a3a; }
      #sd-btn-step { background:#7a5a2f; }
      #sd-btn-stop { background:#7a2f2f; }
      #sd-panel select, #sd-panel input[type=number] {
        background:#1a2040; color:#e7ecf7; border:1px solid #2c3652;
        border-radius:4px; padding:3px 6px; font-size:12px; }
      #sd-board { display:grid; grid-template-columns:repeat(9,1fr);
        gap:1px; background:#2c3652; border:2px solid #4a5a8a;
        border-radius:4px; margin:8px 0; }
      .sd-cell { width:28px; height:28px; display:flex; align-items:center;
        justify-content:center; font-size:14px; font-weight:600;
        background:#1a2040; color:#e7ecf7; }
      .sd-given { background:#2a3060; color:#8af; }
      #sd-log { background:#0a0e1c; color:#9dc0ff; border-radius:6px;
        padding:6px 8px; max-height:140px; overflow-y:auto; font-size:11px;
        font-family:monospace; margin-top:6px; }
      #sd-log div { margin:1px 0; }
      #sd-opts { display:flex; align-items:center; gap:6px; margin:6px 0; flex-wrap:wrap; }
      #sd-opts label { font-size:11px; }
    `;
      document.head.appendChild(style);
    }

    const panel = document.createElement('div');
    panel.id = 'sd-panel';
    panel.innerHTML = `
      <h3>🔢 数独求解器 <span id="sd-status" style="font-size:12px;float:right"></span></h3>
      <div>
        难度: <select id="sd-diff">
          <option value="easy">easy</option>
          <option value="normal">normal</option>
          <option value="hard">hard</option>
          <option value="expert">expert</option>
        </select>
      </div>
      <div id="sd-opts">
        <label>延迟:<input type="number" id="sd-delay" value="50" min="0" step="10" style="width:50px">ms</label>
        <label><input type="checkbox" id="sd-jitter" checked>随机</label>
      </div>
      <div>
        <button id="sd-btn-solve">求解预览</button>
        <button id="sd-btn-fill">一键填写</button>
        <button id="sd-btn-step">逐步填写</button>
        <button id="sd-btn-stop">停止</button>
      </div>
      <div id="sd-board"></div>
      <div id="sd-log"></div>
    `;
    document.body.appendChild(panel);
    makeDraggable(panel, panel.querySelector('h3'));

    $('sd-btn-solve').addEventListener('click', solveOnly);
    $('sd-btn-fill').addEventListener('click', autoPlay);
    $('sd-btn-step').addEventListener('click', fillOneByOne);
    $('sd-btn-stop').addEventListener('click', stopPlay);
    return panel;
  }

  // ─── Boot ───
  if (window.top === window.self) {
    buildUI();
    watchPage();
  }
  console.log(PREFIX, 'userscript loaded');
})();
