# 弹窗雕刻素材 v2

使用内置 image_gen 生成，两张素材已复制到 frontend/src/assets/veiled-harbour/。

- dialog-tentacle-v2.png：通用、选择、响应、攻击、设置和卡牌详情。
- dialog-astrolabe-v2.png：技能检定与混沌袋。

保留伤害分配框原实现。新框不使用换色滤镜；采用 26% 九宫格切片，不填充中央，正文独立放在深色底上。标题象牙金、正文浅象牙、辅助说明灰金。没有修改游戏事件和选项提交逻辑。

## 生成提示词

### 触须框

Use case: stylized-concept. Asset type: production game UI nine-slice border texture, not a screenshot. Create an exquisite restrained 1920s cosmic horror occult dialog frame, square 1024x1024. Dark charcoal green oxidized metal and antique bronze engraved fine tentacles, fine concentric celestial astrolabe arcs woven into FOUR CORNERS. Thin double hairline bronze border running along edges. Tiny worn copper highlights, muted patina, hand-engraved craftsmanship, dark elegant Arkham atmosphere. Ornaments contained entirely within outer 16 percent on each side; central 68 percent perfectly blank flat near-black green #141919, for readable text that will be added in code. All four corners equally intricate, modest small scale filigree. Straight-on perfectly flat 2D rectangular frame, no perspective or objects. Opaque full square texture reaching canvas edges. No text, letters, numerals, buttons, gems, skulls, creatures, large center emblem, glow, or light parchment. This is a reusable stretchable UI border; center and edges must remain quiet. Save the generated image as a local file and return its local path.

### 星盘框

Use case: stylized-concept. Asset type: game UI nine-slice border texture. A square flat 2D exquisite 1920s occult scientific instrument frame for a cosmic horror skill test dialog. Near-black charcoal slate with aged muted bronze metal inlay. FOUR corners have tiny quarter circles of complex astrolabe rings, alchemical geometry, fine celestial radial tick marks and restrained engraved scrollwork. This is real engraved metal craft, NOT glowing magic, not vector clipart. Double thin straight border lines join corners. Reserve central 68 percent as perfectly blank uniform #141919 dark field for text in code. Confine ornament to outer 16 percent, strongest at corners, subdued antique highlights. Square symmetrical full-bleed asset, no perspective, no outside backdrop, no lettering, no numbers, no labels, no buttons, no skull, no center emblem, no light paper. Opaque texture, subtle patina and refined linework, matching a premium dark tentacle dialog frame but using astronomical geometric motifs instead of tentacles. Save locally and return path.
