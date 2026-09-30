# 附着卡牌特效盘点与方案

日期：2026-09-27。原盘点方案及后续实现记录。

## 范围与统计口径

以当前仓库英文卡牌数据、简体中文牌名及后端卡牌实现为依据。优先统计诡计附着于地点、敌人、支援、场景或密谋后持续生效的情况；玩家主动附着的事件/支援、单纯放入威胁区的弱点、未纳入数据的自制卡不在本轮完整统计范围。

英文诡计文本含独立单词 attach / attaches 的关键词初筛，共 97 个不同英文牌名。此数字是候选数，不是已确认的附着特效数量：例如 Mind Extraction 实际移动附着的是另一张支援；Altered Beast 的文本使用 attached，未被该关键词覆盖。同名再版、多面版本及不同规则版本按名称合并，因此 Fire! 两个版本在初筛中算一个牌名。

本轮精选 35 张候选，分为 8 类效果；现有橙色火焰作为公共参照，不计入这 35 张。灰烬兄弟会的奥术锁和暴洪骤来已核对后端实际效果。下列规则是视觉设计所需的摘要，不能代替完整卡牌规则。

## 视觉方向与共用规则

- 古旧铜铁、纸张、烟雾和低饱和魔法光；特效围绕卡牌四周，中心牌图、文字、线索与厄运保持清楚。
- 只有附着且效果生效时显示；丢弃、移除、迁移、横置造成效果停用时同步变化。不能仅靠牌名或错误套用“无法调查”等通用规则决定外观。
- 使用与地图一致的本地坐标；缩放、拖动后仍贴合卡框。敌人/装备特效适配各自卡片尺寸。
- 同张牌最多一个主要环境动效，加少量静态附着标识；例如火焰叠锁链，而不是叠加两层遮挡卡面的全屏效果。
- 悬停可列出实际附着牌，保留原附属牌展示和点击入口；特效本身不截获点击。
- 延续额外动画开关；减少动态模式显示静态轮廓。画外暂停，锁链/藤蔓优先 SVG/CSS，共用粒子层承担雾雪孢子；火焰才沿用现有 WebGL。

## 候选方案

### 锁、门与阻挡（7 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 上锁的门 / Locked Door `01174` | 禁止调查；不是禁止移动。 | 旧铜锁扣在卡边，短链沿两侧下垂；成功解锁时链条松脱。 |
| 奥术锁 / Arcane Lock `12157` | 进出各增加 1 行动成本。 | 紫金符文锁环，缓慢明暗变化；不画成完全封死的门。 |
| 暗门 / Secret Door `51065` | 禁止离开。 | 内侧门框与向内闭合的锁链；与禁止调查区分。 |
| 奥术屏障 / Arcane Barrier `02102` | 进出需要意志检定，失败有取消移动或弃牌的选择。 | 半透明紫色薄膜沿卡边流动，移动检定时短暂亮起。 |
| 石障 / Stone Barrier `07299` | 准备状态时禁止移出；横置后不再阻止。 | 石块在底边筑墙；横置时石块退到两角。 |
| 无路可退 / No Turning Back `04228` | 禁止进入或离开。 | 碎石封住两侧入口，解除时向外散落。 |
| 塌方 / Cave-In `10520` | 拦截矿车进入并造成伤害。 | 底边塌落碎石；不显示为普通调查封锁。 |

### 雾气（5 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 朦胧之雾 / Obscuring Fog `01168` | 地点隐藏值 +2，成功调查后丢弃。 | 灰白薄雾沿边缘漂动，卡面中心保持清楚。 |
| 幽灵迷雾 / Spectral Mist `81025` | 所在地检定难度 +1。 | 带少量幽蓝光点的冷雾。 |
| 压抑浓雾 / Oppressive Mists `51067` | 抽牌后可能被迫弃牌。 | 较厚的灰雾停留在卡顶和两侧。 |
| 彼端迷雾 / Mists from Beyond `54073` | 隐藏值 +1，可能移动到其他地点。 | 浅雾边框；附着目标变化后迁移。 |
| 古老迷雾 / Elder Mist `11731` | 所在地调查员四项技能各 -1。 | 灰绿雾丝与低频暗光。 |

### 植物、蛛网与孢子（4 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 疯狂生长 / Overgrowth `04076` | 禁止探索。 | 藤蔓从四角生长，保持中央文字与标记可读。 |
| 荆棘之墙 / Wall of Thorns `10736` | 进出伤害依昼夜变化。 | 带刺枝条沿边缘环绕；白天偏枯黄、夜晚偏冷绿。 |
| 恶心蛛网 / Sickening Webs `06103` | 禁止移出，并强化同地点蜘蛛敌人。 | 四角蛛网连接边缘；绷紧时轻微颤动。 |
| 有毒孢子 / Poisonous Spores `04216` | 回合结束时施加中毒或恐惧。 | 稀疏黄绿孢子向上浮动，不用整张绿蒙版。 |

### 冰雪、水流与异火（6 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 南极寒风 / Antarctic Wind `08692` | 所在地不能打牌、从牌库抽牌。 | 斜向细雪和边缘霜痕。 |
| 雪盲危机 / Whiteout `08693` | 所在地四项技能各 -1。 | 薄白风雪，控制密度，避免遮住牌名。 |
| 极地旋涡 / Polar Vortex `08694` | 在此结束回合，对有生命的己方卡造成直接伤害。 | 小范围旋转冰晶环。 |
| 穿越冰雪 / Through the Ice `08699` | 进出敏捷检定失败会取消移动并造成伤害、恐惧。 | 蓝白冰裂纹贴边，检定失败时短暂扩裂。 |
| 暴洪骤来 / Flash Flood `12159` | 隐藏值 +4，回合结束丢弃。 | 低位急流与少量水花；不改变地点实际洪水等级。 |
| 圣艾尔摩之火 / St. Elmo's Fire `11665` | 回合结束造成伤害，然后迁移到邻接地点。 | 青蓝色细电焰，复用火焰框架但与橙色着火区分。 |

### 空间异常与探照（4 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 元初通道 / Primordial Gateway `05307` | 放置裂隙，地点印刷文本失效（特性除外）。 | 边缘小型紫黑裂口，使用独立纹理而不扭曲正文。 |
| 裂隙空间 / Splintered Space `09741` | 附着并按所在地咒术数量检定伤害；达到数量条件会离场。 | 细碎空间裂线，附着出现时一次扩张。 |
| 现实扭曲 / Warped Reality `09743` | 结束回合时可能将手牌变为空洞。 | 边角缓慢错位的双影，中心文字稳定。 |
| 秘法聚光灯 / Arcane Spotlight `88039a` | 进入或回合结束时提升警戒。 | 窄幅淡金扫描光扫过卡图，避开标记层。 |

### 支援卡受损与失效（3 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 真菌感染 / Fungal Rot `10727` | 物品支援文本失效（特性除外）。 | 霉斑与菌丝沿装备边缘蔓延。 |
| 现实之线 / Threads of Reality `06100` | 支援文本失效，保留特性及强制能力。 | 细紫线束住卡框，呈现被封印的感觉。 |
| 机械故障 / Malfunction `07099` | 载具支援不能发动行动能力。 | 短暂火花与暗红故障符号，常态使用静态磨损边框。 |

### 敌人强化（3 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 无尽嗜血 / Insatiable Bloodlust `81036` | 提高战斗、伤害、恐惧，不能躲避。 | 暗红血丝沿敌人边框缓慢脉动。 |
| 高耸的野兽 / Towering Beasts `02256` | 敌人战斗与生命各 +1。 | 厚重暗色外轮廓与一次向外生长动画；不改变实际卡牌尺寸。 |
| 身染猩红 / Bound in Red `09729` | 敌人战斗、躲避、伤害、恐惧各 +1。 | 猩红缠丝与少量红色光点。 |

### 厄运与全局影响（3 张）

| 卡牌 / 编号 | 持续影响摘要 | 特效方案 |
|---|---|---|
| 卡尔克萨尖柱 / Spires of Carcosa `03091` | 地点带厄运，可通过调查移除。 | 卡顶出现古旧尖塔剪影，与厄运标记同层级之外显示。 |
| 鲜血阴谋 / Conspiracy of Blood `04146` | 密谋厄运阈值 -1。 | 密谋牌边缘血色刻痕，避免整张地图染红。 |
| 哈斯塔的印记 / The Sign of Hastur `52070` | 增加调查员受到的恐惧。 | 附着的场景或密谋牌角出现缓慢闪动的黄色印记。 |

## 建议实施顺序

第一批 8 张：上锁的门、奥术锁、暗门、朦胧之雾、奥术屏障、暴洪骤来、疯狂生长、恶心蛛网。覆盖最容易从画面理解的状态，以及当前正在玩的灰烬兄弟会。

第二批：冰雪、孢子、青蓝电焰，以及支援封印/故障。第三批：敌人强化、全局厄运和空间异变，先解决与红色敌人高亮、目标选择提示的视觉冲突。

技术方向：沿用火焰的服务端 UI 状态标记思路，传递效果种类与来源；前端统一渲染卡片状态效果。需要区分附着存在和规则是否当前生效，尤其石障的准备/横置状态。第一批先验证锁链与雾气两种表现的清晰度，再批量扩展。

## 关键词初筛全表（97 个牌名，含待复核项）

以下保留全部初筛结果，便于继续扩大范围；不表示每张都应制作独立特效。牌号保留同名全部匹配版本。

| 中文牌名 | 英文牌名 | 匹配牌号 |
|---|---|---|
| 朦胧之雾 | Obscuring Fog | 01168 |
| 击退邪恶 | Smite the Wicked | 02007, 90061 |
| 上锁的门 | Locked Door | 01174 |
| 寻找伊莎贝拉 | Searching for Izzie | 02011, 90086 |
| 幽灵迷雾 | Spectral Mist | 81025 |
| 无尽嗜血 | Insatiable Bloodlust | 81036 |
| 亚弗戈蒙之光 | Light of Aforgomon | 02085 |
| 忍气吞声 | Sordid and Silent | 02089 |
| 奥术屏障 | Arcane Barrier | 02102 |
| 刺鼻瘴气 | Acrid Miasma | 82037 |
| 绑架！ | Kidnapped! | 02220 |
| 高耸的野兽 | Towering Beasts | 02256 |
| 卡尔克萨尖柱 | Spires of Carcosa | 03091 |
| 恶灵作祟 | Spirit's Torment | 03094 |
| 地下深坑 | The Pit Below | 03262 |
| 对抗黑风 | To Fight the Black Wind | 98012 |
| 疯狂生长 | Overgrowth | 04076 |
| 屋中无人 | Nobody's Home | 04145 |
| 鲜血阴谋 | Conspiracy of Blood | 04146 |
| 乌默尔多斯的面具 | Mask of Umôrdhoth | 50043 |
| 有毒孢子 | Poisonous Spores | 04216 |
| 无路可退 | No Turning Back | 04228 |
| 黑暗隐伏 | Creeping Darkness | 04342 |
| 黑暗指令 | Dark Bidding | 51023 |
| 不可察觉的生物 | Imperceptible Creature | 51046 |
| 无限门廊 | Infinite Doorway | 51063 |
| 暗门 | Secret Door | 51065, 71060 |
| 压抑浓雾 | Oppressive Mists | 51067 |
| 究极混沌 | Ultimate Chaos | 05342 |
| 元初通道 | Primordial Gateway | 05307 |
| 嗜血 | Bloodlust | 06019 |
| 哈斯塔的印记 | The Sign of Hastur | 52070 |
| 现实之线 | Threads of Reality | 06100 |
| 恶心蛛网 | Sickening Webs | 06103 |
| 海盗追猎 | Hunted by Corsairs | 06104 |
| 麦格鸟之歌 | Song of the Magah Bird | 06153 |
| 奇妙平原 | Wondrous Lands | 06154 |
| 月球巡逻 | Lunar Patrol | 06232 |
| 巨噬蠕虫隧道 | Dhole Tunnel | 06272 |
| 逼入疯狂 | Driven to Madness | 84024 |
| 定罪证据 | Incriminating Evidence | 84026 |
| 黑暗中的织网者 | The Spinner in Darkness | 06352 |
| 怨愤荒野 | Resentful Wilds | 53074 |
| 清算之日 | Day of Reckoning | 07040 |
| 机械故障 | Malfunction | 07099 |
| 掠食者的呼唤 | Predator's Call | 86028 |
| 黏脚 | Sticky Feet | 85050 |
| 外星食物链 | Alien Food Chain | 85053 |
| 尽腥尽力 | Worth His Salt | 07259 |
| 石障 | Stone Barrier | 07299 |
| 不稳定能量 | Unstable Energies | 54068 |
| 堕落恶行 | Vice and Villainy | 54070 |
| 彼端迷雾 | Mists from Beyond | 54073 |
| 易散之雾 | Evanescent Mist | 08585 |
| 同源迷雾 | Kindred Mist | 08691 |
| 南极寒风 | Antarctic Wind | 08692 |
| 雪盲危机 | Whiteout | 08693 |
| 极地旋涡 | Polar Vortex | 08694 |
| 穿越冰雪 | Through the Ice | 08699 |
| 身陷疯狂 | Abandoned to Madness | 08702 |
| 瘴气折磨 | Miasmatic Torment | 08706 |
| 朦胧瘴气 | Nebulous Miasma | 08707 |
| 极地幻景 | Polar Mirage | 08712 |
| 来访名片 | Calling Card | 09560 |
| 节点脉冲 | Locus Pulse | 09658 |
| 就在眼前 | In Plain Sight | 09721 |
| 身染猩红 | Bound in Red | 09729 |
| 物质颠倒 | Matter Inversion | 09738 |
| 裂隙空间 | Splintered Space | 09741 |
| 越界 | Beyond the Pale | 09742 |
| 现实扭曲 | Warped Reality | 09743 |
| “爹爹在哪儿？” | "Where's Pa?" | 10018 |
| 秘法聚光灯 | Arcane Spotlight | 88039a, 88039b, 88039c |
| 异空间催眠 | Dimensional Hypnosis | 88051a, 88051b, 88051c |
| 维度裂缝 | Dimensional Breach | 87051 |
| 时间扭曲 | Temporal Distortion | 87056 |
| 荧光增生 | Luminous Growth | 10587 |
| 真菌感染 | Fungal Rot | 10727 |
| 荆棘之墙 | Wall of Thorns | 10736 |
| 骤然突变 | Sudden Mutation | 10741 |
| “着火了！” | Fire! | 10743, 12129 |
| 心智抽取 | Mind Extraction | 71057 |
| 塌方 | Cave-In | 10520 |
| 古老迷雾 | Elder Mist | 11731 |
| 谈判破裂 | End of Negotiations | 11516 |
| 海底壁画[tdc_rune_w] | Seafloor Frieze [tdc_rune_w] | 11531 |
| 饥饿的墙壁 | Hungry Walls | 11576 |
| 古代秘库[tdc_rune_o] | Ancient Vault [tdc_rune_o] | 11608 |
| 古代秘库[tdc_rune_n] | Ancient Vault [tdc_rune_n] | 11609 |
| 古代秘库[tdc_rune_p] | Ancient Vault [tdc_rune_p] | 11610 |
| 古代秘库[tdc_rune_g] | Ancient Vault [tdc_rune_g] | 11632 |
| 古代秘库[tdc_rune_i] | Ancient Vault [tdc_rune_i] | 11633 |
| 破损星盘仪[tdc_rune_h] | Ruined Orrery [tdc_rune_h] | 11634 |
| 剥蚀壁画[tdc_rune_e] | Eroded Frieze [tdc_rune_e] | 11664 |
| 圣艾尔摩之火 | St. Elmo's Fire | 11665 |
| 奥术锁 | Arcane Lock | 12157 |
| 暴洪骤来 | Flash Flood | 12159 |

## 本地依据

- `frontend/card-data/cards_en.json`：卡牌原始规则、牌号与候选筛选。
- `frontend/card-data/cards_zh-cn.json`：简体中文牌名。
- `backend/arkham-api/library/Arkham/Treachery/Cards/`：附着与持续效果实现。
- `frontend/src/arkham/components/Location.vue`：现有火焰、洪水和附属牌展示。
- `frontend/src/arkham/components/FlameWrap.vue` 与 `frontend/src/arkham/flameWrap.ts`：现有火焰渲染。

## 实现记录

- 已接入地点、敌人、支援、场景及密谋的实际卡牌展示，历史堆叠预览不显示当前附着特效。
- `frontend/src/arkham/data/attachmentEffects.json` 登记 107 个牌号、98 个效果来源牌名：覆盖原初筛 97 个牌名，心智抽取由实际附着的苍白提灯替代，并补入初筛漏掉的变异野兽。同名不同版本保留各自牌号。
- 共 27 种效果类型，其中橙色着火保留原有服务端 OnFire + FlameWrap，其余 26 种使用共用 SVG/CSS 图案、粒子与边缘气氛层。无需新增图片资源或后端编译。
- 从宿主列表和附着目标双重确认关系；补齐前端 AttachedToEnemy、AttachedToAct、AttachedToAgenda 的目标 ID 解码。不会根据当前操作调查员猜测附着目标。
- 石障横置或附着诡计被 Blank 时保留淡化静态图案。附着迁移、离场、牌翻面时根据当前状态重建或移除。心智抽取的效果跟随实际苍白提灯支援。
- 叠加时保留不同图案；同类重复合并。首层运动，第二层静态，更多种类收为卡底小图案。已有橙色火焰时，其余图案静态显示。
- 以宿主本地布局坐标定位，继承地图和牌桌缩放，并跟随装备卡旋转。画外暂停；额外动画关闭时隐藏，系统减少动态模式下保留静态表现。
- 当前实现为持续附着视觉：解除时随状态移除，没有单独制作解锁碎裂、碎石散落等离场动画；荆棘采用固定枯黄配色，尚未新增昼夜调色协议。
- 已执行：8 项自动检查（覆盖全表、附着转移/移除、各宿主解码、石障、提灯、Blank、叠加、缩放坐标）通过，Vue SFC 语法检查通过。未启动游戏或浏览器验收。
- 全量前端类型检查仍受 `StarterDeckPanel.vue` 与 `CampaignStep.ts` 的现有错误阻碍；本次新增特效代码未报类型错误。
