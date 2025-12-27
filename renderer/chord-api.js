// ================== KEYS ==================
const keys = {
  C: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'E7', 'A7', 'D7', 'G7'],
  D: ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim', 'E7', 'A7', 'B7'],
  E: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim', 'B7', 'E7'],
  F: ['F', 'Gm', 'Am', 'A#', 'C', 'Dm', 'Edim', 'C7', 'G7'],
  G: ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim', 'D7', 'G7'],
  A: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim', 'E7', 'A7'],
  Am: ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G', 'E7', 'A7'],
  Em: ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D', 'B7', 'E7'],
  Dm: ['Dm', 'Edim', 'F', 'Gm', 'Am', 'A#', 'C', 'A7', 'D7'],
  Bm: ['Bm', 'C#dim', 'D', 'Em', 'F#m', 'G', 'A', 'F#7', 'B7'],
  Cm: ['Cm', 'Ddim', 'D#', 'Fm', 'Gm', 'G#', 'A#', 'G7', 'C7']
}

// ================== CHORD TOOLS ==================
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
const chordRoot = (ch) => ch.replace(/m|dim|7/g, '')
const noteIndex = (n) => chromatic.indexOf(n)

function chordTones(ch) {
  const root = noteIndex(chordRoot(ch))
  if (root < 0) return []
  const minor = ch.endsWith('m') && !ch.endsWith('dim')
  const dim = ch.endsWith('dim')
  const seventh = ch.endsWith('7')
  let intervals = dim ? [0, 3, 6] : minor ? [0, 3, 7] : [0, 4, 7]
  if (seventh) intervals.push(10)
  return intervals.map((i) => chromatic[(root + i) % 12])
}

function topNote(ch) {
  const tones = chordTones(ch)
  return tones.length ? noteIndex(tones.at(-1)) : -1
}

function topNoteScore(prev, next, key) {
  const a = topNote(prev),
    b = topNote(next)
  if (a < 0 || b < 0) return 0.8
  const tonic =
    keys[key] && keys[key][0] ? noteIndex(chordRoot(keys[key][0])) : 0
  const diff = Math.abs(a - b),
    step = Math.min(diff, 12 - diff)
  if (step === 1 || step === 2) return 1.15
  if (b > a && a !== tonic) return 1.05
  if (b === tonic) return 1.2
  if (step >= 6) return 0.7
  return 0.9
}

function bassGravityScore(from, to) {
  const a = noteIndex(chordRoot(from)),
    b = noteIndex(chordRoot(to))
  if (a < 0 || b < 0) return 0.7
  const d = Math.min(Math.abs(a - b), 12 - Math.abs(a - b))
  if (d <= 2) return 1.0
  if (d === 5 || d === 7) return 0.95
  return 0.6
}

function sharedToneScore(a, b) {
  const A = chordTones(a),
    B = chordTones(b)
  return A.filter((n) => B.includes(n)).length / 3
}

function chordFunction(ch, key) {
  const d = (keys[key] || keys.C).slice(0, 7)
  if ([d[0], d[2], d[5]].includes(ch)) return 'T'
  if ([d[1], d[3]].includes(ch)) return 'P'
  if ([d[4], d[6]].includes(ch) || ch.endsWith('7')) return 'D'
  return 'T'
}

function detectKey(prog) {
  const score = {}
  for (const k in keys)
    score[k] = prog.filter((c) => keys[k].includes(c)).length
  return Object.keys(score).reduce((a, b) => (score[b] > score[a] ? b : a))
}

// ================== SUGGESTION ==================
function suggestNextChords(prog, mode, forcedKey = null) {
  if (!prog.length) return []
  const key = forcedKey || detectKey(prog)
  const scale = keys[key] || keys.C
  const last = prog.at(-1)
  const func = chordFunction(last, key)
  const d = scale.slice(0, 7),
    T = [d[0], d[2], d[5]],
    P = [d[1], d[3]],
    D = [d[4], d[6]]

  let cands = []
  if (mode === 'advanced') {
    if (func === 'T') cands = [...P]
    else if (func === 'P') cands = [...D]
    else if (func === 'D') cands = [...T]
  } else cands = scale.slice(0, 4)
  cands = [...new Set(cands)]

  return cands.map((ch) => {
    const confidence = Math.min(
      1,
      0.85 *
        bassGravityScore(last, ch) *
        (0.6 + sharedToneScore(last, ch)) *
        topNoteScore(last, ch, key)
    )
    return {
      chord: ch,
      confidence,
      reason: 'Bass + voice leading + top note contour'
    }
  })
}

// ================== STARTER PROGRESSION ==================
const styleExclusions = {
  pop: ['dim'],
  uplifting: ['dim'],
  sad: [],
  cinematic: [],
  jazzish: [],
  experimental: []
}

function generateStarterProgression(key, length = 4, style = 'pop') {
  const scale = keys[key] || keys['C']
  const diatonic = scale.slice(0, 7) // I - VII
  const isMinorKey = key.endsWith('m')

  const patterns = {
    pop: isMinorKey
      ? [
          [diatonic[0], diatonic[3], diatonic[4], diatonic[0]],
          [diatonic[0], diatonic[5], diatonic[3], diatonic[4]]
        ]
      : [
          [diatonic[0], diatonic[4], diatonic[5], diatonic[3]],
          [diatonic[0], diatonic[3], diatonic[4], diatonic[5]]
        ],
    sad: isMinorKey
      ? [
          [diatonic[0], diatonic[3], diatonic[4], diatonic[1]],
          [diatonic[0], diatonic[4], diatonic[3], diatonic[1]]
        ]
      : [
          [diatonic[5], diatonic[1], diatonic[2], diatonic[0]],
          [diatonic[5], diatonic[2], diatonic[1], diatonic[0]]
        ],
    uplifting: isMinorKey
      ? [[diatonic[0], diatonic[4], diatonic[3], diatonic[0]]]
      : [[diatonic[0], diatonic[4], diatonic[3], diatonic[0]]],
    cinematic: isMinorKey
      ? [[diatonic[0], diatonic[5], diatonic[3], diatonic[4]]]
      : [[diatonic[0], diatonic[3], diatonic[4], diatonic[5]]],
    jazzish: isMinorKey
      ? [[diatonic[1], diatonic[4], diatonic[0], diatonic[3]]]
      : [[diatonic[1], diatonic[4], diatonic[0], diatonic[3]]],
    experimental: [[diatonic[0], diatonic[3], diatonic[4], diatonic[5]]]
  }

  const availablePatterns = patterns[style] || patterns.pop
  const progression = []
  let lastChord = null

  while (progression.length < length) {
    // pick a random pattern every iteration
    const chosenPattern =
      availablePatterns[Math.floor(Math.random() * availablePatterns.length)]

    // shuffle pattern so chords come in different orders
    const shuffled = [...chosenPattern].sort(() => Math.random() - 0.5)

    for (let chord of shuffled) {
      if (progression.length >= length) break
      if (chord === lastChord) continue
      if (!isMinorKey && style === 'sad' && chord === diatonic[0]) continue
      progression.push(chord)
      lastChord = chord
    }
  }

  return progression.slice(0, length)
}

// ================== EXPORT ==================
module.exports = {
  keys,
  detectKey,
  chordFunction,
  getStartingChords: (key) => keys[key] || keys.C,
  generateStarterProgression,
  suggestNextChords
}
