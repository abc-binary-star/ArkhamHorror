# AHLCG 卡评多维表格录入指南

> B站 up主「星际猛男」《诡镇奇谈卡评》系列 → 飞书多维表格逐卡评分库。
> 本文档是每次录入卡评的唯一操作规程；配套记忆：用户级 `ahlcg-card-review-bitable`（表结构/历史/交叉校正）、`lark-cli-usage-notes`。

## 1. 目标表

- 链接：https://wcnu1dr3jdtn.feishu.cn/base/GkSKbZCVNapUfosBki5cRBpjnIA
- base_token `GkSKbZCVNapUfosBki5cRBpjnIA`，表「卡牌评分」table_id `tbl7CesaCvudW4Yb`
- lark-cli 用 `user` 身份（已登录本机）

字段与写入规则：

| 字段 | 类型 | 说明 |
|---|---|---|
| 名字 | text 主键 | 按文章原名逐字录入 |
| 职业 | 单选 | 蓝-守卫者 / 黄-探求者 / 绿-流浪者 / 紫-秘术师 / 红-幸存者 / 中立 |
| 打分 | number 1-5 | 5=必带 4=常带 3=特定角色/循环 2=特殊用途 1=烂 |
| 简介 | text | 评语全文，不加改写 |
| 篇章来源 | 单选 | 见 §3 命名 |
| diiiiiil分数/档位 | number/单选 | 仅当用户给 diiiiiil 内容时才动，平时留空 |

**禁止**：重建或填写「卡牌类型」「等级」字段（2026-09-17 已删）；等级区分只靠名字前缀（`0级巡警`、`2级偷袭`）。

## 2. 来源与粘贴格式

- B站正文**一律让用户直接粘贴**（WebFetch/浏览器抓 opus 全被验证码风控拦，别死磕）。
- 格式：`卡名  评分：N` 空行 评语段落；开头 up 主给读者的留言不入库。
- up主语言习惯：投币机=换资源资产、康=取消、奶=治疗、假赛=重骰/改token、转牌库=循环抽牌。

## 3. 篇章命名与选项

- 循环系列：`N循环（循环名）（上|中|下）`，职阶对固定 上=蓝黄、中=绿紫、下=红白
- 调查员包：`调查员包（调查员名）`
- 选项颜色：基础=Blue、一循环=Green、二循环=Purple、调查员包=Carmine(前3)+Gray(后2)；上/中/下 = Light/Standard/Dark

**补选项必须全量 PUT**：先 `+field-list` 取「篇章来源」（field_id `fldl2KFj35`）全部 options，旧的全部带上再加新项，`--yes`。当前 options 快照（2026-09-18）：

```
基础（上）基础（中）基础（下）｜一循环（敦威治遗产）（上）（中）（下）｜
二循环（卡尔克萨之路）（上）（中）（下）｜调查员包（纳撒尼尔·曹）（杰奎琳·法恩）（哈维·沃尔特斯）（斯特拉·克拉克）（温妮弗雷德·哈巴默克）
```

## 4. 录入流程（7 步）

1. **定篇章名** → 2. **field-update 补选项** → 3. **查重** → 4. **写记录文件** → 5. **批量入库** → 6. **验证** → 7. **清现场 + 更新记忆**

### 3. 查重（同名卡三种处理）

用 `+record-list --filter-json` 对本批全部卡名做 `or`/`==` 查询（投影 名字/打分/篇章来源）：

- **同名同分** → 跳过（如 星界旅行/暗中偷袭/艺高胆大，早年随调查员包提前入库的循环卡；即使其所属循环篇章已建成也不迁移、不补录）
- **同名不同分** → 读旧记录简介判断：若是同卡改口 → 提出合并方案交用户定；若是升级版对照（简介自述"比N级版…"）→ 新记录按前缀命名（如 `0级影之书`）
- **多等级合并评** → 按文章原名整条入一条记录（如 `蓝焰术系列（0级-3级-5级）`、`临危祷告、冥思苦想、拼死出击、绝命奔逃`）

### 4. 写记录文件

仓库根写 `.ahlcg-XX.json`，**每文件 ≤4 条**（长中文 Write 会随机截断，宁小勿大）：

```json
{"create_records":[
{"名字":"卡名","职业":"蓝-守卫者","打分":2,"简介":"评语…","篇章来源":"N循环（循环名）（上）"}
]}
```

打分必须是数字不是字符串；评语里有 `"` 才需转义（up主原文基本没有）。

### 5+6. 一键导入+验证脚本

写入 `.ahlcg_import.py`（改 `FILES` 前缀循环即可），`python3 .ahlcg_import.py`：

```python
import json, subprocess, time, sys

base = ["lark-cli", "base", "+record-batch-create",
        "--base-token", "GkSKbZCVNapUfosBki5cRBpjnIA",
        "--table-id", "tbl7CesaCvudW4Yb", "--json"]
fails = 0
for i in range(1, 10):                      # 按实际文件数改
    f = f".ahlcg-X{i:02d}.json"             # 按实际前缀改
    p = subprocess.run(base + ["@" + f], capture_output=True, text=True)
    try:
        d = json.loads(p.stdout)
        print(f, "ok=", d.get("ok")); fails += 0 if d.get("ok") else 1
        if not d.get("ok"): print(p.stdout[:300])
    except Exception as e:
        print(f, "FAIL", e, p.stderr[:200]); fails += 1
    time.sleep(1)                           # 同表串行必须间隔
sys.exit(1 if fails else 0)
```

验证（filter 比拉全表快，record-list 默认只回第一页 100 条）：

```bash
lark-cli base +record-list --base-token GkSKbZCVNapUfosBki5cRBpjnIA \
  --table-id tbl7CesaCvudW4Yb --field-id 名字 --field-id 打分 \
  --filter-json '{"logic":"and","conditions":[["篇章来源","==","<新篇章>"]]}' \
  --limit 100 --format json
```

python 解析：`data.fields` / `data.data` 列式按下标对应；数条数 + 抽查 2-4 张关键卡评分即可，别跑冗长自证。

### 7. 清现场 + 更新记忆

- `rm -f .ahlcg-*.json .ahlcg_*.py`（都是当次临时产物）
- 更新用户级记忆 `ahlcg-card-review-bitable.md`：description 总数 + 正文「已导入」行的累计式（`a+b+…=总数`，每篇章一张数与特例备注）
- 同趟更新用户级 `MEMORY.md` 索引行里的总数

## 5. 改错/校正用

- 改已有记录：`+record-batch-update`，payload 是 **record_id 为 key 的 map**：`{"update_records":{"recXXX":{"打分":3}}}`
- diiiiiil 交叉校正规则（两up都推→必选上调；新推荐→上调；值得一试→微调；都不推→不动）

## 6. 进度台账

截至 2026-09-18 共 **378 条**：
基础（上/下）80 ｜ 一循环敦威志 上中下 94 ｜ 调查员包×5 118 ｜ 二循环卡尔克萨 上中下 89

系列规律：循环篇章=相邻两职阶×3篇（蓝黄/绿紫/红白）。下一篇大概率是**三循环**（红白篇同前）或新调查员包，照 §3 命名照常补 option 即可。

## 7. 给用户组牌组时

卡池 = 表内已评卡（**别用本仓库 cards 数据库当卡池**），推荐理由直接引表内星级和双up短评。
