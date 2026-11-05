// Framework-agnostic animation runtime for Solar icons.
//
// Everything runs on the Web Animations API: no dependencies, works the same in
// React, Vue, Svelte, Solid, Angular or plain HTML. Frameworks only need to render
// the SVG (with `data-solar-root` / `data-part` markers from the build step) and call
// `play`, `bind` or `swap`, or set `data-solar-*` attributes and call `autoBind`.

const reducedMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

const GEOMETRY = 'path, circle, ellipse, rect, line, polyline, polygon'
const IDENTITY_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'transform']

export const config = {
    speed: 1,
    respectReducedMotion: true,
}

export const presets = {}

export function definePresets(map) {
    Object.assign(presets, map)
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

export const ease = {
    in: 'cubic-bezier(0.55, 0, 0.75, 0.2)',
    out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    back: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

const springCache = new Map()

/**
 * Simulates a damped spring and returns a CSS `linear()` easing plus the duration
 * it takes to settle. Use with two-keyframe animations: the overshoot is baked
 * into the easing curve, so `scale(0) -> scale(1)` overshoots past 1 on its own.
 */
export function spring({ stiffness = 220, damping = 14, mass = 1 } = {}) {
    const key = `${stiffness}/${damping}/${mass}`
    const cached = springCache.get(key)
    if (cached) return cached

    const step = 1 / 600
    const sampleEvery = 10 // one sample per 1/60 s
    let x = 0
    let v = 0
    let t = 0
    let i = 0
    let restFor = 0
    const samples = [0]

    while (t < 4) {
        const a = (-stiffness * (x - 1) - damping * v) / mass
        v += a * step
        x += v * step
        t += step
        i++
        if (i % sampleEvery === 0) samples.push(x)
        restFor = Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02 ? restFor + step : 0
        if (restFor > 0.05) break
    }
    samples.push(1)

    const result = {
        easing: `linear(${samples.map(s => +s.toFixed(4)).join(', ')})`,
        duration: Math.round(t * 1000),
    }
    springCache.set(key, result)
    return result
}

// ---------------------------------------------------------------------------
// Context: how presets address parts of an icon
// ---------------------------------------------------------------------------

function rootOf(svg) {
    return svg.querySelector('[data-solar-root]') ?? svg
}

export function context(svg) {
    const root = rootOf(svg)
    const all = [...root.querySelectorAll(GEOMETRY)]
    const cache = new Map()
    const parts = name => {
        if (!cache.has(name)) cache.set(name, all.filter(el => el.dataset.part === name))
        return cache.get(name)
    }
    return {
        svg,
        root,
        all,
        name: svg.dataset.solarIcon,
        parts,
        part: name => parts(name)[0],
        /** Elements drawn with the duotone secondary opacity. */
        secondary: all.filter(el => el.hasAttribute('opacity')),
        /** Longest element: a cheap guess at the "container" (bubble, ring, box). */
        get container() {
            return all.reduce((best, el) => (length(el) > length(best) ? el : best), all[0])
        },
        get details() {
            const c = this.container
            return all.filter(el => el !== c)
        },
    }
}

function length(el) {
    try {
        return el.getTotalLength()
    } catch {
        return 0
    }
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

const running = new WeakMap()

function applyOrigin(el, origin = 'center') {
    // `view-box` origins are given in the icon's 24x24 coordinate space ("12 12"),
    // anything else is resolved against the element's own bounding box.
    const match = /^(-?[\d.]+)\s+(-?[\d.]+)$/.exec(origin)
    if (match) {
        el.style.transformBox = 'view-box'
        el.style.transformOrigin = `${match[1]}px ${match[2]}px`
    } else {
        el.style.transformBox = 'fill-box'
        el.style.transformOrigin = origin
    }
}

// ---------------------------------------------------------------------------
// Constant stroke width under scale
// ---------------------------------------------------------------------------
//
// A CSS scale() on an SVG shape scales its stroke too, so a flame growing from
// scale(0.2) would start with a hairline and overshoot with a heavy line.
// `vector-effect: non-scaling-stroke` is not an option: it pins strokes to screen
// pixels and breaks em-based icon sizing. Instead, while an icon has animations,
// every frame we read each shape's accumulated scale (its own transform and its
// ancestors' up to the icon) and counter-scale `stroke-width`. Reading computed
// transforms makes this exact for any keyframes, easing, spring or scrubbed time.

const MIN_SCALE = 0.05
const tracked = new WeakSet()

function scaleOf(el) {
    const t = getComputedStyle(el).transform
    if (!t || t === 'none') return [1, 1]
    const m = new DOMMatrixReadOnly(t)
    return [Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)]
}

function strokeScale(el, svg) {
    let sx = 1
    let sy = 1
    for (let node = el; node && node !== svg; node = node.parentElement) {
        const [x, y] = scaleOf(node)
        sx *= x
        sy *= y
    }
    // Near-uniform scales (squash & stretch) use the geometric mean. Strongly
    // anisotropic ones (a coin flip through scaleX(0)) use the larger axis, so
    // the stroke thins along the collapsing axis like a real edge-on shape
    // instead of ballooning.
    const lo = Math.min(sx, sy)
    const hi = Math.max(sx, sy)
    return lo / hi >= 0.5 ? Math.sqrt(sx * sy) : hi
}

function baseStroke(el) {
    if (el.__solarStroke === undefined) {
        el.__solarStroke = parseFloat(el.getAttribute('stroke-width') ?? getComputedStyle(el).strokeWidth) || 0
    }
    return el.__solarStroke
}

function trackStrokes(svg) {
    if (tracked.has(svg)) return
    tracked.add(svg)
    const tick = () => {
        const shapes = [...svg.querySelectorAll(GEOMETRY)]
        // Ambient loops that never touch transforms (path morphs) don't keep this alive.
        if (!svg.getAnimations({ subtree: true }).some(a => a.__solarTransforms !== false)) {
            shapes.forEach(el => el.style.removeProperty('stroke-width'))
            tracked.delete(svg)
            return
        }
        for (const el of shapes) {
            const base = baseStroke(el)
            if (!base) continue
            const s = strokeScale(el, svg)
            if (Math.abs(s - 1) < 0.001) el.style.removeProperty('stroke-width')
            else el.style.strokeWidth = String(base / Math.max(s, MIN_SCALE))
        }
        requestAnimationFrame(tick)
    }
    tick()
}

// ---------------------------------------------------------------------------
// Path morphing
// ---------------------------------------------------------------------------
//
// Shape changes (a flickering flame) animate the path's `d`. Frames must share the
// command structure of the original path, which `deformPath` guarantees by moving
// points rather than rewriting commands. Browsers that can animate the CSS `d`
// property get a real WAAPI animation (pausable, scrubbable, cancellable); the rest
// get a requestAnimationFrame interpolator exposing the same small surface.

const PATH_TOKEN = /([MLCSQTHVZ])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi
const ARITY = { M: 2, L: 2, C: 6, S: 4, Q: 4, T: 2, Z: 0 }

/** Absolute-command path -> segments with explicit point pairs (H/V become L). */
export function parsePath(d) {
    const segments = []
    let cmd = null
    let numbers = []
    let x = 0
    let y = 0
    const flush = () => {
        if (!cmd) return
        if (cmd === 'H' || cmd === 'V') {
            for (const n of numbers) {
                if (cmd === 'H') x = n
                else y = n
                segments.push({ cmd: 'L', values: [x, y] })
            }
        } else if (cmd === 'Z') {
            segments.push({ cmd: 'Z', values: [] })
        } else {
            const arity = ARITY[cmd]
            for (let i = 0; i < numbers.length; i += arity) {
                const values = numbers.slice(i, i + arity)
                segments.push({ cmd: cmd === 'M' && i > 0 ? 'L' : cmd, values })
                x = values[arity - 2]
                y = values[arity - 1]
            }
        }
        numbers = []
    }
    for (const [, command, number] of d.matchAll(PATH_TOKEN)) {
        if (command) {
            if (command !== command.toUpperCase()) throw new Error(`Relative path command "${command}" is not supported`)
            flush()
            cmd = command
            if (cmd === 'Z') flush()
        } else {
            numbers.push(parseFloat(number))
        }
    }
    flush()
    return segments
}

const serialize = segments =>
    segments.map(s => s.cmd + s.values.map(v => +v.toFixed(3)).join(' ')).join('')

/** Moves every point of a path through `fn(x, y) => [x, y]`, keeping its structure. */
export function deformPath(d, fn) {
    return serialize(
        parsePath(d).map(({ cmd, values }) => {
            const out = []
            for (let i = 0; i < values.length; i += 2) out.push(...fn(values[i], values[i + 1]))
            return { cmd, values: out }
        })
    )
}

export const supportsPathAnimation =
    typeof CSS !== 'undefined' && !!CSS.supports?.('d', 'path("M0 0")')

function animatePathFallback(el, frames, { duration, delay = 0, iterations = 1, easing }) {
    // Only linear interpolation between frames: presets that morph supply enough
    // frames to be smooth, so the per-segment easing isn't needed here.
    const parsed = frames.map(d => parsePath(d))
    const original = el.getAttribute('d')
    const segments = parsed.length - 1
    let start = null
    let raf = 0
    let resolve
    const finished = new Promise(r => (resolve = r))
    const frame = now => {
        start ??= now
        const elapsed = now - start - delay
        if (elapsed < 0) {
            raf = requestAnimationFrame(frame)
            return
        }
        const cycles = elapsed / duration
        if (cycles >= iterations) {
            el.setAttribute('d', original)
            resolve()
            return
        }
        const t = (cycles % 1) * segments
        const i = Math.min(Math.floor(t), segments - 1)
        const k = t - i
        const a = parsed[i]
        const b = parsed[i + 1]
        el.setAttribute(
            'd',
            serialize(a.map((seg, n) => ({ cmd: seg.cmd, values: seg.values.map((v, j) => v + (b[n].values[j] - v) * k) })))
        )
        raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    void easing
    return {
        finished,
        cancel() {
            cancelAnimationFrame(raf)
            el.setAttribute('d', original)
            resolve()
        },
    }
}

function animateTrack(el, keyframes, timing) {
    const morph = Array.isArray(keyframes) && keyframes.length && typeof keyframes[0] === 'string'
    if (!morph) {
        const animation = el.animate(keyframes, timing)
        animation.__solarTransforms = [keyframes].flat().some(k => k && 'transform' in k)
        return animation
    }
    if (!supportsPathAnimation) return animatePathFallback(el, keyframes, timing)
    const animation = el.animate(
        keyframes.map(d => ({ d: `path("${d}")` })),
        timing
    )
    animation.__solarTransforms = false
    return animation
}

/** Cancels an icon's animations. Ambient loops live on their own layer. */
export function stop(svg, layer = 'main') {
    const layers = running.get(svg)
    for (const animation of layers?.get(layer) ?? []) animation.cancel()
    layers?.delete(layer)
}

export function isReduced() {
    return config.respectReducedMotion && !!reducedMotion?.matches
}

/**
 * Plays a preset on an icon. Resolves when every track has finished.
 * A preset is a function `(ctx, options) => Track[]` where a track is
 * `{ targets, keyframes, duration, delay?, stagger?, easing?, origin?, iterations? }`.
 * `keyframes` may also be an array of path strings, which morphs the shape.
 *
 * `options.layer` (default "main") lets an ambient loop (`layer: 'ambient'`) keep
 * running underneath hover/click animations, which only replace their own layer.
 */
export function play(svg, preset, options = {}) {
    const def = typeof preset === 'function' ? preset : resolvePreset(svg, preset)
    if (!def) return Promise.resolve()
    if (isReduced() && !options.force) return Promise.resolve()

    const layer = options.layer ?? 'main'
    stop(svg, layer)
    const speed = (options.speed ?? 1) * config.speed
    const tracks = def(context(svg), options).filter(Boolean)
    const animations = []

    for (const track of tracks) {
        const targets = [track.targets].flat().filter(Boolean)
        targets.forEach((el, index) => {
            if (track.origin !== false) applyOrigin(el, track.origin)
            const keyframes =
                typeof track.keyframes === 'function' ? track.keyframes(el, index) : track.keyframes
            animations.push(
                animateTrack(el, keyframes, {
                    duration: track.duration / speed,
                    delay: ((track.delay ?? 0) + index * (track.stagger ?? 0)) / speed,
                    easing: track.easing ?? 'linear',
                    iterations: track.iterations ?? 1,
                    direction: track.direction ?? 'normal',
                    fill: track.fill ?? 'backwards',
                    composite: track.composite ?? 'replace',
                })
            )
        })
    }

    if (!running.has(svg)) running.set(svg, new Map())
    running.get(svg).set(layer, animations)
    trackStrokes(svg)
    return Promise.all(animations.map(a => a.finished)).then(
        () => undefined,
        () => undefined // cancelled by a newer play()
    )
}

function resolvePreset(svg, name) {
    if (!name) return null
    // `signature` resolves to the icon's own animation, falling back to `rebuild`.
    if (name === 'signature') return presets[`signature:${svg.dataset.solarIcon}`] ?? presets.rebuild
    return presets[name] ?? null
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

/**
 * Wires triggers to an icon. `target` is the element that receives pointer events,
 * which lets a whole button animate its icon ("group hover"). Returns a cleanup fn.
 *
 *   bind(svg, { hover: 'wiggle', click: 'signature', appear: 'draw', loop: 'pulse' })
 *
 * `loop` replays a one-shot preset with a pause between runs; `ambient` starts a
 * preset that loops by itself (e.g. `flicker`). Both run on the ambient layer, so
 * hover and click animations play on top of them instead of cancelling them.
 */
export function bind(svg, triggers = {}) {
    const host = triggers.target ?? svg
    const cleanups = []
    const on = (type, fn) => {
        host.addEventListener(type, fn)
        cleanups.push(() => host.removeEventListener(type, fn))
    }

    if (triggers.hover) on('pointerenter', () => play(svg, triggers.hover))
    if (triggers.click) on('click', () => play(svg, triggers.click))
    if (triggers.appear) play(svg, triggers.appear)

    if (triggers.inView && typeof IntersectionObserver === 'function') {
        // Hide until visible so the draw-in doesn't flash the finished icon first.
        rootOf(svg).style.opacity = '0'
        const observer = new IntersectionObserver(entries => {
            if (!entries.some(e => e.isIntersecting)) return
            observer.disconnect()
            rootOf(svg).style.opacity = ''
            play(svg, triggers.inView)
        }, { threshold: 0.6 })
        observer.observe(svg)
        cleanups.push(() => observer.disconnect())
    }

    if (triggers.loop) {
        let alive = true
        const gap = triggers.loopGap ?? 400
        const tick = () => {
            if (!alive) return
            play(svg, triggers.loop, { layer: 'ambient' }).then(() => {
                if (alive) setTimeout(tick, gap)
            })
        }
        tick()
        cleanups.push(() => {
            alive = false
            stop(svg, 'ambient')
        })
    }

    if (triggers.ambient) {
        play(svg, triggers.ambient, { layer: 'ambient' })
        cleanups.push(() => stop(svg, 'ambient'))
    }

    return () => cleanups.forEach(fn => fn())
}

/**
 * Declarative wiring for any framework or plain HTML:
 *
 *   <button data-solar-group>
 *     <svg data-solar-icon="chat-round" data-solar-hover="wiggle" data-solar-click="signature">…</svg>
 *   </button>
 */
export function autoBind(scope = document) {
    const cleanups = []
    for (const svg of scope.querySelectorAll('svg[data-solar-icon]')) {
        const d = svg.dataset
        if (!(d.solarHover || d.solarClick || d.solarAppear || d.solarInView || d.solarLoop || d.solarAmbient)) continue
        cleanups.push(
            bind(svg, {
                target: svg.closest('[data-solar-group]') ?? svg,
                hover: d.solarHover,
                click: d.solarClick,
                appear: d.solarAppear,
                inView: d.solarInView,
                loop: d.solarLoop,
                ambient: d.solarAmbient,
            })
        )
    }
    return () => cleanups.forEach(fn => fn())
}

// ---------------------------------------------------------------------------
// Transitions between icons
// ---------------------------------------------------------------------------

function identity(el) {
    return `${el.tagName}|${IDENTITY_ATTRS.map(a => el.getAttribute(a) ?? '').join('|')}`
}

function parseRoot(markup) {
    // The HTML parser handles inline SVG and is forgiving about attribute syntax,
    // unlike DOMParser's XML mode.
    const template = document.createElement('template')
    template.innerHTML = markup.trim()
    const svg = template.content.querySelector('svg')
    return { svg, root: rootOf(svg) }
}

const finished = animations => Promise.all(animations.map(a => a.finished)).catch(() => {})

/**
 * Replaces the icon inside `svg` with `markup`.
 *
 * - `shared` (default when icons have geometry in common): parts present in both
 *   icons stay put, outgoing details un-draw, incoming details draw/pop in, and the
 *   shared container gets a small squash. Solar families (chat-round-*, chat-square-*,
 *   letter-*, …) share their container paths, so this applies across most of the set.
 * - `fade`: generic scale/rotate/blur cross-swap for unrelated icons.
 */
export async function swap(svg, markup, { mode = 'auto', speed = 1 } = {}) {
    const s = speed * config.speed
    const next = parseRoot(markup)
    const current = rootOf(svg)
    const nextKeys = new Set([...next.root.querySelectorAll(GEOMETRY)].map(identity))
    const currentEls = [...current.querySelectorAll(GEOMETRY)]
    const currentKeys = new Set(currentEls.map(identity))
    const leaving = currentEls.filter(el => !nextKeys.has(identity(el)))
    const sharedCount = currentEls.length - leaving.length

    if (mode === 'auto') mode = sharedCount > 0 ? 'shared' : 'fade'
    stop(svg)

    const commit = () => {
        const imported = document.importNode(next.root, true)
        current.replaceWith(imported)
        svg.dataset.solarIcon = next.svg.dataset.solarIcon ?? ''
        svg.setAttribute('class', next.svg.getAttribute('class') ?? '')
        return imported
    }

    if (isReduced()) {
        commit()
        return
    }

    if (mode === 'shared') {
        await finished(
            leaving.map((el, i) =>
                el.animate(
                    [
                        { strokeDasharray: '1 1', strokeDashoffset: 0, opacity: 1 },
                        { strokeDasharray: '1 1', strokeDashoffset: -1, opacity: 0 },
                    ],
                    { duration: 200 / s, delay: (i * 40) / s, easing: ease.in, fill: 'forwards' }
                )
            )
        )
        const root = commit()
        const entering = [...root.querySelectorAll(GEOMETRY)].filter(
            el => !currentKeys.has(identity(el))
        )
        const shared = [...root.querySelectorAll(GEOMETRY)].filter(el =>
            currentKeys.has(identity(el))
        )
        const sp = spring({ stiffness: 260, damping: 13 })

        shared.forEach(el => {
            applyOrigin(el, '12 12')
            el.animate([{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }], {
                duration: sp.duration / s,
                easing: sp.easing,
            })
        })
        trackStrokes(svg)
        await finished(
            entering.flatMap((el, i) => {
                applyOrigin(el, 'center')
                const delay = (60 + i * 70) / s
                return [
                    el.animate(
                        [
                            { strokeDasharray: '1 1', strokeDashoffset: 1, opacity: 0 },
                            { strokeDasharray: '1 1', strokeDashoffset: 1, opacity: 1, offset: 0.05 },
                            { strokeDasharray: '1 1', strokeDashoffset: 0, opacity: 1 },
                        ],
                        { duration: 340 / s, delay, easing: ease.out, fill: 'backwards' }
                    ),
                    el.animate([{ transform: 'scale(0.4)' }, { transform: 'scale(1)' }], {
                        duration: sp.duration / s,
                        delay,
                        easing: sp.easing,
                        fill: 'backwards',
                    }),
                ]
            })
        )
        return
    }

    // fade
    applyOrigin(current, '12 12')
    const outgoing = [
        current.animate(
            [
                { transform: 'scale(1) rotate(0deg)', opacity: 1 },
                { transform: 'scale(0.5) rotate(-45deg)', opacity: 0 },
            ],
            { duration: 160 / s, easing: ease.in, fill: 'forwards' }
        ),
        svg.animate([{ filter: 'blur(0px)' }, { filter: 'blur(2px)' }], {
            duration: 160 / s,
            fill: 'forwards',
        }),
    ]
    trackStrokes(svg)
    await finished(outgoing)
    const root = commit()
    applyOrigin(root, '12 12')
    const sp = spring({ stiffness: 240, damping: 15 })
    svg.getAnimations().forEach(a => a.cancel())
    const incoming = [
        root.animate(
            [
                { transform: 'scale(0.5) rotate(45deg)', opacity: 0 },
                { transform: 'scale(1) rotate(0deg)', opacity: 1 },
            ],
            { duration: sp.duration / s, easing: sp.easing }
        ),
        svg.animate([{ filter: 'blur(2px)' }, { filter: 'blur(0px)' }], { duration: 160 / s }),
    ]
    trackStrokes(svg)
    await finished(incoming)
}
