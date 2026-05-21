/** 多米诺骨牌全局配置 — 可运行时调整 */
export const config = {
  // 尺寸
  width: 0.8,
  height: 1.6,
  depth: 0.24,
  gap: 0.05,

  // 物理
  mass: 0.5,
  friction: 0.8,
  restitution: 0.4,
  angularDamping: 0.05,
  impulseStrength: 1.5,

  // 颜色
  selectedColorIdx: 0,
}

export const COLOR_PRESETS: { value: number; name: string; css: string }[] = [
  { value: 0x6366f1, name: '靛蓝', css: '#6366f1' },
  { value: 0xef4444, name: '红色', css: '#ef4444' },
  { value: 0x22c55e, name: '绿色', css: '#22c55e' },
  { value: 0xf59e0b, name: '琥珀', css: '#f59e0b' },
  { value: 0x3b82f6, name: '蓝色', css: '#3b82f6' },
  { value: 0xec4899, name: '粉色', css: '#ec4899' },
  { value: 0x14b8a6, name: '青绿', css: '#14b8a6' },
]

export function getSelectedColor(): number {
  return COLOR_PRESETS[config.selectedColorIdx].value
}