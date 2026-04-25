# HDD Sudoku Script

A domain-specific automation kit for the `https://sub.hdd.sb/` Sudoku game.

This repository packages two reusable assets:
- a Tampermonkey userscript solver for `/sudoku-api`
- a Hermes skill for agents that need to operate, debug, or retrieve the Sudoku solver workflow

The design principle is constraint-first and backend-aware: recover the current puzzle from API state, solve locally with constraint propagation and backtracking, then submit fills through the backend with rate-limit-aware delays.

## Why this repo exists
Generic agents often fail on Sudoku automation because they:
- try to read the rendered grid instead of the backend puzzle payload
- skip active-session recovery and hit conflict responses
- fill values without respecting backend intervals
- rebuild a solver instead of using a compact known-good implementation

This repo packages the proven userscript and a retrieval-friendly skill so agents can use it one-shot.

## Features
- automatic active-session takeover through `/me`
- backend-driven operation through relative API path `/sudoku-api`
- support for current UI difficulty values:
  - `easy`
  - `normal`
  - `hard`
  - `expert`
- local Sudoku solver using constraint propagation, hidden singles, MRV, and backtracking
- preview mode that solves and abandons the preview session
- one-click fill and step-by-step fill modes
- draggable on-page control panel with board view, delay control, jitter, logs, and stop control
- publish-safe packaging for agent retrieval and reuse

## Repository layout
- `scripts/sudoku-solver.user.js` - Tampermonkey userscript
- `skills/sub-hdd-sb-sudoku-solver/SKILL.md` - reusable Hermes skill
- `docs/plan.md` - publication plan
- `README.zh-CN.md` - Simplified Chinese README
- `LICENSE` - MIT license

## Quick start
### Userscript
1. Install Tampermonkey.
2. Open `scripts/sudoku-solver.user.js`.
3. Create a new userscript and paste the file contents.
4. Visit `https://sub.hdd.sb/` and open the Sudoku game.
5. Use the in-page controls:
   - `求解预览`
   - `一键填写`
   - `逐步填写`
   - `停止`

### Hermes / agent usage
Copy `skills/sub-hdd-sb-sudoku-solver/` into your Hermes skill tree, or absorb the routing vocabulary into your own agent system.

Suggested routing keywords:
- `sub.hdd.sb`
- `sudoku`
- `sudoku-api`
- `sudoku solver`
- `tampermonkey sudoku`
- `constraint propagation`
- `backtracking`
- `MRV`
- `hidden singles`
- `数独`
- `数独求解器`
- `一键填写`
- `逐步填写`

## Operational model
1. Detect the Sudoku page by title, body text, or path.
2. Read `/config` to learn the current minimum fill interval.
3. Read `/me` and prefer unfinished `active_session` when it contains puzzle data.
4. Normalize `givens`, `puzzle`, `initial_board`, or `board` into an 81-cell flat board.
5. Solve locally using candidate elimination, hidden singles, MRV, and recursive search.
6. Submit non-given cells through `/fill` with `session_id`, `row`, `col`, and `value`.
7. Keep board preview, user progress, logs, and status synchronized with API responses.

## Security model
This public repository intentionally excludes:
- actual auth tokens
- cookies or browser storage exports
- localhost headers or MCP secrets
- machine-specific private config
- GitHub tokens
- private account dumps

The script may read `localStorage.getItem('auth_token')` at runtime to call the site API, but no token value is embedded in this repository.

## Validation targets
- preview mode should solve the puzzle and abandon the preview session.
- one-click fill should submit all non-given cells until `won`.
- step-by-step fill should visibly update progress.
- delay controls should respect `/config` `min_interval_ms`.
- repository scans should find no real token, cookie, private path, or local config dump.

## License
MIT
