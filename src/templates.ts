import { DominoData, dominoW, generateId } from './domino'
import { COLOR_PRESETS } from './config'

export interface TemplateDef {
  name: string
  icon: string
  generate: () => DominoData[]
}

// ======== Helpers ========

function colorArray(): number[] {
  return COLOR_PRESETS.map(c => c.value)
}

function nextId(): number {
  return generateId()
}

const W = () => dominoW()

// ======== Spiral ========
function generateSpiral(): DominoData[] {
  const result: DominoData[] = []
  const spacing = W() + 0.02
  const turns = 4
  const total = 80
  const color = colorArray()

  for (let i = 0; i < total; i++) {
    const t = (i / total) * turns * Math.PI * 2
    const radius = 0.3 + (i / total) * 3.5
    const x = Math.cos(t) * radius
    const z = Math.sin(t) * radius
    const rotation = -t + Math.PI / 2

    result.push({
      id: nextId(),
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      rotation,
      color: color[i % color.length],
    })
  }
  return result
}

// ======== Snake ========
function generateSnake(): DominoData[] {
  const result: DominoData[] = []
  const spacing = W() + 0.02
  const segmentLen = 8
  const rows = 4
  const color = colorArray()
  let idx = 0

  for (let row = 0; row < rows; row++) {
    const z = row * spacing * 2 - (rows - 1) * spacing
    const isRight = row % 2 === 0
    for (let i = 0; i < segmentLen; i++) {
      const x = isRight ? i * spacing : (segmentLen - 1 - i) * spacing
      const adjustedX = x - (segmentLen - 1) * spacing / 2
      result.push({
        id: nextId(),
        x: Math.round(adjustedX * 100) / 100,
        z: Math.round(z * 100) / 100,
        rotation: 0,
        color: color[idx % color.length],
      })
      idx++
    }
  }
  return result
}

// ======== Pyramid ========
function generatePyramid(): DominoData[] {
  const result: DominoData[] = []
  const spacing = W() + 0.02
  const rows = 10
  const color = colorArray()
  let idx = 0

  for (let row = 0; row < rows; row++) {
    const count = rows - row
    const zOffset = row * spacing * 0.6
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * spacing
      const z = zOffset
      result.push({
        id: nextId(),
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        rotation: 0,
        color: color[idx % color.length],
      })
      idx++
    }
  }
  return result
}

// ======== Heart ========
function generateHeart(): DominoData[] {
  const result: DominoData[] = []
  const color = colorArray()
  const total = 60
  const scale = 0.2
  let idx = 0

  for (let i = 0; i < total; i++) {
    const t = (i / total) * Math.PI * 2
    const sinT = Math.sin(t)
    const x = 16 * sinT * sinT * sinT * scale
    const z = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale

    const dt = 0.01
    const t2 = t + dt
    const sinT2 = Math.sin(t2)
    const x2 = 16 * sinT2 * sinT2 * sinT2 * scale
    const z2 = (13 * Math.cos(t2) - 5 * Math.cos(2 * t2) - 2 * Math.cos(3 * t2) - Math.cos(4 * t2)) * scale
    const rotation = Math.atan2(z2 - z, x2 - x) - Math.PI / 2

    result.push({
      id: nextId(),
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      rotation,
      color: color[idx % color.length],
    })
    idx++
  }
  return result
}

// ======== Concentric Circles ========
function generateCircles(): DominoData[] {
  const result: DominoData[] = []
  const spacing = W() + 0.06
  const rings = 4
  const color = colorArray()
  let idx = 0

  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring * spacing * 1.3
    const circumference = 2 * Math.PI * radius
    const count = Math.max(8, Math.floor(circumference / spacing))
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const rotation = angle + Math.PI / 2

      result.push({
        id: nextId(),
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        rotation,
        color: color[idx % color.length],
      })
      idx++
    }
  }
  return result
}

// ======== Cross / X Pattern ========
function generateCross(): DominoData[] {
  const result: DominoData[] = []
  const color = colorArray()
  const spacing = W() + 0.02
  const armLen = 7

  for (let i = 0; i < armLen * 2 + 1; i++) {
    const offset = (i - armLen) * spacing
    result.push({
      id: nextId(),
      x: Math.round(offset * 100) / 100,
      z: Math.round(offset * 100) / 100,
      rotation: i % 2 === 0 ? Math.PI / 4 : Math.PI / 2,
      color: color[i % color.length],
    })
    result.push({
      id: nextId(),
      x: Math.round(offset * 100) / 100,
      z: Math.round(-offset * 100) / 100,
      rotation: i % 2 === 0 ? Math.PI / 4 : 0,
      color: color[(i + 1) % color.length],
    })
  }
  return result
}

// ======== Template Registry ========
export const TEMPLATES: TemplateDef[] = [
  { name: '螺旋', icon: '🌀', generate: generateSpiral },
  { name: '蛇形', icon: '🐍', generate: generateSnake },
  { name: '三角墙', icon: '🔺', generate: generatePyramid },
  { name: '心形', icon: '❤️', generate: generateHeart },
  { name: '同心圆', icon: '⭕', generate: generateCircles },
  { name: '交叉', icon: '✖️', generate: generateCross },
]