import { DominoData } from './domino'

const STORAGE_KEY = '3d-dominoes-save'

// --- LocalStorage Save/Load ---

export function saveToLocal(data: DominoData[]): boolean {
  try {
    const json = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, json)
    return true
  } catch {
    return false
  }
}

export function loadFromLocal(): DominoData[] | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return null
    return JSON.parse(json) as DominoData[]
  } catch {
    return null
  }
}

// --- File Export/Import ---

export function exportToFile(data: DominoData[], filename = 'dominoes.json'): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromFile(): Promise<DominoData[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      try {
        const text = await file.text()
        const data = JSON.parse(text) as DominoData[]
        resolve(data)
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}
