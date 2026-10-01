# 灰烬兄弟会：二次元精英与 Boss 登场

使用内置 image_gen 生成，透明 PNG 原始输出保留在 `frontend/public/assets/enemy-entrances/brethren-of-ash/`。没有使用现有卡牌原画。10 张独立立绘映射 13 个角色／形态：烈焰仆从三个版本共用同一身份立绘；俄洛寇斯两个形态共用立绘，以灰烬／烈焰光效和副标题区分。六位人类精英保留 NPC 身份。额外包含女王的骑士与烈焰兆使。

共用一套约 4 秒的 CSS 登场动画：暗场、聚光、立绘出现、微幅呼吸、雾气与余烬、名称浮现、淡出。与幕、密谋串行播放；遵循额外动画开关和减少动态效果偏好，支持点击／Esc 跳过。加载失败或超时释放播放队列。初始化、重连和撤销建立状态基线，不重播已有角色；场外、阴影及背面角色不展示。此实现为动态立绘登场，不是 Live2D 模型。

## 最终生成提示词

### servant-of-flame

```text
Use case: stylized-concept. Asset type: original transparent character illustration for a 4-second boss entrance in Arkham Horror: Brethren of Ash. Redraw from scratch in polished Japanese anime / dark fantasy visual novel style: precise hand-drawn linework, expressive mature character design, beautiful cel shading, restrained painterly detail, elegant occult horror mood. Full body or lower-thigh portrait framing, centered single subject occupying 85% of portrait canvas, complete head and hands, silhouette separated, a little safe padding. Dramatic warm ember rim light and cool shadows. Actual transparent alpha background. No scenery, no background rectangle, no typography, no card frame, no logos, no watermark, no UI. Not chibi, not photorealistic, not 3D. Subject: Servant of Flame: a terrifying adult humanoid fire cultist, gender ambiguous under a charred hood, cracked porcelain occult mask showing incandescent orange eyes, long ragged black ceremonial coat, fire glowing through fissures along forearms, one clawed hand raised with a controlled curl of flame, dynamic predatory stance. Human body, unsettling presence, no gore. No knight armour.
```

### elokoss

```text
Use case: stylized-concept. Asset type: original transparent character illustration for a 4-second boss entrance in Arkham Horror: Brethren of Ash. Redraw from scratch in polished Japanese anime / dark fantasy visual novel style: precise hand-drawn linework, expressive mature character design, beautiful cel shading, restrained painterly detail, elegant occult horror mood. Full body or lower-thigh portrait framing, centered single subject occupying 85% of portrait canvas, complete head and hands, silhouette separated, a little safe padding. Dramatic warm ember rim light and cool shadows. Actual transparent alpha background. No scenery, no background rectangle, no typography, no card frame, no logos, no watermark, no UI. Not chibi, not photorealistic, not 3D. Subject: Elokoss, Mother of Flame: an ancient female-coded botanical cosmic deity, towering nonhuman regal figure built from twisted black roots and thorn vines, branch antler crown with ember blossoms, an eerie beautiful mask-like face framed by burning foliage, multiple organic vine limbs curving around her silhouette, chest a glowing molten seed heart, petal cloak like ash and fire. Clearly flora-based eldritch boss, dignified and terrifying rather than a generic human sorceress; no nudity.
```

### queens-knight

```text
Use case: stylized-concept. Asset type: original transparent character illustration for a 4-second boss entrance in Arkham Horror: Brethren of Ash. Redraw from scratch in polished Japanese anime / dark fantasy visual novel style: precise hand-drawn linework, expressive mature character design, beautiful cel shading, restrained painterly detail, elegant occult horror mood. Full body or lower-thigh portrait framing, centered single subject occupying 85% of portrait canvas, complete head and hands, silhouette separated, a little safe padding. Dramatic warm ember rim light and cool shadows. Actual transparent alpha background. No scenery, no background rectangle, no typography, no card frame, no logos, no watermark, no UI. Not chibi, not photorealistic, not 3D. Subject: Queen's Knight: adult humanoid knight devoted to a fire cult in 1920s occult horror, ornate blackened ceremonial armour, weathered dark crimson tabard, closed angular helm, heavy longsword lowered diagonally in one hand, ember cracks and thorn motifs in armour, dignified threatening stance. Not a modern soldier.
```

### herald-of-flame

```text
Use case: stylized-concept. Asset type: original transparent character illustration for a 4-second boss entrance in Arkham Horror: Brethren of Ash. Redraw from scratch in polished Japanese anime / dark fantasy visual novel style: precise hand-drawn linework, expressive mature character design, beautiful cel shading, restrained painterly detail, elegant occult horror mood. Full body or lower-thigh portrait framing, centered single subject occupying 85% of portrait canvas, complete head and hands, silhouette separated, a little safe padding. Dramatic warm ember rim light and cool shadows. Actual transparent alpha background. No scenery, no background rectangle, no typography, no card frame, no logos, no watermark, no UI. Not chibi, not photorealistic, not 3D. Subject: Herald of Flame, a nonhuman occult fire monster: imposing upright creature with a hollow black volcanic skull, glowing orange eyes, asymmetric branching charred horns, lean body made of ash-black bark and obsidian, four elongated clawed arms, fire trapped in its rib cage, flowing shredded ceremonial ribbons, visible hand-drawn anime linework and strong cel shading. Unsettling elegant silhouette, no gore, no text, no human knight armour.
```

### abigail-foreman

```text
Use case: stylized-concept. Create ONE original character portrait for a Japanese anime visual-novel game set in 1920s Arkham, occult mystery atmosphere. VERY CLEAR 2D ANIME AESTHETIC, expressive anime eyes, crisp ink outlines, cel-shaded planes, illustrated hair strands, hand-drawn fabric folds, attractive mature adult character proportions. Not realism, not western concept-art painting, not 3D, not chibi. Portrait canvas, head to knees in frame, complete head, both hands visible, centered solitary character, generous safety margin. 1920s period clothing. Restrained warm rim lighting and cool dark shadows. Character on genuinely transparent alpha background, NO coloured backdrop, no scenery, no ground. NO TEXT, no logos, no card frame, no watermark, no UI. Subject: Abigail Foreman, Wary Librarian: mature adult female university librarian, reserved observant expression, dark brown bob, round spectacles, ivory blouse with high neckline, charcoal tailored vest and long skirt, one hand hugging two old worn books, other hand at spectacles, dignified and alert. Human academic, no monster features, no magic effects.
```

### cornelia-akely

```text
Use case: stylized-concept. Create ONE original character portrait for a Japanese anime visual-novel game set in 1920s Arkham, occult mystery atmosphere. VERY CLEAR 2D ANIME AESTHETIC, expressive anime eyes, crisp ink outlines, cel-shaded planes, illustrated hair strands, hand-drawn fabric folds, attractive mature adult character proportions. Not realism, not western concept-art painting, not 3D, not chibi. Portrait canvas, head to knees in frame, complete head, both hands visible, centered solitary character, generous safety margin. 1920s period clothing. Restrained warm rim lighting and cool dark shadows. Character on genuinely transparent alpha background, NO coloured backdrop, no scenery, no ground. NO TEXT, no logos, no card frame, no watermark, no UI. Subject: Cornelia Akely, Exhausted Supervisor: mature adult female factory supervisor, auburn hair pinned in a practical updo, weary sharp anime eyes and stern expression, rolled-sleeve cream work shirt, dark brown high-waisted work trousers, leather belt, scuffed boots, one hand holds a paper clipboard against her hip, the other carries work gloves. Human worker, no monster features, no magic effects.
```

### david-renfield

```text
Use case: stylized-concept. Create ONE original character portrait for a Japanese anime visual-novel game set in 1920s Arkham, occult mystery atmosphere. VERY CLEAR 2D ANIME AESTHETIC, expressive anime eyes, crisp ink outlines, cel-shaded planes, illustrated hair strands, hand-drawn fabric folds, attractive mature adult character proportions. Not realism, not western concept-art painting, not 3D, not chibi. Portrait canvas, head to knees in frame, complete head, both hands visible, centered solitary character, generous safety margin. 1920s period clothing. Restrained warm rim lighting and cool dark shadows. Character on genuinely transparent alpha background, NO coloured backdrop, no scenery, no ground. NO TEXT, no logos, no card frame, no watermark, no UI. Subject: David Renfield, Disillusioned Eschatologist: adult male occult society scholar, slick black hair, angular face, weary intelligent eyes, dark green 1920s three-piece suit and tie, small discreet silver crescent lapel pin, one hand loosely carries a closed leather-bound occult notebook, other hand near his lapel, tense dignified stance. Human cult scholar, no tentacles, no fantasy armour.
```

### margaret-liu

```text
Use case: stylized-concept. Create ONE original character portrait for a Japanese anime visual-novel game set in 1920s Arkham, occult mystery atmosphere. VERY CLEAR 2D ANIME AESTHETIC, expressive anime eyes, crisp ink outlines, cel-shaded planes, illustrated hair strands, hand-drawn fabric folds, attractive mature adult character proportions. Not realism, not western concept-art painting, not 3D, not chibi. Portrait canvas, head to knees in frame, complete head, both hands visible, centered solitary character, generous safety margin. 1920s period clothing. Restrained warm rim lighting and cool dark shadows. Character on genuinely transparent alpha background, NO coloured backdrop, no scenery, no ground. NO TEXT, no logos, no card frame, no watermark, no UI. Subject: Margaret Liu, Beguiling Lounge Singer: adult Chinese female jazz singer, expressive confident anime eyes, elegant black finger-wave hair, restrained burgundy silk evening gown with modest neckline, long dark gloves and pearl earrings, one hand holds a vintage 1920s microphone, other hand lifted in a singing gesture, poised and enigmatic. No modern idol clothes, no nudity, no monster anatomy.
```

### naomi-obannion

```text
Use case: stylized-concept. Create ONE original character portrait for a Japanese anime visual-novel game set in 1920s Arkham, occult mystery atmosphere. VERY CLEAR 2D ANIME AESTHETIC, expressive anime eyes, crisp ink outlines, cel-shaded planes, illustrated hair strands, hand-drawn fabric folds, attractive mature adult character proportions. Not realism, not western concept-art painting, not 3D, not chibi. Portrait canvas, head to knees in frame, complete head, both hands visible, centered solitary character, generous safety margin. 1920s period clothing. Restrained warm rim lighting and cool dark shadows. Character on genuinely transparent alpha background, NO coloured backdrop, no scenery, no ground. NO TEXT, no logos, no card frame, no watermark, no UI. Subject: Naomi O'Bannion, Runs This Town: mature adult female Irish-American crime boss, confident piercing anime eyes, dark red bobbed hair, sharply tailored black pinstripe 1920s suit with waistcoat, ivory shirt, gold watch chain, leather gloves, one hand at her hip and other holding a closed ledger, controlled powerful stance, human and elegant, no fantasy anatomy.
```

### earl-monroe

```text
Use case: stylized-concept. Create ONE original character portrait for a Japanese anime visual-novel game set in 1920s Arkham, occult mystery atmosphere. VERY CLEAR 2D ANIME AESTHETIC, expressive anime eyes, crisp ink outlines, cel-shaded planes, illustrated hair strands, hand-drawn fabric folds, attractive mature adult character proportions. Not realism, not western concept-art painting, not 3D, not chibi. Portrait canvas, head to knees in frame, complete head, both hands visible, centered solitary character, generous safety margin. 1920s period clothing. Restrained warm rim lighting and cool dark shadows. Character on genuinely transparent alpha background, NO coloured backdrop, no scenery, no ground. NO TEXT, no logos, no card frame, no watermark, no UI. Subject: Sgt. Earl Monroe, Dirty Cop: mature adult male corrupt 1920s New England police sergeant, broad sturdy build, square jaw, short moustache, cold suspicious anime eyes, navy wool police tunic, peaked police cap, brass buttons and understated badge, leather belt, one hand loosely holds a wooden police baton at his side, other hand on belt, intimidating watchful posture. Period policeman, not modern tactical police.
```

