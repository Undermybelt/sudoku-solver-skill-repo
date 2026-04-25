# HDD Sudoku Script

面向 `https://sub.hdd.sb/` 数独游戏的特化自动化仓。

此仓打包两类可复用资产：
- 面向 `/sudoku-api` 的 Tampermonkey 自动求解脚本
- 供 Hermes / agent 检索、调用和调试的 Sudoku skill

核心原则：约束求解优先、后端状态优先。先从 API 状态恢复当前题面，本地使用约束传播与回溯求解，再按站点节流通过后端提交填写。

## 此仓为何存在
通用 agent 处理数独自动化时常败于：
- 试图从页面渲染读格子，而非读取后端 puzzle payload
- 不接管未完成局，导致 conflict 响应
- 不尊重后端最小填写间隔
- 重写求解器，而不是复用已验证脚本

此仓固化已验证脚本，并附可检索 skill，方便 agent one shot 命中。

## 功能
- 通过 `/me` 自动接管未完成局
- 使用相对 API 路径 `/sudoku-api`
- 覆盖当前 UI 难度：
  - `easy`
  - `normal`
  - `hard`
  - `expert`
- 本地数独求解器：约束传播、hidden singles、MRV、回溯
- 预览模式：求解后放弃预览 session
- 一键填写与逐步填写两种模式
- 页面内可拖拽控制面板，含棋盘、延迟、随机 jitter、日志、停止控件
- 公开仓默认可安全给 agent 检索复用

## 仓库结构
- `scripts/sudoku-solver.user.js` - Tampermonkey 脚本
- `skills/sub-hdd-sb-sudoku-solver/SKILL.md` - 可复用 Hermes skill
- `docs/plan.md` - 发布计划
- `README.md` - 英文主 README
- `LICENSE` - MIT 许可证

## 快速开始
### 安装脚本
1. 安装 Tampermonkey。
2. 打开 `scripts/sudoku-solver.user.js`。
3. 新建 userscript，粘贴脚本内容。
4. 访问 `https://sub.hdd.sb/` 并进入数独页面。
5. 使用页面控件：
   - `求解预览`
   - `一键填写`
   - `逐步填写`
   - `停止`

### 给 Hermes / agent 使用
可将 `skills/sub-hdd-sb-sudoku-solver/` 复制进 Hermes skill 目录，或吸收到自有 agent 路由层。

建议关键词：
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

## 运行模型
1. 按标题、正文或路径识别数独页面。
2. 先读 `/config` 获取最小填写间隔。
3. 再读 `/me`，优先接管含题面的未完成 `active_session`。
4. 将 `givens`、`puzzle`、`initial_board` 或 `board` 归一化为 81 格一维棋盘。
5. 用候选消除、hidden singles、MRV 与递归搜索本地求解。
6. 通过 `/fill` 提交 `session_id`、`row`、`col`、`value`。
7. 持续同步棋盘预览、用户进度、日志与 API 响应。

## 安全模型
此公开仓默认不含：
- 真实 auth token
- cookie 或浏览器存储导出
- localhost 鉴权头或 MCP 密钥
- 本机私有配置
- GitHub token
- 私有账号数据导出

脚本可在运行时读取 `localStorage.getItem('auth_token')` 以调用站点 API，但仓内不包含任何 token 真值。

## 验证目标
- 预览模式应能求解题面并放弃预览 session。
- 一键填写应提交所有非题面格，直到 `won`。
- 逐步填写应可见更新进度。
- 延迟控件应尊重 `/config` 的 `min_interval_ms`。
- 仓库扫描不应发现真实 token、cookie、本机路径或私有配置导出。

## License
MIT
