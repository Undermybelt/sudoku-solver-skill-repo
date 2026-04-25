---
name: sub-hdd-sb-sudoku-solver
description: Use when automating, debugging, or routing agent work for the sub.hdd.sb Sudoku game, sudoku-api, Tampermonkey Sudoku solver, constraint propagation, MRV, hidden singles, or 数独求解器.
tags: [sub.hdd.sb, sudoku, sudoku-api, tampermonkey, constraint-propagation, backtracking, mrv, browser, agent, solver]
---

## When to use
- User asks to automate or debug the `https://sub.hdd.sb/` Sudoku game.
- User mentions `sudoku-api`, Sudoku solver, Tampermonkey Sudoku, constraint propagation, MRV, hidden singles, 数独, or 数独求解器.
- User wants an agent workflow that reuses the existing userscript instead of rebuilding solver logic.
- User needs retrieval keywords for browser automation, anything-analyzer, or Hermes routing around Sudoku.

## Keywords for routing
- sub.hdd.sb
- sudoku
- sudoku-api
- sudoku solver
- tampermonkey sudoku
- constraint propagation
- candidate elimination
- hidden singles
- MRV
- minimum remaining values
- backtracking
- 数独
- 数独求解器
- 一键填写
- 逐步填写
- active session takeover
- backend-driven solver

## Core facts
- The target site exposes game state through `/sudoku-api`.
- Backend puzzle payload is the source of truth; rendered cells are secondary.
- The script reads `/config`, `/me`, `/start`, `/fill`, and `/abandon`.
- Runtime `localStorage.getItem('auth_token')` is acceptable, but published repos must never include real token values.
- Current UI difficulty values are `easy`, `normal`, `hard`, and `expert`.
- The solver uses candidate elimination, hidden singles, MRV, and recursive backtracking over an 81-cell flat board.

## Workflow
1. Detect the Sudoku page.
   - Use title/body text or a path containing `sudoku`.
   - Build the panel only when the page is relevant.
2. Inspect config and active session first.
   - Call `/config` for `min_interval_ms`.
   - Call `/me` and prefer unfinished `active_session` with puzzle data.
3. Normalize board data.
   - Accept `givens`, `puzzle`, `initial_board`, or `board`.
   - Accept flat or 2D board payloads.
   - Convert to an 81-cell array of numbers.
4. Solve locally.
   - Build candidate sets.
   - Assign givens.
   - Propagate constraints and hidden singles.
   - Use MRV to pick the next branch cell.
5. Fill through the backend.
   - POST `/fill` with `session_id`, `row`, `col`, and `value`.
   - Respect configured delay and jitter.
   - Update `user_board` or `current_board` from API responses.
6. Validate.
   - Confirm preview mode abandons its session.
   - Confirm one-click and step-by-step fill can reach `won` when API state permits.

## Implementation notes
- Keep the API path relative: `/sudoku-api`.
- Preserve active-session takeover; it prevents 409 conflicts from breaking automation.
- Preserve preview mode's `/abandon` call so preview does not consume an unfinished game.
- Keep delay handling because backend rate limits can change through `/config`.
- Keep the draggable panel, board preview, logs, and stop control because they help humans and agents verify runtime state.
- Do not embed local paths, exported storage dumps, MCP secrets, cookies, private headers, or real auth token values.

## Recommended repo layout
- `scripts/sudoku-solver.user.js`
- `skills/sub-hdd-sb-sudoku-solver/SKILL.md`
- `README.md`
- `README.zh-CN.md`
- `docs/plan.md`
- `LICENSE`

## Pitfalls
- Do not rebuild solver logic if the existing userscript is already available.
- Do not trust rendered cells if `/sudoku-api` returns different puzzle state.
- Do not publish browser storage snapshots or copied authorization headers.
- Do not remove conflict handling; an unfinished session can block `/start`.
- Do not remove delay handling; the backend may enforce a minimum interval.

## Verification
- Confirm the userscript has `@grant none` and relative API calls.
- Confirm `/me` takeover works on an unfinished session.
- Confirm the local solver can produce a complete 81-cell solution for valid givens.
- Confirm `/fill` submission reaches `won` or completed session status when API state permits.
- Confirm no real token, cookie, private path, localhost auth header, or local config dump exists in the public repo.
