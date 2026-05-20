import './style.css'
import { DominoScene, ToolMode } from './scene'
import { config, COLOR_PRESETS } from './config'

// ======== Bootstrap ========
const container = document.getElementById('canvas-container')!
const scene = new DominoScene(container)

// ======== Helpers ========
function formatRotation(rad: number): string {
  const deg = Math.round(rad * 180 / Math.PI)
  return deg === 0 ? '0°' : `↻${deg}°`
}

function updateModeLabelPlaying(playing: boolean) {
  const modeLabel = document.getElementById('mode-label')!
  modeLabel.textContent = playing ? '点击要推倒的骨牌' : `放置模式 · 方向 ${formatRotation(scene.getPendingRotation())}`
}

// ======== Callbacks ========
scene.setCallbacks({
  onCountChange: (n) => {
    document.getElementById('domino-count')!.textContent = `🁎 ${n}`
  },
  onPlayChange: (playing) => {
    const btn = document.getElementById('btn-start')!
    const modeLabel = document.getElementById('mode-label')!
    if (playing) {
      btn.textContent = '🎯 点击骨牌'
      btn.classList.add('running')
      modeLabel.textContent = '点击要推倒的骨牌'
    } else {
      btn.textContent = '▶ 推倒'
      btn.classList.remove('running')
      const activeTool = document.querySelector('.tool-btn[data-tool].active') as HTMLElement
      if (activeTool) {
        activeTool.click()
      } else {
        modeLabel.textContent = `放置模式 · 方向 ${formatRotation(scene.getPendingRotation())}`
      }
    }
    document.getElementById('btn-reset-physics')!.style.display = playing ? 'inline-block' : 'none'
  },
  onRotationChange: (angle) => {
    const modeLabel = document.getElementById('mode-label')!
    if (!modeLabel.textContent?.startsWith('放置')) return
    modeLabel.textContent = `放置模式 · 方向 ${formatRotation(angle)}`
  },
})

// ======== Color Picker ========
const colorGroup = document.querySelector('.color-group')!
function renderColorPicker() {
  colorGroup.innerHTML = ''
  COLOR_PRESETS.forEach((c, i) => {
    const btn = document.createElement('button')
    btn.className = `color-btn${i === config.selectedColorIdx ? ' active' : ''}`
    btn.title = c.name
    btn.style.background = c.css
    btn.addEventListener('click', () => {
      config.selectedColorIdx = i
      colorGroup.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
    colorGroup.appendChild(btn)
  })
}
renderColorPicker()

// ======== Settings Panel ========
const settingsBtn = document.getElementById('btn-settings')!
const settingsPanel = document.getElementById('settings-panel')!

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('open')
})

// Build settings sliders
const SETTINGS = [
  { key: 'width' as const, label: '宽度', min: 0.2, max: 2.0, step: 0.05 },
  { key: 'height' as const, label: '高度', min: 0.5, max: 4.0, step: 0.1 },
  { key: 'depth' as const, label: '厚度', min: 0.08, max: 0.8, step: 0.02 },
  { key: 'gap' as const, label: '间距', min: 0, max: 1.0, step: 0.01 },
  { key: 'mass' as const, label: '质量', min: 0.05, max: 5.0, step: 0.05 },
  { key: 'friction' as const, label: '摩擦', min: 0, max: 2, step: 0.05 },
  { key: 'restitution' as const, label: '弹性', min: 0, max: 1, step: 0.05 },
  { key: 'angularDamping' as const, label: '角阻尼', min: 0, max: 1, step: 0.05 },
  { key: 'impulseStrength' as const, label: '推力', min: 0.05, max: 1.5, step: 0.05 },
]

const settingsBody = settingsPanel.querySelector('.settings-body')!
SETTINGS.forEach(s => {
  const row = document.createElement('div')
  row.className = 'setting-row'

  const label = document.createElement('span')
  label.className = 'setting-label'
  label.textContent = s.label

  const valSpan = document.createElement('span')
  valSpan.className = 'setting-value'
  valSpan.textContent = String(config[s.key].toFixed(2))

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = String(s.min)
  slider.max = String(s.max)
  slider.step = String(s.step)
  slider.value = String(config[s.key])
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value)
    config[s.key] = v
    valSpan.textContent = v.toFixed(2)
    // Rebuild physics world for friction/restitution changes
    if (s.key === 'friction' || s.key === 'restitution') {
      scene.rebuildPhysicsWorld()
    }
  })

  row.appendChild(label)
  row.appendChild(slider)
  row.appendChild(valSpan)
  settingsBody.appendChild(row)
})

// ======== Tool buttons ========
const toolBtns = document.querySelectorAll<HTMLButtonElement>('.tool-btn[data-tool]')
toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool as ToolMode
    scene.setTool(tool)
    toolBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')

    const labels: Record<ToolMode, string> = {
      place: `放置模式 · 方向 ${formatRotation(scene.getPendingRotation())}`,
      delete: '删除模式 — 单击选中/双击删除',
      move: '移动模式',
    }
    document.getElementById('mode-label')!.textContent = labels[tool] || ''
  })
})

// ======== Start / Reset ========
document.getElementById('btn-start')!.addEventListener('click', () => {
  scene.startPlay()
})
document.getElementById('btn-reset-physics')!.addEventListener('click', () => {
  scene.resetPlay()
})
document.getElementById('btn-reset-physics')!.style.display = 'none'

// ======== Save / Load / Export / Import ========
document.getElementById('btn-save')!.addEventListener('click', () => {
  scene.save()
  showToast('已保存到浏览器')
})
document.getElementById('btn-load')!.addEventListener('click', () => {
  scene.load()
  showToast('已加载')
})
document.getElementById('btn-export')!.addEventListener('click', () => {
  scene.export()
})
document.getElementById('btn-import')!.addEventListener('click', async () => {
  const ok = await scene.importFile()
  showToast(ok ? '已导入' : '导入失败')
})

// ======== Clear ========
document.getElementById('btn-clear')!.addEventListener('click', () => {
  if (confirm('确定要清空所有骨牌吗？')) {
    scene.clearAll()
    showToast('已清空')
  }
})

// ======== Toast ========
function showToast(msg: string) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#eee',
    zIndex: '200',
    transition: 'opacity 0.3s',
  })
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 1500)
}
