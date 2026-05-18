import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as CANNON from 'cannon-es'
import {
  DOMINO_W, DOMINO_H, DOMINO_D, DOMINO_GAP,
  buildDomino, removeDomino, randomColor, generateId, resetIdCounter, syncIdCounter,
  activatePhysics, toppleDominoAt, resetPhysics, createPhysicsWorld,
  DominoData, DominoObject,
} from './domino'
import { saveToLocal, loadFromLocal, exportToFile, importFromFile } from './storage'

export type ToolMode = 'place' | 'delete' | 'move'

export class DominoScene {
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls
  private world!: CANNON.World

  private dominoes: DominoObject[] = []
  private clock = new THREE.Clock()

  // Tool state
  private toolMode: ToolMode = 'place'
  private isPlaying = false
  private toppleTriggered = false

  // Hover highlight
  private hoveredDomino: DominoObject | null = null
  private hoverHighlight: THREE.Mesh | null = null

  // Raycasting
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  // Line drawing state
  private isShiftDown = false
  private lineStart: THREE.Vector3 | null = null

  // Selected domino for delete/move
  private selectedDomino: DominoObject | null = null
  private selectionRing: THREE.Mesh | null = null

  // Callbacks
  private onCountChange!: (n: number) => void
  private onPlayChange!: (playing: boolean) => void

  constructor(container: HTMLElement) {
    this.init(container)
    this.startLoop()
  }

  setCallbacks(cbs: { onCountChange: (n: number) => void; onPlayChange: (playing: boolean) => void }) {
    this.onCountChange = cbs.onCountChange
    this.onPlayChange = cbs.onPlayChange
  }

  // ======== Init ========
  private init(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 40)

    // Camera
    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100)
    this.camera.position.set(8, 6, 8)
    this.camera.lookAt(0, 0, 0)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    container.appendChild(this.renderer.domElement)

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.1
    this.controls.minDistance = 2
    this.controls.maxDistance = 30
    this.controls.maxPolarAngle = Math.PI / 2.05
    this.controls.target.set(0, 0.5, 0)

    // Physics
    this.world = createPhysicsWorld()

    // Lights
    this.setupLights()

    // Ground
    this.setupGround()

    // Events
    this.setupEvents()

    // Resize
    window.addEventListener('resize', () => this.onResize(container))
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.5)
    this.scene.add(ambient)
    const hemi = new THREE.HemisphereLight(0x8888ff, 0x444422, 0.6)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffeedd, 1.5)
    sun.position.set(10, 15, 8)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 40
    sun.shadow.camera.left = -15
    sun.shadow.camera.right = 15
    sun.shadow.camera.top = 15
    sun.shadow.camera.bottom = -15
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0x8888ff, 0.4)
    fill.position.set(-5, 3, -8)
    this.scene.add(fill)
  }

  private setupGround() {
    const gridSize = 20
    const gridHelper = new THREE.GridHelper(gridSize, 20, 0x6666aa, 0x444466)
    gridHelper.position.y = -0.01
    this.scene.add(gridHelper)

    const planeGeo = new THREE.PlaneGeometry(gridSize, gridSize)
    const planeMat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.3,
      color: 0x2a2a4a,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    const planeMesh = new THREE.Mesh(planeGeo, planeMat)
    planeMesh.rotation.x = -Math.PI / 2
    planeMesh.position.y = -0.01
    planeMesh.receiveShadow = true
    this.scene.add(planeMesh)
  }

  // ======== Events ========
  private setupEvents() {
    const canvas = this.renderer.domElement

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e))
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e))
    canvas.addEventListener('mouseup', () => this.onMouseUp())
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e))
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this.isShiftDown = true
      if (e.key === '1') this.setTool('place')
      if (e.key === '2') this.setTool('delete')
      if (e.key === '3') this.setTool('move')
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedDomino) {
          this.deleteDomino(this.selectedDomino)
          this.selectedDomino = null
          this.removeSelectionRing()
        }
      }
    })
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.isShiftDown = false
        this.lineStart = null
      }
    })
  }

  private getGroundIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
    this.mouse.x = (clientX / this.renderer.domElement.clientWidth) * 2 - 1
    this.mouse.y = -(clientY / this.renderer.domElement.clientHeight) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersect = new THREE.Vector3()
    const ray = this.raycaster.ray
    const denom = ray.direction.dot(this.groundPlane.normal)
    if (Math.abs(denom) < 1e-6) return null
    const t = -(ray.origin.dot(this.groundPlane.normal) + this.groundPlane.constant) / denom
    if (t < 0) return null
    intersect.copy(ray.origin).add(ray.direction.clone().multiplyScalar(t))
    return intersect
  }

  private getDominoIntersection(clientX: number, clientY: number): DominoObject | null {
    this.mouse.x = (clientX / this.renderer.domElement.clientWidth) * 2 - 1
    this.mouse.y = -(clientY / this.renderer.domElement.clientHeight) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)

    const meshes = this.dominoes.map(d => d.mesh)
    const intersects = this.raycaster.intersectObjects(meshes)
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object
      return this.dominoes.find(d => d.mesh === hitMesh) || null
    }
    return null
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return

    // --- PLAY MODE: click domino to topple ---
    if (this.isPlaying && !this.toppleTriggered) {
      const domino = this.getDominoIntersection(e.clientX, e.clientY)
      if (domino) {
        activatePhysics(this.dominoes, this.world)
        toppleDominoAt(domino, 1.8)
        this.toppleTriggered = true
      }
      return
    }

    if (this.toolMode === 'place') {
      if (this.isShiftDown) {
        const pos = this.getGroundIntersection(e.clientX, e.clientY)
        if (pos) {
          this.lineStart = pos.clone()
          this.placeDomino(pos.x, pos.z)
        }
      } else {
        const pos = this.getGroundIntersection(e.clientX, e.clientY)
        if (pos) {
          this.placeDomino(pos.x, pos.z)
        }
      }
    } else if (this.toolMode === 'delete') {
      const domino = this.getDominoIntersection(e.clientX, e.clientY)
      if (domino) {
        if (this.selectedDomino === domino) {
          this.deleteDomino(domino)
          this.selectedDomino = null
          this.removeSelectionRing()
        } else {
          this.selectedDomino = domino
          this.showSelectionRing(domino)
        }
      } else {
        this.selectedDomino = null
        this.removeSelectionRing()
      }
    } else if (this.toolMode === 'move') {
      const domino = this.getDominoIntersection(e.clientX, e.clientY)
      if (domino) {
        this.selectedDomino = domino
        this.showSelectionRing(domino)
      } else {
        this.selectedDomino = null
        this.removeSelectionRing()
      }
    }
  }

  private onMouseMove(e: MouseEvent) {
    // --- Play mode hover highlight ---
    if (this.isPlaying && !this.toppleTriggered) {
      const domino = this.getDominoIntersection(e.clientX, e.clientY)
      if (domino !== this.hoveredDomino) {
        this.removeHoverHighlight()
        if (domino) {
          this.showHoverHighlight(domino)
        }
        this.hoveredDomino = domino
        // Update cursor
        this.renderer.domElement.style.cursor = domino ? 'pointer' : 'crosshair'
      }
      return
    }

    if (this.toolMode === 'place' && this.isShiftDown && this.lineStart) {
      const pos = this.getGroundIntersection(e.clientX, e.clientY)
      if (pos) {
        const dx = pos.x - this.lineStart.x
        const dz = pos.z - this.lineStart.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > DOMINO_W + DOMINO_GAP) {
          const angle = Math.atan2(dz, dx)
          const spacing = DOMINO_W + DOMINO_GAP
          const count = Math.floor(dist / spacing)
          for (let i = 0; i < count; i++) {
            const ratio = (i + 1) / count
            const x = this.lineStart.x + dx * ratio
            const z = this.lineStart.z + dz * ratio
            this.placeDomino(x, z, -angle)
          }
          this.lineStart = pos.clone()
        }
      }
    }
  }

  private onMouseUp() {
    this.lineStart = null
  }

  private onDoubleClick(e: MouseEvent) {
    if (this.toolMode === 'delete') {
      const domino = this.getDominoIntersection(e.clientX, e.clientY)
      if (domino) {
        this.deleteDomino(domino)
        if (this.selectedDomino === domino) {
          this.selectedDomino = null
          this.removeSelectionRing()
        }
      }
    }
  }

  // ======== Domino Operations ========
  placeDomino(x: number, z: number, rotation?: number) {
    if (this.isPlaying) return
    const halfSize = 9
    x = Math.max(-halfSize, Math.min(halfSize, x))
    z = Math.max(-halfSize, Math.min(halfSize, z))

    const data: DominoData = {
      id: generateId(),
      x, z,
      rotation: rotation ?? 0,
      color: randomColor(),
    }

    const obj = buildDomino(this.scene, this.world, data)
    this.dominoes.push(obj)
    this.onCountChange?.(this.dominoes.length)
  }

  deleteDomino(obj: DominoObject) {
    const idx = this.dominoes.indexOf(obj)
    if (idx === -1) return
    removeDomino(obj, this.scene, this.world)
    this.dominoes.splice(idx, 1)
    this.onCountChange?.(this.dominoes.length)
  }

  clearAll() {
    for (const d of [...this.dominoes]) {
      removeDomino(d, this.scene, this.world)
    }
    this.dominoes = []
    resetIdCounter()
    this.selectedDomino = null
    this.removeSelectionRing()
    this.hoveredDomino = null
    this.removeHoverHighlight()
    this.isPlaying = false
    this.toppleTriggered = false
    this.onPlayChange?.(false)
    this.onCountChange?.(0)
  }

  startPlay() {
    if (this.dominoes.length === 0 || this.isPlaying) return
    this.isPlaying = true
    this.toppleTriggered = false
    this.onPlayChange?.(true)
    this.renderer.domElement.style.cursor = 'crosshair'
  }

  resetPlay() {
    if (!this.isPlaying) return
    this.isPlaying = false
    this.toppleTriggered = false
    this.onPlayChange?.(false)
    resetPhysics(this.dominoes, this.world)
    this.selectedDomino = null
    this.removeSelectionRing()
    this.hoveredDomino = null
    this.removeHoverHighlight()
    this.renderer.domElement.style.cursor = ''
  }

  // ======== Hover Highlight ========
  private showHoverHighlight(obj: DominoObject) {
    this.removeHoverHighlight()
    const geo = new THREE.BoxGeometry(DOMINO_W + 0.08, DOMINO_H + 0.08, DOMINO_D + 0.08)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })
    this.hoverHighlight = new THREE.Mesh(geo, mat)
    this.hoverHighlight.position.copy(obj.mesh.position)
    this.hoverHighlight.quaternion.copy(obj.mesh.quaternion)
    this.scene.add(this.hoverHighlight)
  }

  private removeHoverHighlight() {
    if (this.hoverHighlight) {
      this.scene.remove(this.hoverHighlight)
      this.hoverHighlight.geometry.dispose()
      const mat = this.hoverHighlight.material
      if (Array.isArray(mat)) mat.forEach(m => m.dispose())
      else mat.dispose()
      this.hoverHighlight = null
    }
  }

  // ======== Selection Ring ========
  private showSelectionRing(obj: DominoObject) {
    this.removeSelectionRing()
    const ringGeo = new THREE.RingGeometry(DOMINO_W * 0.6, DOMINO_W * 0.75, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat)
    this.selectionRing.rotation.x = -Math.PI / 2
    this.selectionRing.position.set(obj.data.x, 0.02, obj.data.z)
    this.scene.add(this.selectionRing)
  }

  private removeSelectionRing() {
    if (this.selectionRing) {
      this.scene.remove(this.selectionRing)
      this.selectionRing.geometry.dispose()
      if (Array.isArray(this.selectionRing.material)) {
        this.selectionRing.material.forEach(m => m.dispose())
      } else {
        this.selectionRing.material.dispose()
      }
      this.selectionRing = null
    }
  }

  // ======== Tool ========
  setTool(mode: ToolMode) {
    this.toolMode = mode
    if (mode !== 'delete') {
      this.selectedDomino = null
      this.removeSelectionRing()
    }
  }

  getTool(): ToolMode { return this.toolMode }

  // ======== Save/Load/Export/Import ========
  save() {
    const data = this.dominoes.map(d => d.data)
    return saveToLocal(data)
  }

  load() {
    this.clearAll()
    const data = loadFromLocal()
    if (!data) return false
    let maxId = 0
    for (const d of data) {
      if (d.id > maxId) maxId = d.id
      const obj = buildDomino(this.scene, this.world, d)
      this.dominoes.push(obj)
    }
    syncIdCounter(maxId)
    this.onCountChange?.(this.dominoes.length)
    return true
  }

  export() {
    const data = this.dominoes.map(d => d.data)
    exportToFile(data)
  }

  async importFile() {
    const data = await importFromFile()
    if (!data) return false
    this.clearAll()
    let maxId = 0
    for (const d of data) {
      if (d.id > maxId) maxId = d.id
      const obj = buildDomino(this.scene, this.world, d)
      this.dominoes.push(obj)
    }
    syncIdCounter(maxId)
    this.onCountChange?.(this.dominoes.length)
    return true
  }

  // ======== Animation Loop ========
  private startLoop() {
    const animate = () => {
      requestAnimationFrame(animate)
      const dt = this.clock.getDelta()
      this.controls.update()

      if (this.isPlaying) {
        this.world.step(1 / 60, dt, 3)
        for (const d of this.dominoes) {
          d.mesh.position.copy(d.body.position as unknown as THREE.Vector3)
          d.mesh.quaternion.copy(d.body.quaternion as unknown as THREE.Quaternion)
        }
      }

      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  // ======== Resize ========
  private onResize(container: HTMLElement) {
    const w = container.clientWidth
    const h = container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    this.renderer.dispose()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
  }
}
