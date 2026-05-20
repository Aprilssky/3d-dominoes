import './style.css'
import { DominoScene, ToolMode } from './scene'

// ======== Bootstrap ========
const container = document.getElementById('canvas-container')!
const scene = new DominoScene(container)

// ======== UI Bindings ========

function formatRotation(rad: number): string {
  const deg = Math.round(rad * 180 / Math.PI)
  return deg === 0 ? '0°' : `↻${deg}°`
}

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

// --- Tool buttons ---
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

// --- Start / Reset ---
document.getElementById('btn-start')!.addEventListener('click', () => {
  scene.startPlay()
})
document.getElementById('btn-reset-physics')!.addEventListener('click', () => {
  scene.resetPlay()
})
document.getElementById('btn-reset-physics')!.style.display = 'none'

// --- Save / Load / Export / Import ---
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

// --- Clear ---
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
