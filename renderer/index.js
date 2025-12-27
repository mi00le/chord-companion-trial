const {
  getStartingChords,
  suggestNextChords,
  generateStarterProgression
} = require('./chord-api')

// ---------- AUDIO CHAIN ----------
const masterGain = new Tone.Gain(0.6) // headroom
const compressor = new Tone.Compressor({
  threshold: -18,
  ratio: 3,
  attack: 0.02,
  release: 0.25
})
const limiter = new Tone.Limiter(-1) // absolute ceiling

masterGain.chain(compressor, limiter, Tone.Destination)

// ---------- PIANO SYNTH ----------
const piano = new Tone.PolySynth(Tone.Synth, {
  volume: -8,
  options: {
    oscillator: {
      type: 'triangle' // softer than saw/square
    },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.6,
      release: 0.8
    }
  }
}).connect(masterGain)

// ---------- UTILITY ----------
const chromatic = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
]

function chordTones(ch, octave = 4) {
  const root = ch.replace(/m|dim|7/g, '')
  const rootIndex = chromatic.indexOf(root)
  if (rootIndex < 0) return []

  const minor = ch.endsWith('m') && !ch.endsWith('dim')
  const dim = ch.endsWith('dim')
  const seventh = ch.endsWith('7')

  let intervals = dim ? [0, 3, 6] : minor ? [0, 3, 7] : [0, 4, 7]
  if (seventh) intervals.push(10)

  return intervals.map((i) => {
    const noteIndex = (rootIndex + i) % 12
    const noteOct = octave + Math.floor((rootIndex + i) / 12)
    return chromatic[noteIndex] + noteOct
  })
}

// ---------- PLAYBACK ----------
let currentNotes = []

// ---------- PLAY CHORD ----------
function playChordAtTime(ch, t) {
  const notes = chordTones(ch)
  // Slightly longer release, moderate velocity
  piano.triggerAttackRelease(notes, '1.2', t, 0.7)
}

async function playChord(ch) {
  await Tone.start()
  stopChord()
  const now = Tone.now()
  playChordAtTime(ch, now)
}

// ---------- STOP ----------
function stopChord() {
  piano.releaseAll()
}

// ---------- PLAY PROGRESSION ----------
async function playProgression(prog, tempo = 80) {
  await Tone.start()
  Tone.Transport.cancel()
  stopChord()

  // seconds per chord (quarter-note feel)
  const secondsPerBeat = 60 / tempo
  const chordDuration = secondsPerBeat * 0.9

  let time = 0
  prog.forEach((ch) => {
    Tone.Transport.scheduleOnce((t) => {
      piano.triggerAttackRelease(chordTones(ch), chordDuration, t, 0.7)
    }, `+${time}`)

    time += secondsPerBeat
  })

  Tone.Transport.start()
}

// ---------- UI ----------
const progression = []
const chordPalette = document.getElementById('chordPalette')
const progressionDisplay = document.getElementById('progression')
const output = document.getElementById('output')
let currentKey = 'C',
  currentStyle = 'pop'

const styleExclusions = {
  pop: ['dim'],
  uplifting: ['dim'],
  sad: [],
  cinematic: [],
  jazzish: [],
  experimental: []
}

const styleBias = {
  pop: { prefer: ['I', 'V', 'vi', 'IV'], avoid: ['vii°'] },
  sad: { prefer: ['vi', 'ii', 'iii'], avoid: ['V'] },
  cinematic: { prefer: ['iv', 'VI', 'vii°'], avoid: [] },
  uplifting: { prefer: ['I', 'V', 'IV'], avoid: ['iii'] },
  jazzish: { prefer: ['ii', 'V', 'vii°'], avoid: [] },
  experimental: { prefer: [], avoid: [] }
}

// ---------- CHORD PALETTE ----------
function renderChordPalette() {
  chordPalette.innerHTML = ''
  let chords = getStartingChords(currentKey)
  const exclusions = styleExclusions[currentStyle] || []
  chords = chords.filter((ch) => !exclusions.some((ex) => ch.includes(ex)))

  chords.forEach((ch) => {
    const btn = document.createElement('button')
    btn.textContent = ch
    if (ch.endsWith('dim')) btn.classList.add('diminished')
    else if (ch.endsWith('7')) btn.classList.add('seventh')
    else if (ch.endsWith('m')) btn.classList.add('minor')
    else btn.classList.add('major')
    btn.onclick = () => addChordToProgression(ch)
    chordPalette.appendChild(btn)
  })
}

function addChordToProgression(ch) {
  progression.push(ch)
  playChord(ch)
  renderProgression()
  renderSuggestions()
}

function renderProgression() {
  progressionDisplay.textContent = progression.length
    ? `Current progression: ${progression.join(' - ')}`
    : 'Current progression:'
}

function renderSuggestions() {
  output.innerHTML = ''
  if (!progression.length) return
  const suggestions = suggestNextChords(progression, 'advanced', currentKey)
  const bias = styleBias[currentStyle] || { prefer: [], avoid: [] }

  suggestions.forEach((s) => {
    let conf = s.confidence
    if (bias.prefer.some((p) => s.reason.includes(p))) conf *= 1.15
    if (bias.avoid.some((a) => s.reason.includes(a))) conf *= 0.85
    conf = Math.min(1, Math.max(0, conf))
    s.confidence = conf

    const div = document.createElement('div')
    div.className = 'suggestion simple'
    div.onclick = () => addChordToProgression(s.chord)
    const text = document.createElement('div')
    text.className = 'suggestion-text'
    text.textContent = s.chord
    const reason = document.createElement('div')
    reason.className = 'reason'
    reason.textContent = `${s.reason} (confidence: ${(s.confidence * 100).toFixed(0)}%)`
    const bar = document.createElement('div')
    bar.className = 'confidence-bar'
    const fill = document.createElement('div')
    fill.className = 'confidence-fill'
    fill.style.width = `${s.confidence * 100}%`
    bar.appendChild(fill)
    div.appendChild(text)
    div.appendChild(reason)
    div.appendChild(bar)
    output.appendChild(div)
  })
}

// ---------- BUTTONS ----------
document.getElementById('playBtn').onclick = () => playProgression(progression)
document.getElementById('starterBtn').onclick = () => {
  progression.length = 0
  progression.push(...generateStarterProgression(currentKey, 4, currentStyle))
  playProgression(progression)
  renderProgression()
  renderSuggestions()
}
document.getElementById('clearBtn').onclick = () => {
  progression.length = 0
  stopChord()
  renderProgression()
  renderSuggestions()
}

document
  .getElementById('styleSelect')
  .addEventListener('change', (e) => (currentStyle = e.target.value))
document.getElementById('keySelect').addEventListener('change', (e) => {
  currentKey = e.target.value
  progression.length = 0
  stopChord()
  renderProgression()
  output.innerHTML = ''
  renderChordPalette()
})

// Initial render
renderChordPalette()
renderProgression()
renderSuggestions()
