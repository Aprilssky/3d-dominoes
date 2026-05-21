/**
 * Web Audio API sound effects for domino collisions and placement.
 * All sounds are synthesized procedurally — no audio files needed.
 */

let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

/**
 * Play a short impact sound (wooden clack).
 * @param strength 0-1, affects volume and pitch
 */
export function playImpact(strength: number = 0.5) {
  try {
    const ac = getContext()
    const clampedStrength = Math.max(0, Math.min(1, strength))

    // master gain
    const masterGain = ac.createGain()
    masterGain.gain.value = 0.15 * (0.3 + 0.7 * clampedStrength)
    masterGain.connect(ac.destination)

    // --- Layer 1: noise burst (wooden rattle) ---
    const bufferSize = Math.floor(ac.sampleRate * 0.08)
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ac.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 60)
    }
    const noiseSource = ac.createBufferSource()
    noiseSource.buffer = buffer

    // band-pass the noise for a more "solid" sound
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 800 + 600 * clampedStrength
    bp.Q.value = 1.5

    const noiseGain = ac.createGain()
    noiseGain.gain.setValueAtTime(1, ac.currentTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06)

    noiseSource.connect(bp)
    bp.connect(noiseGain)
    noiseGain.connect(masterGain)
    noiseSource.start()

    // --- Layer 2: low thump ---
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120 + 80 * clampedStrength, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.06)

    const oscGain = ac.createGain()
    oscGain.gain.setValueAtTime(0.6, ac.currentTime)
    oscGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08)

    osc.connect(oscGain)
    oscGain.connect(masterGain)
    osc.start()
    osc.stop(ac.currentTime + 0.1)

    // Cleanup
    noiseSource.stop(ac.currentTime + 0.1)
  } catch {
    // Silently fail — audio is a nice-to-have
  }
}

/**
 * Play a short "click" sound when placing a domino.
 */
export function playPlace() {
  try {
    const ac = getContext()
    const gain = ac.createGain()
    gain.gain.value = 0.04
    gain.connect(ac.destination)

    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1000, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.03)

    gain.gain.setValueAtTime(0.04, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04)

    osc.connect(gain)
    osc.start()
    osc.stop(ac.currentTime + 0.05)
  } catch {
    // Silently fail
  }
}

/**
 * Play a "thud" sound when deleting a domino.
 */
export function playDelete() {
  try {
    const ac = getContext()
    const gain = ac.createGain()
    gain.gain.value = 0.05
    gain.connect(ac.destination)

    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(200, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.08)

    gain.gain.setValueAtTime(0.05, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1)

    osc.connect(gain)
    osc.start()
    osc.stop(ac.currentTime + 0.12)
  } catch {
    // Silently fail
  }
}
