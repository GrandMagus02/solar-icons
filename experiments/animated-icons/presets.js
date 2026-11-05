import { definePresets, deformPath, ease, spring } from './solar-animate.js'

// ---------------------------------------------------------------------------
// Keyframe helpers
// ---------------------------------------------------------------------------

const dash = (offset, opacity = 1, extra = {}) => ({
    strokeDasharray: '1 1',
    strokeDashoffset: offset,
    opacity,
    ...extra,
})

/** Stroke draws in from nothing (needs `pathLength="1"`, added by the build). */
const drawIn = [dash(1, 0), dash(1, 1, { offset: 0.04, easing: ease.out }), dash(0)]

/**
 * The move that carries the whole reel: a stroke retracts tail-first, stays hidden
 * for a beat while the container simplifies, then draws back in.
 */
const retractRebuild = [
    dash(0, 1, { easing: ease.in }),
    dash(-1, 1, { offset: 0.3 }),
    dash(-1, 0, { offset: 0.31 }),
    dash(1, 0, { offset: 0.44 }),
    dash(1, 1, { offset: 0.45, easing: ease.out }),
    dash(0),
]

/** Shrinks away, hides, then pops back with overshoot. */
const popBack = [
    { transform: 'scale(1)', opacity: 1, easing: ease.in },
    { transform: 'scale(0)', opacity: 0, offset: 0.3 },
    { transform: 'scale(0)', opacity: 0, offset: 0.45, easing: ease.back },
    { transform: 'scale(1.2)', opacity: 1, offset: 0.75 },
    { transform: 'scale(1)', opacity: 1 },
]

/** Solid stroke breaks into dashes while spinning, then closes back up. */
const dashedSpin = [
    { strokeDasharray: '1 0', transform: 'rotate(0deg)', easing: ease.inOut },
    { strokeDasharray: '0.045 0.035', transform: 'rotate(-200deg)', offset: 0.45 },
    { strokeDasharray: '1 0', transform: 'rotate(-360deg)' },
]

const wobble = (deg = 16) => [
    { transform: 'rotate(0deg)', easing: ease.out },
    { transform: `rotate(${-deg}deg)`, offset: 0.3, easing: ease.inOut },
    { transform: `rotate(${deg * 0.5}deg)`, offset: 0.6, easing: ease.inOut },
    { transform: `rotate(${-deg * 0.2}deg)`, offset: 0.82, easing: ease.inOut },
    { transform: 'rotate(0deg)' },
]

const squash = (sx = 1.1, sy = 0.86) => [
    { transform: 'scale(1, 1)', easing: ease.out },
    { transform: `scale(${sx}, ${sy})`, offset: 0.3, easing: ease.inOut },
    { transform: `scale(${2 - sx}, ${2 - sy})`, offset: 0.6, easing: ease.inOut },
    { transform: 'scale(1, 1)' },
]

/**
 * Frames for a seamless cartoon-flame loop on one path. Points are displaced by
 * height: the base stays planted, the tip sways, licks sideways and stretches up,
 * and the body breathes in width. Every term is zero at t = 0, so the first and
 * last frames are the untouched icon and the loop can start or stop without a jump.
 */
function flameFrames(el, { frames = 16, sway = 0.05, stretch = 0.06, breathe = 0.06, phase = 0, dir = 1 } = {}) {
    el.__solarD ??= el.getAttribute('d')
    const box = el.getBBox()
    const base = box.y + box.height
    const cx = box.x + box.width / 2
    const h = box.height
    const TAU = Math.PI * 2

    return Array.from({ length: frames + 1 }, (_, f) => {
        const t = (f / frames) * TAU
        return deformPath(el.__solarD, (x, y) => {
            const k = Math.min(1, Math.max(0, (base - y) / h)) // 0 at the base, 1 at the tip
            const w = k * k
            const a = phase + k * 2.2
            const b = phase * 1.7 + k * 4 + 1
            // Slow sway plus a quicker lick, offset so both start at zero.
            const swing = Math.sin(t + a) - Math.sin(a) + 0.35 * (Math.sin(3 * t + b) - Math.sin(b))
            const lift = 0.5 - 0.5 * Math.cos(2 * t)
            const pulse = Math.sin(2 * t)
            return [
                x + dir * sway * h * w * swing + (x - cx) * breathe * k * pulse,
                y - stretch * h * w * lift,
            ]
        })
    })
}

const D = 900 // base duration of a signature animation (the reel runs ~0.9s per icon)

// ---------------------------------------------------------------------------
// Generic presets: work on any icon, no per-icon data required
// ---------------------------------------------------------------------------

definePresets({
    wiggle: ({ root }) => [{ targets: root, origin: '12 12', duration: 650, keyframes: wobble(12) }],

    pop: ({ root }) => {
        const sp = spring({ stiffness: 320, damping: 11 })
        return [
            {
                targets: root,
                origin: '12 12',
                duration: sp.duration,
                easing: sp.easing,
                keyframes: [{ transform: 'scale(0.7)' }, { transform: 'scale(1)' }],
            },
        ]
    },

    bounce: ({ root }) => [
        {
            targets: root,
            origin: '12 22',
            duration: 700,
            keyframes: [
                { transform: 'translateY(0) scale(1, 1)', easing: ease.out },
                { transform: 'translateY(-4px) scale(0.94, 1.06)', offset: 0.35, easing: ease.in },
                { transform: 'translateY(0) scale(1.08, 0.9)', offset: 0.6, easing: ease.out },
                { transform: 'translateY(-1px) scale(1, 1)', offset: 0.8, easing: ease.in },
                { transform: 'translateY(0) scale(1, 1)' },
            ],
        },
    ],

    spin: ({ root }) => [
        {
            targets: root,
            origin: '12 12',
            duration: 700,
            easing: ease.inOut,
            keyframes: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        },
    ],

    shake: ({ root }) => [
        {
            targets: root,
            origin: '12 12',
            duration: 500,
            keyframes: [0, -3, 3, -2, 2, -1, 0].map(x => ({ transform: `translateX(${x}px)` })),
        },
    ],

    /** Appear: every stroke draws in, staggered. */
    draw: ({ all }) => [
        { targets: all, duration: 650, stagger: 90, easing: 'linear', origin: false, keyframes: drawIn },
    ],

    /** Generic version of the reel: container squashes, details retract and rebuild. */
    rebuild: ctx => [
        { targets: ctx.root, origin: '12 12', duration: D, keyframes: squash(1.06, 0.9) },
        { targets: ctx.details, duration: D, stagger: 60, origin: false, keyframes: retractRebuild },
    ],

    /** Duotone: the secondary layer lifts off and settles back. */
    'layer-stagger': ({ secondary, all }) => [
        {
            targets: secondary.length ? secondary : all.slice(1),
            origin: 'center',
            duration: 700,
            stagger: 80,
            keyframes: [
                { transform: 'translate(0, 0)', easing: ease.out },
                { transform: 'translate(1.5px, -1.5px)', offset: 0.4, easing: ease.inOut },
                { transform: 'translate(0, 0)' },
            ],
        },
    ],

    /** Loop-friendly heartbeat for unread / live states. */
    pulse: ({ root }) => [
        {
            targets: root,
            origin: '12 12',
            duration: 900,
            keyframes: [
                { transform: 'scale(1)', easing: ease.out },
                { transform: 'scale(1.12)', offset: 0.15, easing: ease.in },
                { transform: 'scale(1)', offset: 0.3, easing: ease.out },
                { transform: 'scale(1.08)', offset: 0.45, easing: ease.in },
                { transform: 'scale(1)', offset: 0.65 },
                { transform: 'scale(1)' },
            ],
        },
    ],

    /**
     * Ambient cartoon fire: every path morphs on a seamless loop. Inner flames get
     * a different phase and opposite sway so they don't move in lockstep.
     */
    flicker: ({ all }) =>
        all.map((el, i) => ({
            targets: el,
            origin: false,
            duration: 1400,
            iterations: Infinity,
            keyframes: flameFrames(
                el,
                i === 0
                    ? {}
                    : { sway: 0.09, stretch: 0.1, breathe: 0.08, phase: 1.9 * i, dir: i % 2 ? -1 : 1 }
            ),
        })),

    /** Typing indicator: dots hop one after another. */
    typing: ({ parts }) => [
        {
            targets: parts('dot'),
            origin: 'center',
            duration: 520,
            stagger: 110,
            keyframes: [
                { transform: 'translateY(0)', easing: ease.out },
                { transform: 'translateY(-2.5px)', offset: 0.4, easing: ease.in },
                { transform: 'translateY(0)' },
            ],
        },
    ],
})

// ---------------------------------------------------------------------------
// Signature animations: one per icon, reproducing the "Chat and Messaging" reel.
// Part names come from PARTS in build.mjs.
// ---------------------------------------------------------------------------

const signatures = {
    'chat-round-warning': ({ root, part }) => [
        { targets: root, origin: '12 12', duration: D, keyframes: wobble(16) },
        { targets: part('bar'), duration: D, origin: false, keyframes: retractRebuild },
        { targets: part('dot'), origin: 'center', duration: D, delay: 60, keyframes: popBack },
    ],

    'restart-circle': ({ part }) => [
        { targets: part('ring'), origin: 'center', duration: D, keyframes: dashedSpin },
        {
            targets: part('arrow'),
            origin: 'center',
            duration: D,
            keyframes: [
                { transform: 'scale(1) rotate(0deg)', opacity: 1, easing: ease.in },
                { transform: 'scale(0) rotate(-120deg)', opacity: 0, offset: 0.35 },
                { transform: 'scale(0) rotate(-120deg)', opacity: 0, offset: 0.45, easing: ease.back },
                { transform: 'scale(1.15) rotate(10deg)', opacity: 1, offset: 0.78 },
                { transform: 'scale(1) rotate(0deg)', opacity: 1 },
            ],
        },
    ],

    'chat-round-unread': ({ part }) => [
        { targets: part('bubble'), origin: '12 12', duration: D, keyframes: wobble(20) },
        { targets: part('badge'), origin: 'center', duration: D, delay: 80, keyframes: popBack },
    ],

    'chat-square-arrow': ({ parts }) => [
        { targets: parts('bubble'), origin: '12 21', duration: D, keyframes: squash(1.08, 0.88) },
        {
            // The arrow flies out to the right and comes back in from the left.
            targets: parts('arrow'),
            origin: false,
            duration: D,
            keyframes: [
                { transform: 'translateX(0)', opacity: 1, easing: ease.in },
                { transform: 'translateX(6px)', opacity: 0, offset: 0.3 },
                { transform: 'translateX(-5px)', opacity: 0, offset: 0.45, easing: ease.back },
                { transform: 'translateX(0)', opacity: 1, offset: 0.8 },
                { transform: 'translateX(0)', opacity: 1 },
            ],
        },
    ],

    'chat-round-like': ({ part }) => [
        { targets: part('bubble'), origin: '12 12', duration: D, keyframes: wobble(8) },
        {
            targets: part('heart'),
            origin: 'center bottom',
            duration: D,
            keyframes: [
                { transform: 'scale(1)', easing: ease.in },
                { transform: 'scale(0)', offset: 0.3 },
                { transform: 'scale(0)', offset: 0.4, easing: ease.out },
                { transform: 'scale(1.3)', offset: 0.62, easing: ease.inOut },
                { transform: 'scale(0.9)', offset: 0.76, easing: ease.inOut },
                { transform: 'scale(1.06)', offset: 0.88, easing: ease.inOut },
                { transform: 'scale(1)' },
            ],
        },
    ],

    inbox: ({ root, part }) => [
        {
            targets: root,
            origin: '12 12',
            duration: D,
            keyframes: [
                { transform: 'rotate(0deg) scale(1, 1)', easing: ease.out },
                { transform: 'rotate(-18deg) scale(1.05, 0.88)', offset: 0.35, easing: ease.inOut },
                { transform: 'rotate(6deg) scale(0.97, 1.04)', offset: 0.68, easing: ease.inOut },
                { transform: 'rotate(0deg) scale(1, 1)' },
            ],
        },
        { targets: part('tray'), duration: D, origin: false, keyframes: retractRebuild },
    ],

    'user-speak-rounded': ({ part, parts }) => [
        {
            targets: part('head'),
            origin: 'center',
            duration: D,
            keyframes: [
                { transform: 'translateY(0)', easing: ease.out },
                { transform: 'translateY(2px)', offset: 0.3, easing: ease.inOut },
                { transform: 'translateY(-1.5px)', offset: 0.6, easing: ease.inOut },
                { transform: 'translateY(0)' },
            ],
        },
        { targets: part('body'), origin: 'center bottom', duration: D, keyframes: squash(1.08, 0.82) },
        { targets: [...parts('wave')].reverse(), duration: D, stagger: 90, origin: false, keyframes: retractRebuild },
    ],

    list: ({ parts }) => [
        {
            // Rows scroll out to the left and slide back in from the right.
            targets: parts('row'),
            origin: false,
            duration: D,
            stagger: 70,
            keyframes: [
                { transform: 'translateX(0)', opacity: 1, easing: ease.in },
                { transform: 'translateX(-8px)', opacity: 0, offset: 0.3 },
                { transform: 'translateX(8px)', opacity: 0, offset: 0.42, easing: ease.out },
                { transform: 'translateX(0)', opacity: 1 },
            ],
        },
    ],

    'user-circle': ({ part }) => [
        { targets: part('ring'), origin: 'center', duration: D, keyframes: dashedSpin },
        { targets: part('head'), origin: 'center', duration: D, delay: 40, keyframes: popBack },
        { targets: part('body'), duration: D, origin: false, keyframes: retractRebuild },
    ],

    'chat-round': ({ root }) => [
        {
            targets: root,
            origin: '12 12',
            duration: D,
            keyframes: [
                { transform: 'scale(1) rotate(0deg)', easing: ease.in },
                { transform: 'scale(0.6) rotate(-14deg)', offset: 0.35, easing: ease.out },
                { transform: 'scale(1.12) rotate(4deg)', offset: 0.65, easing: ease.inOut },
                { transform: 'scale(0.96) rotate(0deg)', offset: 0.82, easing: ease.inOut },
                { transform: 'scale(1) rotate(0deg)' },
            ],
        },
    ],

    'star-circle': ({ part }) => [
        {
            // 216deg = 3 x 72deg, so the star lands on an identical pose.
            targets: part('star'),
            origin: 'center',
            duration: D,
            keyframes: [
                { transform: 'rotate(0deg) scale(1)', easing: ease.in },
                { transform: 'rotate(90deg) scale(0.5)', offset: 0.35, easing: ease.out },
                { transform: 'rotate(200deg) scale(1.2)', offset: 0.72, easing: ease.inOut },
                { transform: 'rotate(216deg) scale(1)' },
            ],
        },
        { targets: part('ring'), origin: 'center', duration: D, keyframes: squash(1.05, 0.95) },
    ],

    'pen-new-round': ({ part }) => [
        {
            // The pen lifts out of the bubble while the bubble redraws underneath it.
            targets: part('pen'),
            origin: 'center',
            duration: D,
            keyframes: [
                { transform: 'translate(0, 0) rotate(0deg)', easing: ease.out },
                { transform: 'translate(2px, -2.5px) rotate(14deg)', offset: 0.35, easing: ease.inOut },
                { transform: 'translate(-0.5px, 0.5px) rotate(-6deg)', offset: 0.7, easing: ease.inOut },
                { transform: 'translate(0, 0) rotate(0deg)' },
            ],
        },
        { targets: part('arc'), duration: D, origin: false, keyframes: retractRebuild },
    ],

    'pen-2': ({ part }) => [
        { targets: part('pen'), origin: 'left bottom', duration: D, keyframes: wobble(14) },
        { targets: part('base'), duration: D, delay: 80, origin: false, keyframes: retractRebuild },
    ],

    'chat-round-quote': ({ part, parts }) => [
        { targets: part('bubble'), origin: '12 12', duration: D, keyframes: wobble(8) },
        { targets: parts('quote'), origin: 'center', duration: D, stagger: 90, keyframes: popBack },
    ],

    'chat-round-question-mark': ({ part }) => [
        {
            targets: part('hook'),
            origin: 'center top',
            duration: D,
            keyframes: [
                { transform: 'rotate(0deg)', easing: ease.out },
                { transform: 'rotate(28deg)', offset: 0.28, easing: ease.inOut },
                { transform: 'rotate(-18deg)', offset: 0.55, easing: ease.inOut },
                { transform: 'rotate(7deg)', offset: 0.78, easing: ease.inOut },
                { transform: 'rotate(0deg)' },
            ],
        },
        {
            targets: part('dot'),
            origin: 'center',
            duration: D * 0.6,
            delay: 160,
            keyframes: [
                { transform: 'translateY(0)', easing: ease.out },
                { transform: 'translateY(-3px)', offset: 0.4, easing: ease.in },
                { transform: 'translateY(0)' },
            ],
        },
        { targets: part('bubble'), origin: '12 21', duration: D, keyframes: squash(1.05, 0.93) },
    ],

    'chat-round-money': ({ part }) => [
        {
            // Coin flip: scaleX through zero to -1 and back.
            targets: part('sign'),
            origin: 'center',
            duration: D,
            keyframes: [
                { transform: 'scaleX(1)', easing: ease.in },
                { transform: 'scaleX(-1)', offset: 0.45, easing: ease.out },
                { transform: 'scaleX(1)' },
            ],
        },
        { targets: part('bubble'), origin: '12 12', duration: D, keyframes: wobble(10) },
    ],

    translation: ({ part }) => [
        {
            // A ripple from the core outwards.
            targets: [part('core'), part('inner'), part('outer')],
            origin: '12 12',
            duration: D * 0.8,
            stagger: 110,
            keyframes: [
                { transform: 'scale(1)', opacity: 1, easing: ease.in },
                { transform: 'scale(0.55)', opacity: 0.2, offset: 0.35, easing: ease.out },
                { transform: 'scale(1.12)', opacity: 1, offset: 0.7, easing: ease.inOut },
                { transform: 'scale(1)', opacity: 1 },
            ],
        },
    ],

    'link-circle': ({ part }) => [
        {
            // The two halves are point-symmetric, so a 180deg turn lands seamlessly.
            targets: [part('left'), part('right')],
            origin: '12 12',
            duration: D,
            keyframes: (_el, i) => {
                const apart = i === 0 ? -2.5 : 2.5
                return [
                    { transform: 'rotate(0deg) translateX(0)', easing: ease.in },
                    { transform: `rotate(70deg) translateX(${apart}px)`, offset: 0.4, easing: ease.out },
                    { transform: 'rotate(170deg) translateX(0)', offset: 0.8, easing: ease.inOut },
                    { transform: 'rotate(180deg) translateX(0)' },
                ]
            },
        },
    ],

    'letter-unread': ({ part }) => [
        {
            // The flap folds up around its top edge.
            targets: part('flap'),
            origin: 'center top',
            duration: D,
            keyframes: [
                { transform: 'scaleY(1)', easing: ease.inOut },
                { transform: 'scaleY(-1)', offset: 0.4 },
                { transform: 'scaleY(-1)', offset: 0.5, easing: ease.inOut },
                { transform: 'scaleY(1)' },
            ],
        },
        { targets: part('envelope'), origin: '12 20', duration: D, keyframes: squash(1.05, 0.92) },
        { targets: part('badge'), origin: 'center', duration: D, delay: 120, keyframes: popBack },
    ],

    'chat-round-code': ({ part }) => [
        {
            targets: [part('left'), part('right')],
            origin: 'center',
            duration: D,
            keyframes: (_el, i) => {
                const x = i === 0 ? -2.5 : 2.5
                return [
                    { transform: 'translateX(0)', easing: ease.out },
                    { transform: `translateX(${x}px)`, offset: 0.35, easing: ease.inOut },
                    { transform: `translateX(${-x * 0.3}px)`, offset: 0.7, easing: ease.inOut },
                    { transform: 'translateX(0)' },
                ]
            },
        },
        {
            targets: part('slash'),
            origin: 'center',
            duration: D,
            easing: ease.inOut,
            keyframes: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }],
        },
    ],

    'chat-round-dots': ({ parts, part }) => [
        { targets: part('bubble'), origin: '12 21', duration: D, keyframes: squash(1.06, 0.92) },
        {
            targets: parts('dot'),
            origin: 'center',
            duration: D * 0.45,
            stagger: 90,
            iterations: 2,
            keyframes: [
                { transform: 'translateY(0)', easing: ease.out },
                { transform: 'translateY(-3px)', offset: 0.4, easing: ease.in },
                { transform: 'translateY(0)' },
            ],
        },
    ],

    'chat-round-line': ({ part, parts }) => [
        { targets: part('bubble'), origin: '12 12', duration: D, keyframes: wobble(10) },
        { targets: parts('line'), duration: D, stagger: 80, origin: false, keyframes: retractRebuild },
    ],

    fire: ({ part }) => [
        {
            targets: part('outer'),
            origin: 'center bottom',
            duration: D,
            keyframes: [
                { transform: 'skewX(0deg) scaleY(1)', easing: ease.inOut },
                { transform: 'skewX(-8deg) scaleY(0.9)', offset: 0.25, easing: ease.inOut },
                { transform: 'skewX(6deg) scaleY(1.06)', offset: 0.5, easing: ease.inOut },
                { transform: 'skewX(-2deg) scaleY(0.98)', offset: 0.75, easing: ease.inOut },
                { transform: 'skewX(0deg) scaleY(1)' },
            ],
        },
        {
            targets: part('inner'),
            origin: 'center bottom',
            duration: D,
            keyframes: [
                { transform: 'scale(1)', easing: ease.in },
                { transform: 'scale(0.2)', offset: 0.3, easing: ease.out },
                { transform: 'scale(1.25)', offset: 0.65, easing: ease.inOut },
                { transform: 'scale(1)' },
            ],
        },
    ],

    'mention-circle': ({ part }) => [
        { targets: part('ring'), origin: 'center', duration: D, keyframes: dashedSpin },
        { targets: part('at'), duration: D, origin: false, keyframes: retractRebuild },
    ],
}

definePresets(
    Object.fromEntries(Object.entries(signatures).map(([name, fn]) => [`signature:${name}`, fn]))
)

/** Order of the 4x6 grid in the reel. */
export const REEL = Object.keys(signatures)
