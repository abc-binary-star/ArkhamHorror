# 灰烬兄弟会：场景与密谋登场特写

覆盖本仓库「灰烬兄弟会」的三个剧本与全部 15 张场景 / 密谋卡。插画使用内置 `image_gen` 逐张生成，按当前卡牌的剧情构图；完整提示词保存在 [brethren-of-ash-prompts.json](./brethren-of-ash-prompts.json)。画面中的调查员是统一的叙事角色，并不随玩家选用的调查员变化。

## 素材与映射

最终运行时图片：`frontend/public/assets/scenario-cutins/brethren-of-ash/<卡牌编号>.jpg`。15 张共约 8.54 MiB，原始生成 PNG 保留在 Codex 的 generated_images 目录。项目图片使用同源 `/assets/` 路径，已加入 `frontend/scripts/runtime-images.json`。

卡牌编号、剧本、类型、中英文标题与图片路径集中在 `frontend/src/arkham/data/scenarioCutins.json`。

| 剧本 | 密谋卡 | 场景卡 |
| --- | --- | --- |
| Spreading Flames（12105） | 12106 宵禁时分；12107 火起；12108 野火遍地 | 12109 有烟处……；12110 逃出宿舍；12111 寻找阿米蒂奇博士；12112 炽热辉煌 |
| Smoke and Mirrors（12133） | 12134 阿卡姆热火朝天；12135 邪恶渐起 | 12136 烈焰预言 |
| Queen of Ash（12168） | 12169 聚集于此；12170 重生；12171 灰烬同袍会 | 12172 搜查下水道；12173 阻止仪式 |

12171 同时承担场景和密谋职能，登场仅展示一次。

## 展示规则

- 由 `Game.vue` 中唯一的 `useScenarioCutins` 监听服务端当前场景 / 密谋实体，不依赖卡牌组件的挂载或玩家座位数量。
- 正面 A 面新卡进入当前牌堆时播放；初始设置结束也会依次展示起始密谋和场景。B 面结算沿用原有卡牌翻面，不重复播放正面插画；查看卡牌历史不触发。
- 首次载入、断线恢复、撤销回退会建立新的状态基线，不重播已经出现的卡牌。
- 图片加载完成后展示 3200 毫秒，点击、Enter、空格或 Esc 跳过当前张；同次更新的多张卡依次播放。
- 图片失败自动跳过，加载超时亦自动释放展示队列。优先预加载当前剧本的图片。
- 遵循「额外动画」全局设置、本剧本覆盖和系统减少动态效果偏好。
- 与阶段公告共用前端操作 / 有序消息屏障，与抽牌展示互斥；不会发送额外游戏指令或更改服务端规则。

## 扩展到其他战役

按卡牌正面剧情生成独立横向插画，将最终图片保存到 `frontend/public/assets/scenario-cutins/<战役>/`，再在 `scenarioCutins.json` 中增加条目，并同步 runtime-images 清单。`code` 和 `scenario` 使用不带 `c` 前缀的编号；`kind` 使用 `act` 或 `agenda`。不要通过通用火焰图或原卡面冒充未制作的专属插画。

## 验证范围

`frontend/tests/scenarioCutins.test.mjs` 验证触发、排队、动画设置、撤销、特殊卡去重、图片失败 / 超时、阶段公告协调及全部后端卡牌定义的图片覆盖。已检查 Vue 脚本 / 模板编译与 composable 的 TypeScript 类型；未启动游戏或进行浏览器实机验收。
