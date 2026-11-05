# Animated icons prototype

Framework-agnostic icon animations on the Web Animations API. No dependencies.

```sh
node experiments/animated-icons/build.mjs   # regenerates icons.js and preview.html
open experiments/animated-icons/preview.html
```

| File | Role |
| --- | --- |
| `build.mjs` | Makes core SVGs animation-ready: `<g data-solar-root>`, `pathLength="1"` and `data-part` roles (`PARTS` map). |
| `solar-animate.js` | Runtime: `play`, `stop`, `bind` (hover/click/appear/inView/loop), `autoBind` (`data-solar-*`), `swap` (transitions), `spring()` → CSS `linear()` easing. |
| `presets.js` | Generic presets (`wiggle`, `pop`, `bounce`, `spin`, `shake`, `draw`, `rebuild`, `layer-stagger`, `pulse`, `typing`) and 24 `signature:<icon>` animations from the "Chat and Messaging" reel. |
| `demo.js`, `index.html` | Demo page; `preview.html` is the self-contained build of it. |

Reel structure (≈0.9 s per icon): anticipate (details retract) → simplify (base silhouette) → rebuild (draw/pop back) → settle (overshoot to rest).

Respects `prefers-reduced-motion` (`config.respectReducedMotion`).
