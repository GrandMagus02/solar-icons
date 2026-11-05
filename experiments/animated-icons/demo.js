import { icons } from './icons.js'
import { autoBind, bind, config, play, swap } from './solar-animate.js'
import { REEL } from './presets.js'

const $ = id => document.getElementById(id)

function icon(name, data = {}) {
    const template = document.createElement('template')
    template.innerHTML = icons[name].trim()
    const svg = template.content.firstElementChild
    for (const [key, value] of Object.entries(data)) svg.dataset[key] = value
    return svg
}

// ---- Reel ------------------------------------------------------------------

// Icons that stay alive between interactions.
const AMBIENT = { fire: 'flicker' }

const reel = $('reel')
const reelIcons = REEL.map(name => {
    const cell = document.createElement('div')
    cell.className = 'cell'
    const svg = icon(name)
    const caption = document.createElement('span')
    caption.textContent = name
    cell.append(svg, caption)
    reel.append(cell)
    bind(svg, { hover: 'signature', click: 'signature', ambient: AMBIENT[name] })
    return svg
})

const playAll = (stagger = 0) =>
    Promise.all(
        reelIcons.map(
            (svg, i) =>
                new Promise(resolve => setTimeout(() => play(svg, 'signature').then(resolve), i * stagger))
        )
    )

let looping = false
async function runReel(stagger) {
    await playAll(stagger)
    if (looping) setTimeout(() => runReel(stagger), 500)
}

$('play-all').onclick = () => runReel(0)
$('cascade').onclick = () => runReel(45)
$('loop').onchange = e => {
    looping = e.target.checked
    if (looping) runReel(0)
}
$('speed').oninput = e => {
    config.speed = +e.target.value
    $('speed-out').textContent = `${config.speed}×`
}

// Scrubbing: WAAPI animations are just timelines, so we can pause and seek them.
const scrub = $('scrub')
const phaseEls = [...$('phases').children]
const PHASE_ENDS = [0.1, 0.27, 0.5, 1]

// Ambient loops (fire flicker) keep running while scrubbing; only finite ones seek.
const scrubbable = () =>
    reel.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect.getComputedTiming().endTime))

scrub.addEventListener('pointerdown', () => {
    looping = false
    $('loop').checked = false
    reelIcons.forEach(svg => play(svg, 'signature', { force: true }))
    scrubbable().forEach(a => a.pause())
})
scrub.addEventListener('input', () => {
    const progress = scrub.value / 1000
    for (const animation of scrubbable()) {
        const timing = animation.effect.getComputedTiming()
        animation.currentTime = progress * (timing.endTime ?? 0)
    }
    const phase = PHASE_ENDS.findIndex(end => progress <= end)
    phaseEls.forEach((el, i) => el.classList.toggle('on', i === phase))
})
scrub.addEventListener('change', () => {
    scrubbable().forEach(a => a.play())
})

// Play once on load, like the reel.
setTimeout(() => playAll(0), 300)

// ---- Triggers --------------------------------------------------------------

for (const preset of ['wiggle', 'pop', 'bounce', 'spin', 'shake', 'rebuild']) {
    const wrap = document.createElement('div')
    wrap.className = 'tagged'
    const svg = icon(preset === 'rebuild' ? 'chat-round-code' : 'chat-round-dots', { solarHover: preset })
    const label = document.createElement('small')
    label.textContent = preset
    wrap.append(svg, label)
    $('generic').append(wrap)
}

for (const [name, text, preset] of [
    ['chat-square-arrow', 'Send', 'signature'],
    ['pen-new-round', 'Compose', 'signature'],
    ['chat-round-like', 'Like', 'signature'],
]) {
    const button = document.createElement('button')
    button.dataset.solarGroup = ''
    button.append(icon(name, { solarHover: preset }), text)
    $('group').append(button)
}

for (const name of ['letter-unread', 'chat-round-money', 'link-circle', 'translation']) {
    $('click').append(icon(name, { solarClick: 'signature' }))
}

const appearIcons = ['chat-round-question-mark', 'inbox', 'user-speak-rounded', 'mention-circle', 'pen-2'].map(
    name => icon(name, { solarInView: 'draw' })
)
$('appear').append(...appearIcons)
$('replay-appear').onclick = () => appearIcons.forEach(svg => play(svg, 'draw'))

const typing = icon('chat-round-dots', { solarLoop: 'typing' })
const unread = icon('chat-round-unread', { solarLoop: 'pulse' })
const sync = icon('restart-circle', { solarLoop: 'spin' })
const fire = icon('fire', { solarAmbient: 'flicker', solarHover: 'signature' })
$('loops').append(typing, unread, sync, fire)

for (const name of ['chat-round-line@LineDuotone', 'letter-unread@LineDuotone', 'inbox@LineDuotone', 'chat-round-dots@LineDuotone']) {
    $('duotone').append(icon(name, { solarHover: 'layer-stagger', solarClick: 'layer-stagger' }))
}

autoBind(document)

// ---- Transitions -----------------------------------------------------------

function cycler(hostId, labelId, buttonId, names, mode) {
    let index = 0
    const svg = icon(names[0])
    $(hostId).append(svg)
    $(labelId).textContent = names[0]
    let busy = false
    $(buttonId).onclick = async () => {
        if (busy) return
        busy = true
        index = (index + 1) % names.length
        $(labelId).textContent = names[index]
        await swap(svg, icons[names[index]], { mode })
        busy = false
    }
}

cycler('swap-shared', 'swap-shared-label', 'swap-shared-next', [
    'chat-round-dots',
    'chat-round-check',
    'chat-round-like',
    'chat-round-line',
    'chat-round-code',
    'chat-round-question-mark',
    'chat-round-close',
    'chat-round-add',
])

cycler('swap-fade', 'swap-fade-label', 'swap-fade-next', [
    'letter',
    'inbox',
    'chat-round',
    'translation',
    'user-circle',
])

{
    const svg = icon('chat-round-dots')
    const button = $('toggle')
    button.append(svg)
    let read = false
    let busy = false
    button.onclick = async () => {
        if (busy) return
        busy = true
        read = !read
        $('toggle-label').textContent = read ? 'read' : 'unread'
        await swap(svg, icons[read ? 'chat-round-check' : 'chat-round-dots'])
        busy = false
    }
}
