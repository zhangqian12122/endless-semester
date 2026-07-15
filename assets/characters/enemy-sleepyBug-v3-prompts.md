# 瞌睡虫 v3 美术生成记录

## 产出

- `enemy-sleepyBug-v3a.webp`：更亲和，困倦中吹出睡泡并蓄势冲撞。
- `enemy-sleepyBug-v3b.webp`：更像敌人，低头压身准备发动冲撞。

两版均使用内置 `image_gen` 生成纯 `#00ff00` 色键底图，再通过 imagegen 技能自带的 `remove_chroma_key.py` 转为透明 WebP。旧版只作为反例参考，未覆盖，也未修改游戏映射。

## 参考图角色

- `enemy-sleepyBug-v2.webp`：旧版反例。仅保留“瞌睡眼”和蓝紫橙色系辨识度，避免继续使用圆团、幼儿贴纸比例。
- `pet-offline-duck-battle-v1.webp`：项目内手绘厚涂、明亮可读性的质量参考，不复制其造型与比例。

## Version A prompt

```text
Use case: stylized-concept
Asset type: transparent-background combat enemy character for a browser card-battler
Input images: Image 1 is the rejected earlier sleepy-bug concept—retain only the readable sleepy eyes and blue/violet/orange family, but redesign the anatomy and pose; Image 2 is the project's friendly duck visual reference—match its hand-painted rendering polish and warm readability, but do not copy its proportions or expression.
Primary request: Create Version A, the more approachable of two ORIGINAL fantasy “sleepy bug” enemies. It must be charming and easy to like, yet unmistakably a combat enemy, not a pet or baby mascot.
Subject: a long-bodied insect creature with a smaller head, six substantial legs, layered shell plates and soft articulated belly segments. Three-quarter side view, facing LEFT toward the player. Its body leans forward and the front legs brace for a drowsy charge. Heavy drooping eyelids show tired irritation rather than helpless cuteness. One clear action only: it is huffing a single solid pale-blue sleep bubble from its mouth while preparing to ram.
Style/medium: polished semi-realistic cartoon game character, painterly hand-painted thick brushwork, believable shell and soft-body material detail, controlled anatomical exaggeration, strong readable silhouette; normal bright color, sophisticated rather than dark.
Composition/framing: full creature visible, horizontal character cutout, centered with generous padding; head on left, long segmented body trailing right; no cropping.
Color palette: luminous indigo and dusty violet shell, warm coral/orange plate accents, cream face, pale-blue solid sleep bubble; DO NOT use green anywhere in the subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local removal. It must be one uniform color with no shadows, gradients, texture, reflections, floor plane, lighting variation, cast shadow or contact shadow.
Constraints: crisp clean outer edge; no green spill; no person; no extra creature; no text; no letters; no logo; no trademark; no watermark.
Avoid: toddler sticker, round ball body, baby chibi proportions, plush-toy look, giant head, cute pet pose, black horror palette, gore, photorealism, floating UI, border, frame, floor, environmental elements.
```

## Version B prompt

```text
Use case: stylized-concept
Asset type: transparent-background combat enemy character for a browser card-battler
Input images: Image 1 is the rejected earlier round sleepy-bug concept; Image 2 is the project's friendly duck rendering reference; Image 3 is Version A. Use them only for continuity of painterly finish and readable sleepy identity. Create a clearly different ORIGINAL Version B with more enemy presence and a stronger attack pose.
Primary request: Create Version B, more dangerous than Version A while still appealing. It must look like a memorable battle opponent, not a baby mascot, pet, sticker, or horror monster.
Subject: a long fantasy insect with a low wedge-shaped head, pronounced layered armored carapace, articulated soft abdominal segments, and six sturdy clawed legs. Three-quarter side view facing LEFT toward the player. The entire body is compressed like a spring: head lowered, shoulders forward, front claws planted wide, rear legs pushing, antennae swept backward—clearly one action, preparing a powerful sleepy charge. Heavy half-closed eyes glare with tired impatience. Include one small pale-blue puff of sleep dust held tightly at one nostril, opaque and graphic, not smoke filling the scene.
Style/medium: semi-realistic cartoon game enemy, hand-painted thick brushwork, refined concept-art finish, believable shell scuffs and soft-body folds, strong silhouette, controlled proportions, normal bright colors, cinematic energy without darkness.
Composition/framing: full creature visible in a horizontal cutout, centered with generous padding; head left and long body right; dynamic diagonal from low head to raised back; no cropping.
Color palette: bright lapis/cobalt shell with warm amber and terracotta armor ridges, dusty lavender belly, cream facial plates, pale-blue opaque dust puff; DO NOT use green anywhere in subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local removal. Background must be one uniform color with no shadow, gradient, texture, reflection, floor plane or lighting variation. No cast shadow, contact shadow, glow or motion trail.
Constraints: crisp clean contour; no green spill; no person; no second creature; no text; no letters; no logo; no trademark; no watermark.
Avoid: toddler sticker, round ball body, giant head, chibi baby proportions, plush-toy look, friendly pet stance, passive standing pose, black horror palette, gore, photorealism, UI, border, frame, environmental objects.
```

## 去背与验证

```powershell
python "$env:USERPROFILE/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py" `
  --input <source.png> --out <final.webp> --auto-key border --soft-matte `
  --transparent-threshold 12 --opaque-threshold 220 --despill
```

- A：1536×1024，RGBA，四角透明，主体 alpha bbox `(32, 127, 1500, 870)`。
- B：1536×1024，RGBA，四角透明，主体 alpha bbox `(57, 122, 1480, 915)`。
