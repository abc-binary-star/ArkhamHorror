# 本地单人自娱部署 —— 优化清单

> 生成日期：2026-09-09
> 适用前提：**localhost 单用户、自己玩**。因此多用户隔离、并发、公网安全、CDN 带宽这一类问题全部降级或忽略；
> 优先级按「我一个人的时候会不会撞上、撞上之后有多难受」重排。
> 仓库：`/Users/xqd_mac/我的/codeing/arkham-horror`（main @ `7ca72b21b3`，工作区有大量未提交改动）

---

## 进度（2026-09-09 晚更新）

**已修完**：§1.1（还原 6 个被跟踪的 homebrew JSON）、§1.2（七个页面的 loading/error 分支）、§1.4（dbCards）、§2.1 的去 Enter 绑定、§2.2（Home + Decks 四态分离）、§2.3（全局 401 拦截器）、§2.4（全部写入类操作）。`npx vue-tsc --noEmit` exit 0，en/zh base.json 键数 159/159 对齐。

新增文件：`frontend/src/components/LoadState.vue`（共用加载/错误/重试组件，接入 8 处）。
新增 i18n 键（en+zh，追加式）：`loadState.{loading,failed,retry,backHome,cardDataFailed,sessionExpired}`、`noDecksYet`、`newDeck.investigatorUnimplemented`。

**⚠️ 新发现的 P0（本文档初版没写到）**：`frontend/homebrew/*/locales/zh/` 两个自制战役的中文译文**大面积损坏**——`"相关角色"` 出现 2017 次，专有名词（Hastur / Aldebaran / Hyades / Cassilda / Demhe）全部塌成同一个词，标点被吞。这些目录**未被 git 跟踪**，无法还原。由于 `homebrew.ts:7` 是 eager glob、`zh.ts:53` 直接展开，中文界面下这就是实际显示内容。
已做**可逆**停用：目录改名为 `zh.broken-20260909`（文件一个没删），中文界面现在回落英文原文。
恢复原状：`for d in frontend/homebrew/*/locales/zh.broken-20260909; do mv "$d" "${d%.broken-20260909}"; done`
正确做法：这批需要重译。汉化归另一个 agent，见下。

**移交另一个 agent（UI + 汉化）**：
- §2.5 全局 `:focus-visible` —— 要动 `src/styles/*`，那是 UI agent 的地盘。修法：在 `@layer` 之外补一条全局规则（`index.css:8` 声明了 layer 顺序，而 Vue scoped 样式不分层、优先级更高，44 处 `outline: 0` 因此压掉了 `base.css:41-44`）。
- 上述 homebrew zh 译文重做。
- `ArkhamDbDeck.vue` 里我新加的两条错误文案沿用了该文件既有的硬编码英文（周围三条也是），需要一并纳入汉化。

**未做**：§1.3 重建后端二进制（要重启 LaunchAgent，等确认）、§2.6 图片 `decoding`/尺寸、§2.7 卡牌页虚拟化、§2.8 返回键行为、§3 全部。

---

## 0. 先决定：从哪个端口玩

这一步比后面所有优化都重要。

| 入口 | 内容 | 卡图 | 换肤 | 结论 |
|---|---|---|---|---|
| `http://localhost:8080` | vite dev（`./dev.sh` 拉起） | **走本地懒加载镜像，第二次起秒开** | 有 | ✅ **用这个** |
| `http://localhost:3000` | nginx 静态站 | 直连 CloudFront，**~6s/张** | 无 | ❌ 别用 |

原因：
- `prod.nginxconf:60` 的 root 是 `/opt/arkham/src/frontend/dist`，那是**另一份 checkout**，不是本仓库。本仓库的换肤、`dev.sh`、卡图镜像它一概没有。
- `frontend/vite.config.js` 里的 `assetMirror()` 插件标了 `apply: 'serve'`，**只在 dev server 生效**，生产构建里没有这层拦截。
- 后端 API（:3002）两边共用，不受影响。

如果哪天想让 :3000 也可用：把 root 改成本仓库的 `frontend/dist`，并把镜像插件的 `apply: 'serve'` 去掉（或改用 nginx `proxy_cache`）。目前没必要。

---

## 1. P0 —— 现在就是坏的，会直接影响玩

### 1.1 自制战役 JSON 被机翻污染（我上一轮批量汉化的回归）

**现象**：`circus-ex-mortis` 和 `dark-matter` 两个自制战役的混乱袋、标记图标、牌堆渲染全错。
**证据**（已逐行核实）：

| 文件 | 坏掉的地方 | 后果 |
|---|---|---|
| `frontend/homebrew/circus-ex-mortis/campaign.json:19` 等 8 处<br>`frontend/homebrew/dark-matter/campaign.json:18-21` 等 16 处 | 混乱袋面 `"Skull"`/`"Cultist"` → `"骷髅"`/`"邪教徒"` | 合法面是 `frontend/src/arkham/types/ChaosToken.ts:13-19` 里的英文字面量。未知的会被 `compareTokenFaces` 当 homebrew slug 处理 → 难度设置的标记预览和混乱袋本身都不对，且找不到对应图标 |
| `frontend/homebrew/circus-ex-mortis/tokens.json:3` | `face` 改成 `":circus-ex-mortis:月亮"` | 图标文件仍叫 `img/chaos-tokens/moon.png`，`icons.json` 仍映射 `"moon"`，`customTokenKey`（`ChaosToken.ts:57`）算出来的键对不上 → 碎图 |
| `frontend/homebrew/dark-matter/scenario-decks.json:3` | `"image": "top-card-back"` → `"顶端-卡牌-返回"` | `frontend/src/arkham/components/ScenarioDeck.vue:61` 是字面量比较 `=== 'top-card-back'` → 扫查牌堆失去牌背渲染。`homebrewAssets.ts:17,21` 的 `as Record` 断言把这个错从 vue-tsc 眼皮底下藏掉了 |
| 同上 `:4` | `"className": "dark-matter-scanning-牌组"` | 对不上 `frontend/homebrew/dark-matter/style.css:2` 的 `.dark-matter-scanning-deck` → 样式失效 |
| `frontend/homebrew/*/scenarios.json` 多处 | `name` 半翻：`"One Night Only"` → `"1 夜晚 仅"`、`"Harm's Way"` → `"Harm's 道路"`、`"Thousand to One"` → `"Thousand to 1"` | `name` 只是 fallback，**真翻译走 `i18n` 字段 → `frontend/src/locales/zh/homebrew/`，那边是完好的**。所以这些改动既有害又无收益 |

**修法**：先把 diff 备份再整体还原。
```bash
cd "/Users/xqd_mac/我的/codeing/arkham-horror"
git diff frontend/homebrew/ > /tmp/homebrew-mistranslation.patch   # 备份，不丢东西
git checkout -- frontend/homebrew/
```
**工作量**：S（一条命令）。**注意：这是丢弃未提交改动，需要你确认后再执行。**

**根因记录**：批量汉化时把「脚本/代码会解析的字段」也翻了。以后汉化 homebrew 只动 `frontend/src/locales/zh/homebrew/`，`frontend/homebrew/**.json` 里的 `face` / `image` / `className` / `id` / `name` 一律不碰。

---

### 1.2 四个页面会永久空白，且没有重试入口

单人玩，撞上了没人帮你，只能自己开控制台。

| 页面 | 证据 | 触发条件 |
|---|---|---|
| 游戏桌面 | `frontend/src/arkham/views/Game.vue:740-763` 的 `immediate` watcher 里 `await fetchGame(...).then(...)` 无 `.catch`；模板 `:1936` 只有 `v-if="submittingBug"` / `v-else-if="ready && game && playerId"`，**没有 `v-else`** | gameId 被删 / 403 / 请求丢包 → NavBar 底下一片空白，`ready`（`:374`）永远不翻 true。`socketError` 只覆盖 ws 和解码路径，管不到这里 |
| 战役日志 | `frontend/src/arkham/views/CampaignLog.vue:21-25` 顶层 `refreshGame()` 裸 `.then`；模板 `:40` `v-if="game !== null"` | 同上 |
| 加入游戏 | `frontend/src/arkham/views/JoinGame.vue:19,34-48` | 失败只剩一个 `<h2>Join Game</h2>`，死路 |
| 牌组详情 | `frontend/src/arkham/views/Deck.vue:210-221` —— `ready` 在 `:40` 声明、`:219` 赋值，**模板从没读过它** | 加载中显示 "Main Deck 0"，出错也停在这个状态，和「真的是空牌组」无法区分 |

另外 `frontend/src/arkham/views/Cards.vue:187` 的 `await fetchCards('both')` **仍然没有 catch**（我上次只给 homebrew 那一行加了）。`arkham/cards` 一旦 500 或断网，`fetchData()`（`:293`）reject → Suspense 不 resolve → 卡牌页永久空白。

同类未保护顶层 await：
- `frontend/src/arkham/components/NewDeck.vue:25` —— `investigators.value = await fetchInvestigators()`，失败则「新建牌组」面板永不渲染
- `frontend/src/views/Rooms.vue:12` —— `await api.get('admin/rooms')`，失败则管理页空白

**修法**：做一个共用的 `LoadingState` / `ErrorState`（带「重试」和「回大厅」），四处补 `v-else` 分支；顶层 await 包 try/catch 落一个 error ref。
**工作量**：M（组件 S，接入 4-6 处）。这是**性价比最高的一项**，一次性消灭整类「静默空白」。

---

### 1.3 后端跑的是旧二进制 —— 白捡一个功能

**现象**：本地 `:3002` 的 `/api/v1/arkham/homebrew/cards` 返 404。
**真相**：路由**代码里是有的** —— `backend/arkham-api/config/routes:24`，handler 在 `backend/arkham-api/src/Api/Handler/Arkham/Cards.hs:86-101`。是 LaunchAgent（`com.arkhamhorror.lcg`）跑的二进制编译于该路由加入之前。

> 更正：我上一轮说「这个 commit 后端没实现该路由」是误判。`Cards.vue` 里那个 `.catch(() => [])` 仍值得留作防御，但真正的修法是重新构建部署。

**收益**：重建后卡牌页能正常显示自制卡（`circus-ex-mortis` / `dark-matter` 的卡）。
**工作量**：M（Haskell 全量构建，首次可能十几分钟）。注意 `game/` 目录升级会被整体替换（见记忆 `arkham-lcg-runtime-daemon`），重建前先确认存档位置。

---

### 1.4 切语言后卡名可能永久停在旧语言

**证据**：`frontend/src/stores/dbCards.ts`
- `:80-82` `fetch(...).then(r => r.json())` —— **不检查 `res.ok`**，404 返回 HTML 时抛 `SyntaxError`
- `:95-109` `initDbCards` 只有 `try/finally` **没有 catch** → rejection 逃到所有 `void this.initDbCards()` 调用点（`:58`、`:69`、`Question.vue:682`、`BuildSpiritDeck.vue:31`、`EventRow.vue:43`、`OrganizerDashboard.vue:281`）成为 unhandled rejection
- **关键**：`:101` 的 `this.lang = language` 在 fetch **之前**执行。若 fetch 失败而旧语言卡还在，`:98` 的守卫 `lang === language && dbCards.length > 0` 会让之后每次调用都提前 return → **卡名永远停在旧语言，且没有任何失效路径**

**触发**：你在 `SettingsForm.vue:53` 切中文（该函数同样无 try/catch），恰好那一刻网络抖一下。
**修法**：检查 `res.ok`；`lang` 只在成功后赋值；补 catch 并向用户报错。
**工作量**：S（约 5 行）。

顺带：`dbCards` 是 **5.7MB** JSON（`frontend/public/cards/cards_en.json`），只存在内存里，**每次整页刷新重下**。本地 localhost 读 5.7MB 大约几十毫秒，不算痛；但如果想更快，可以塞 IndexedDB 加版本键。**工作量**：M，**优先级低**（本地磁盘读，不是网络）。

---

## 2. P1 —— 明显的摩擦，值得顺手修

### 2.1 破坏性操作：回车直接删，全站无撤销

- `frontend/src/components/Prompt.vue` 绑了 `@keydown.enter.prevent="handleYes"` → 确认框弹出时按一下回车就执行删除。
- 四套确认机制并存：`<Prompt>` 对话框、`window.confirm`（`OrganizerDashboard.vue:268`、`CardBuilder.vue:154`）、原生 `alert()`（`Game.vue:1607,1819`）、内联两步确认（`SettingsForm.vue:143-148`）。
- **全站没有任何撤销**。删牌组、删游戏、删战役记录都是一次点击不可逆。
- 部分确认文案是硬编码未翻译（`GameRow.vue:121`、`Game.vue:2465`）。

单人玩，误删没人能救你。**修法**：统一到 `Prompt`、去掉 Enter 绑定、删除类操作加「撤销」toast（5 秒窗口）。**工作量**：M（去 Enter 是 S）。

### 2.2 空状态在数据到达前就触发

- `frontend/src/views/Home.vue:30-49,151-153` —— `activeGames.length === 0` 首屏为真，**每次进大厅都闪一下「没有进行中的游戏」**。
- `frontend/src/arkham/views/Decks.vue:51-53,104-106` —— 同样问题，且零牌组零筛选时也显示 `noDecksMatchFilters`（文案与情境不符）。
- 因为所有 fetch 都没有 `.catch`，**API 挂掉和账号为空在视觉上完全一样**。

**修法**：加 `loading` 标志，把「加载中 / 真的是空 / 筛选无结果 / 请求失败-重试」四种状态分开。**工作量**：M。

### 2.3 没有全局 401 处理

`frontend/src/api.ts:1-11` 的 axios 实例**没有 response interceptor**。session 过期时 `whoami` 失败 → `frontend/src/stores/user.ts:41-49` 静默 `logout()`，你正打到一半的战役页面直接变成未登录状态，没有任何提示。

本地单人也会遇到（放一晚上回来 session 就过期了）。**修法**：一个 interceptor，401 → toast「登录已过期」+ 跳转登录页并带上当前 URL 以便回来。**工作量**：S。

### 2.4 静默失败的写入操作

| 位置 | 问题 |
|---|---|
| `frontend/src/arkham/views/Decks.vue:44` | `deleteDeck(value).then(...)` 无 catch → 删除失败时牌组还留在列表里，零反馈 |
| `frontend/src/arkham/components/ChooseDeck.vue:324-330` | `fetchDecks()` 失败则 `ready` 永不翻 true → 建局选牌组界面卡在加载中 |
| `frontend/src/arkham/views/OrganizerDashboard.vue:282` | `await store.load(props.id)` 无 try/catch → 活动被删则空白仪表盘 |
| `frontend/src/arkham/components/Scenario.vue:614` | `void resetLocationOffsets(...).finally(...)` —— `.finally` 不吞 rejection |
| `frontend/src/arkham/components/ArkhamDbDeck.vue:21-25,78` | arkhamdb 导入分支无 try/catch、不查 `res.ok`，且错误元素被 `v-if="error && isArkhamBuild"` 门住 → **arkhamdb.com 的错误永远显示不出来** |
| `frontend/src/arkham/views/NewCampaign.vue:331,377,396,468` | `newGame(...)` / `createEvent(...)` 无 catch、**无 busy 标志** → 建局是秒级操作，「创建」按钮全程可点，双击建两个局 |
| `frontend/src/arkham/components/NewDeck.vue:183-212,232` | 同上，无 loading ref |
| `frontend/src/arkham/components/NewDeck.vue:123,154` | 报错信息里直接插值 File 对象 / `JSON.stringify(deckList)`，用户看到一坨原始 JSON |

**工作量**：每处 S（2-5 行），加起来 M。建议一次性扫完。

### 2.5 焦点环被系统性删掉

`frontend/src/styles/base.css:42-45` 的 `:focus-visible` 写在 `@layer base` 里，而 **Vue scoped 样式不分层、优先级高于所有 layer** → 44 处 scoped `outline: 0 / none` 全部生效，只有 15 个文件补回了 `:focus-visible`。键盘 Tab 到「登录」按钮上什么都看不见。

这是我换肤时引入的结构性问题（`base.css` 分层 vs scoped 不分层）。**修法**：在 layer 之外再写一条全局 `:focus-visible`，或逐组件补。**工作量**：S。

### 2.6 图片布局跳动

203 个 `<img>` 里只有 3 个用 `loading="lazy"`、**0 个用 `decoding="async"`**，且大多不预留尺寸：
- `frontend/src/arkham/components/CardImage.vue:62-79` 有 lazy 但不留 width/height（`.card-container` 只在 `.vertical` 分支设了 aspect-ratio）
- `frontend/src/arkham/components/GameRow.vue:90,93,108,139-142,158-161`、`DeckRow.vue:50,98-109` —— 调查员头像固定宽度但无高度 → 卡图陆续到达时列表一路往下跳

**修法**：`decoding="async"` + `aspect-ratio` / 显式尺寸 + 骨架背景色；长列表补 `loading="lazy"`。**工作量**：S-M。

### 2.7 卡牌浏览页无虚拟化

`frontend/src/arkham/components/CardImageView.vue:114` 的 `v-for="{card,count} in groupedCards"` 给每张卡挂一个完整 `CardImage` 组件（每个约 5 computed + 3 watcher + 2 img），几百到上千个。`loading="lazy"` 只省网络，不省 DOM 和组件开销。
**修法**：窗口化网格。**工作量**：M。**优先级**：中——只在筛得很宽时明显。

### 2.8 浏览器返回键行为异常

- `frontend/src/views/Home.vue:64,84-92` + `App.vue:12-16`：`newGame` 只在初始化时快照一次 `route.path`，且 `<router-view>` 没有 `:key` → 从 `/new-game` 按返回到 `/`，向导界面还留在屏上（UI 与 URL 脱同步）。
- `frontend/src/arkham/views/Cards.vue:296,300,531,709`：每次切视图、翻章节、点系列、改搜索都 push 一条历史 → 想离开卡牌页要按 N 次返回。

**修法**：`watch(route)`；筛选类改用 `router.replace`。**工作量**：S。

---

## 3. P2 —— 知道就好，本地单人可以不动

| 项 | 证据 | 为什么可以不管 |
|---|---|---|
| 生产构建 locale 巨块 | `dist/assets/zh-*.js` **2.6MB**、`en-*.js` **2.4MB**（`frontend/src/locales/en.ts` 26 个静态 import 把 151 个 campaign JSON 全打一起）；`frontend/src/main.ts:28-34` 还**串行** await 两个 → 中文用户首屏前拉约 5MB JS | **只影响生产构建**。你走 :8080 dev，vite 按需给模块，localhost 上不构成瓶颈。若哪天要部署到 :3000 再修（`Promise.all` 是 S，按 campaign 拆动态 import 是 M） |
| `normalizeIconPlaceholders` 启动开销 | `frontend/src/locales/messages.ts:43-57` 在 mount 前同步深遍历整棵多 MB 消息树逐串跑正则 | 同上，dev 下消息树是分模块的，量级小得多 |
| vite 无 `build` 配置 | `frontend/vite.config.js` 没有 `build` 块 → 单入口 436KB 混装 vue+pinia+i18n+router+axios+fontawesome 等 | 只影响生产构建 |
| homebrew locale 全量 eager | `frontend/src/locales/homebrew.ts:7` 用 `{ eager: true }` glob 32 个文件（en+zh），267KB，运行时按 locale 丢掉一半 | 量级小 |
| 缺数据库索引 | `arkham_players`、`arkham_decks` 只有主键，却按 `user_id` / `arkham_game_id` 过滤；`notifications` handler 是 `selectList []` 全表无 LIMIT | 单人数据量，全表也就几百行 |
| 游戏列表取全量 jsonb | `backend/arkham-api/src/Api/Handler/Arkham/Games.hs:124-137` 取回每行完整 `current_data`/`log`，再逐行 `fromJSON`（单局 57-206KB） | 本地几十局 ≈ 几 MB 本地读取，几十毫秒级 |
| 行锁横跨引擎步进 | `backend/arkham-api/src/Api/Handler/Arkham/Games/Shared.hs:380` 的 `SELECT ... FOR UPDATE` 事务开到 `runMessages` 结束（自带 30s 超时注释）；连接池 10（`config/settings.yml:6`） | 只有并发才致命，单人无所谓 |
| CORS 禁用缓存 | `backend/arkham-api/library/Application.hs:203-216` 给每个带 Origin 的响应盖 `Cache-Control: no-cache, no-store`；全站无 ETag/Last-Modified；每个响应都带 `Set-Cookie` | localhost 上 864KB → 127KB（gzip 已开，实测）传输只要几毫秒 |
| 自定义卡全局注册表串号 | `backend/arkham-api/library/Arkham/Card/CustomCard.hs:103-105` 只按 `card_code` 存进程级 `IORef`，但 code 只在单用户内唯一；经 `unsafePerformIO` 喂进主卡池 | **单人不会串号**。唯一残留风险：注册表**永不淘汰**，长期挂着的进程内存只涨。若你常年不重启后端，可以关注一下 |
| Mailtrap token 打印到 stdout | `backend/arkham-api/src/Base/Api/Handler/PasswordReset.hs:40` `liftIO $ print apiToken` | 本地日志只有你自己看。删一行成本为零，顺手删即可 |
| 对用户输入直接 `error` → 500 | `Api/Handler/Arkham/Games.hs:206`、`PendingGames.hs:138`、`PasswordReset.hs:85`、`Api/Arkham/Epic.hs:139,188` | 单人不会构造畸形请求；但改成 `invalidArgs` 是 S，顺手 |
| 账号枚举 | `PasswordReset.hs:29` 用 `getBy404` | 公网问题，本地无关 |
| 触屏可用性 | `CardImage.vue:69,121` 翻面按钮仅 `:hover` 显示；`Asset.vue:433` 弃牌控件是 13×13px 的 `aria-hidden` span；`DeckRow.vue:49` 整行是 `div @click` | 桌面鼠标操作不受影响。**若你会在实体桌上用手机开这个 app，则升为 P1** |
| 图片 alt 缺失 | 163/203 个 `<img>` 无 `alt` | 不用读屏软件则无感 |
| 矮视口裁切 | `base.css:26-34` `#app { height:100vh; overflow:hidden }` + SignIn/Reset 根节点是裸 `<form>` → 横屏手机上提交按钮在屏外且无法滚动；全站只有 `Game.vue:2739` 用了 `dvh`。`Game.vue:2786` 邀请面板硬写 `width: 800px` | 同上，桌面无关 |
| 死文件 125MB | `frontend/public/` 顶层 13 个 `cards_*.json`（每个 10-12MB）无任何引用 | 只影响 dist 体积，本地无所谓 |
| 死依赖 | `frontend/package.json:41` 的 `v-jsoneditor`/`jsoneditor` 在 `src` 中从未 import | 未进包，删不删都行 |
| 无 ARIA live region | 全站仅 3 处（`EventStartBarrier.vue:10`、`EventActAdvanceBarrier.vue:21`、`Admin/UI.vue:65`）；WebSocket 驱动的桌面/日志/处理中 spinner 不播报 | 不用读屏软件则无感 |
| 无 scrollBehavior / keep-alive | `frontend/src/router/index.ts:11-14` → 从牌组详情返回列表会重新拉取并丢失滚动位置 | 有点烦但不致命。可仿照 `Cards.vue:175-193` 的 sessionStorage 缓存做法 |

---

## 4. 已经查过、确认没问题的（不用再找）

- **路由级代码分割**：所有 view 都是 `() => import(...)` 懒加载，没有巨型单包。
- **`vue-tsc --noEmit`**：exit 0，无类型错误。
- **i18n 键完整性**：846 个静态 `t('…')` 键全部命中（少数看似缺失的其实经 `gameBoard.ts` 重挂载解析）；en→zh 键集差 **0 缺失**（12,090 个 en 键）；`fallbackLocale: 'en'`（`main.ts:38`）覆盖 de/es/fr/it/ko 缺 `homebrewMessages` 的情况。
- **卡牌池缓存**：`Cards.vue:132-178` 用 sessionStorage，`v3` 版本化，5 分钟 TTL —— 做法正确。
- **卡牌搜索**：`Cards.vue:849` 是 `@submit.prevent` 提交制，不是每键触发，无需 debounce。
- **digest 加载**：`helpers.ts:35-42` 按语言懒加载，没有全量打包。
- **监听器/定时器清理**：抽查的每个 `setInterval` / `addEventListener` 都有配对的 `onUnmounted` 清理（`MultiplayerLobby.vue:82`、`Scenario.vue:935-943`、`Game.vue:1917` 等），无泄漏。
- **gzip**：`backend/arkham-api/library/Application.hs:185` 有 `gzip def` 中间件，实测 864,005 → 126,860 字节。
- **卡池数据**：编译期内存 CAF（`library/Arkham/PlayerCard.hs:33-43`），不是每请求读盘或查库。
- **前端调用的其他端点**：把 `frontend/src/arkham/api.ts` 里所有路径与 `backend/arkham-api/config/routes` 交叉核对，除 `homebrew/cards`（实为旧二进制问题）外无其他缺失。
- **值得抄的好范例**：`ClaimSeat.vue:32-44`（加载+错误+逃生路径）、`MultiplayerLobby.vue:85-117,156-173`（busy 标志、禁用提交、翻译过的错误、复制反馈）、`Prompt.vue`（原生 `<dialog>` = 真焦点陷阱 + Esc 关闭）。

---

## 5. 建议执行顺序

按「投入产出比」排，前四步做完体感差异就很大。

| # | 动作 | 工作量 | 收益 |
|---|---|---|---|
| 1 | 备份后还原 `frontend/homebrew/`（§1.1） | S | 两个自制战役恢复可玩 |
| 2 | 六个空白页补 loading/error 分支 + 顶层 await 包 try/catch（§1.2） | M | 消灭整类「静默死局」 |
| 3 | `dbCards` 修 `res.ok` + `lang` 后置 + 补 catch（§1.4） | S | 切语言不再可能永久错乱 |
| 4 | 全局 401 interceptor（§2.3）+ `Prompt` 去掉 Enter 绑定（§2.1） | S | 不再静默登出、不再回车误删 |
| 5 | 重建部署后端二进制（§1.3） | M | 卡牌页恢复自制卡 |
| 6 | 写入类操作补 busy 标志与 catch（§2.4） | M | 不再双击建两个局、失败有反馈 |
| 7 | 图片 `decoding="async"` + 预留尺寸（§2.6） | S-M | 消除列表跳动 |
| 8 | 空状态与错误状态分离（§2.2） | M | 不再闪「没有游戏」 |
| 9 | 全局 `:focus-visible` 修复（§2.5） | S | 键盘操作可见焦点 |
| 10 | 顺手清理：删 `print apiToken`、5 处 `error` → `invalidArgs` | S | 卫生 |

**明确不做**：§3 全部，除非你要把它部署给别人用、或者开始在实体桌上用手机操作。
