# 牌桌主题素材 v2

使用内置 image_gen 工具，参考现有幽绿海港的 T04 地图、T02 皮革桌垫和 T05 行动托盘生成。每套独立生成地图、皮革、工具栏三张素材，没有以 SVG 或 CSS 渐变替代生图。

## 接入

运行时文件在 `frontend/src/assets/tabletop-themes/`，由 Vite 解析相对引用并随前端构建打包；原始 PNG 保存在本目录（沿用仓库忽略设计原图的约定）。运行时 JPEG 以 90 质量编码，保留原始分辨率，无重绘或裁剪。

- map：地点地图及主题选择器预览。地图采用整幅贴合的双轴尺寸，保留四角装饰；遵循旧地图约 1% 的边缘放大处理。
- leather：玩家牌桌、移动端手牌抽屉。
- chrome：阶段栏、行动栏、工具栏、侧边日志及场景侧架。长条取材质中段，面板保持较深阅读底色。
- 卡牌、职业色、行动提示色不作滤镜处理。幽绿海港继续使用原素材。

## 完整生成提示词

### zealot-map-v2

参考：T04-地点地图底板-v2.png 与 T02-调查员皮革桌垫.png

Use case: stylized-concept. Asset type: premium occult board-game tabletop background, flat production texture, landscape 3:2. Reference image 1 is the existing game map asset: closely match its exquisite worn printed texture, thin antique gold tooling, restrained edge detail and large quiet usable center. Reference image 2 establishes material craftsmanship. Create a NEW Night of the Zealot campaign map skin, not an interface screenshot. Oxidized oxblood, burnt umber, smoked black, faded candle gold. A genuine 1920s occult investigator's cloth-backed map: intricate copperplate engraving of old Arkham streets and house floorplans near the upper left border, forbidden woods and roots along lower right perimeter, subterranean brick crypt tracery at outer edges, tiny coded occult sigils worked into fine corner engraving. Subtle soot and rubbed gold, authentic uneven dyed canvas grain, light oil stains, antique printmaking. Hint of tentacular roots and inhuman geometry hidden in the edge engravings, sophisticated cosmic horror rather than Halloween. 72 percent of the central area must remain unobstructed low contrast richly textured oxblood cloth for cards; no large central symbols, no readable text, no card outlines, no UI, no objects sitting on the surface. Fine double-line distressed gold border extremely close to image edge, exquisite small corner ornaments. Orthographic top down, flat full bleed, no perspective or scene outside the surface. Commercial collector's edition board-game quality, material realism, richly detailed but elegantly restrained.

### dunwich-map-v2

参考：T04-地点地图底板-v2.png 与 T02-调查员皮革桌垫.png

Use case: stylized-concept. Asset type: premium occult board-game tabletop background, flat production texture, landscape 3:2. Reference image 1 is the existing game map: preserve its material richness, beautifully aged engraved cartography around the perimeter, hairline antique metal trim and generously empty playing area. Reference image 2 establishes luxurious handcrafted finish. Create a NEW The Dunwich Legacy campaign map skin. A cloth-backed New England antiquarian topographic survey, smoky slate violet, peat brown, weathered parchment-gold ink and tarnished copper. Dense exquisite copperplate contour maps of rural hills, tiny field boundaries, winding roads, an isolated farmhouse and leafless woodland only at the perimeter. Small standing-stone circle engraved in the upper right edge; faint impossible contour topology and tentacle-like ravines, unsettling cosmic horror as an old forbidden geographic document. Rich natural canvas fibers, irregular age patina, faint foxing, fine engraved hatching, tactile worn material. Center 72 percent very quiet low contrast smoky charcoal-violet cloth with gentle irregular mottling for card legibility, no central illustration or large symbol. Fine double-line worn old copper border near the edge, intricate small antique corner ornaments. Orthographic flat top-down production asset filling the entire image, no surrounding tabletop, no typography, no labels, no cards, no UI, no gradients masquerading as material. High-end commercial collector's edition craft, elegant, ancient, sinister.

### zealot-leather-v2

参考：/Users/xqd_mac/我的/codeing/arkham-horror/docs/design/诡镇奇谈/牌桌专项/T02-调查员皮革桌垫.png

Use case: stylized-concept. Asset type: production background texture for a premium cosmic horror card-game player workbench, ultra-wide 3:1. Image 1 is the existing green leather mat; closely match its material fidelity, refined corner tooling, scale and readable quiet center. Create a new Night of the Zealot variant in near-black oxblood burgundy, smoked mahogany, rubbed antique candle-gold. Full-frame top-down luxury antique bookbinding leather, naturally varied fine pores and fibers, very subtle rub marks, restrained wax sheen, beautifully patinated microtexture, delicate interwoven thorn and tentacle filigree, small occult rosettes, a few naturally dark scorched edges. Hairline double metal foil border confined to extreme outer 2 percent, exquisite small corners. Center 90 percent uninterrupted dark leather with subtle natural irregularities, not flat digital noise. All detail physically embossed or impressed into leather, never objects on top. Soft grazing light, dark but texture clearly visible. No text, no cards, no icons, no giant symbol, no scene, no perspective, no outer empty margin. Commercial collector's edition tactile quality, elegantly sinister, reference-level detail.

### zealot-chrome-v2

参考：/Users/xqd_mac/我的/codeing/arkham-horror/docs/design/诡镇奇谈/牌桌专项/T05-底部行动托盘纹理-v1.png

Use case: stylized-concept. Asset type: production background texture for a premium Lovecraftian game toolbar and side panels, ultra-wide 3:1. Image 1 is the existing action-tray material; closely match its understated tactile richness and worn craftsmanship. Create a new Night of the Zealot matching tray material in near-black oxblood burgundy, smoked mahogany, rubbed antique candle-gold. Dark patinated leather inset on antique lacquered wood, softly illuminated naturally irregular tiny leather pores across the upper 78 percent, a narrow dark horizontal worn wood rail across bottom 22 percent, rubbed metallic dust only along far left and right edges, delicate interwoven thorn and tentacle filigree, small occult rosettes, a few naturally dark scorched edges extremely faintly blind-tooled at far edges. Uninterrupted dark center designed for small text and controls, no hard decorative frame, no high contrast in center. Flat orthographic full-bleed texture, no physical scene or objects, no cards, no words, no interface, no collage, no large occult seal. Finely crafted 1920s occult casework finish, elegant aged material, photoreal texture detail.

### dunwich-leather-v2

参考：/Users/xqd_mac/我的/codeing/arkham-horror/docs/design/诡镇奇谈/牌桌专项/T02-调查员皮革桌垫.png

Use case: stylized-concept. Asset type: production background texture for a premium cosmic horror card-game player workbench, ultra-wide 3:1. Image 1 is the existing green leather mat; closely match its material fidelity, refined corner tooling, scale and readable quiet center. Create a new Dunwich Legacy variant in near-black charcoal aubergine, desaturated slate violet, weathered walnut and tarnished old copper. Full-frame top-down luxury antique bookbinding leather, naturally varied fine pores and fibers, very subtle rub marks, restrained wax sheen, beautifully patinated microtexture, delicate interwoven roots and tentacle filigree, tiny archaic standing-stone sigils worked into corner tooling. Hairline double metal foil border confined to extreme outer 2 percent, exquisite small corners. Center 90 percent uninterrupted dark leather with subtle natural irregularities, not flat digital noise. All detail physically embossed or impressed into leather, never objects on top. Soft grazing light, dark but texture clearly visible. No text, no cards, no icons, no giant symbol, no scene, no perspective, no outer empty margin. Commercial collector's edition tactile quality, elegantly sinister, reference-level detail.

### dunwich-chrome-v2

参考：/Users/xqd_mac/我的/codeing/arkham-horror/docs/design/诡镇奇谈/牌桌专项/T05-底部行动托盘纹理-v1.png

Use case: stylized-concept. Asset type: production background texture for a premium Lovecraftian game toolbar and side panels, ultra-wide 3:1. Image 1 is the existing action-tray material; closely match its understated tactile richness and worn craftsmanship. Create a new Dunwich Legacy matching tray material in near-black charcoal aubergine, desaturated slate violet, weathered walnut and tarnished old copper. Dark patinated leather inset on antique lacquered wood, softly illuminated naturally irregular tiny leather pores across the upper 78 percent, a narrow dark horizontal worn wood rail across bottom 22 percent, rubbed metallic dust only along far left and right edges, delicate interwoven roots and tentacle filigree, tiny archaic standing-stone sigils worked into corner tooling extremely faintly blind-tooled at far edges. Uninterrupted dark center designed for small text and controls, no hard decorative frame, no high contrast in center. Flat orthographic full-bleed texture, no physical scene or objects, no cards, no words, no interface, no collage, no large occult seal. Finely crafted 1920s occult casework finish, elegant aged material, photoreal texture detail.
