import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// Domino dimensions
export const DOMINO_W = 0.8    // width (long side)
export const DOMINO_H = 1.6    // height
export const DOMINO_D = 0.24   // depth (thickness)
export const DOMINO_GAP = 0.05 // extra gap between dominoes

// Colors
const COLORS = [
  0x6366f1, // indigo
  0xef4444, // red
  0x22c55e, // green
  0xf59e0b, // amber
  0x3b82f6, // blue
  0xec4899, // pink
  0x14b8a6, // teal
  0xa855f7, // purple
]

export interface DominoData {
  id: number
  x: number
  z: number
  rotation: number // radians
  color: number
}

export interface DominoObject {
  data: DominoData
  mesh: THREE.Mesh
  body: CANNON.Body
}

// --- Physics ---
export function createPhysicsWorld(): CANNON.World {
  const world = new CANNON.World()
  world.gravity.set(0, -9.82, 0)
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true

  const defaultMat = new CANNON.Material('default')
  const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, {
    friction: 0.5,
    restitution: 0.05,
  })
  world.addContactMaterial(contactMat)

  // Ground
  const groundBody = new CANNON.Body({ mass: 0, material: defaultMat })
  groundBody.addShape(new CANNON.Plane())
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(groundBody)

  return world
}

let nextId = 1

export function createDominoMesh(color: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(DOMINO_W, DOMINO_H, DOMINO_D)
  // Round edges slightly with bevel-like geometry
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.4,
    metalness: 0.1,
    clearcoat: 0.1,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function createDominoBody(): CANNON.Body {
  const mat = new CANNON.Material('domino')
  const body = new CANNON.Body({
    mass: 0.5,
    material: mat,
    linearDamping: 0.1,
    angularDamping: 0.6,
    shape: new CANNON.Box(
      new CANNON.Vec3(DOMINO_W / 2, DOMINO_H / 2, DOMINO_D / 2)
    ),
  })
  // Start as kinematic (static) — only dynamic when toppled
  body.type = CANNON.Body.KINEMATIC
  return body
}

export function buildDomino(
  scene: THREE.Scene,
  world: CANNON.World,
  data: DominoData
): DominoObject {
  const mesh = createDominoMesh(data.color)
  const body = createDominoBody()

  // Body centered at DOMINO_H/2 so its bottom touches ground (y=0)
  body.position.set(data.x, DOMINO_H / 2, data.z)
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), data.rotation)

  // Mesh at same position as body (center of domino)
  mesh.position.set(data.x, DOMINO_H / 2, data.z)
  mesh.rotation.y = data.rotation

  scene.add(mesh)
  world.addBody(body)

  return { data, mesh, body }
}

export function removeDomino(obj: DominoObject, scene: THREE.Scene, world: CANNON.World) {
  scene.remove(obj.mesh)
  world.removeBody(obj.body)
  obj.mesh.geometry.dispose()
  if (Array.isArray(obj.mesh.material)) {
    obj.mesh.material.forEach(m => m.dispose())
  } else {
    obj.mesh.material.dispose()
  }
}

export function randomColor(): number {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

export function generateId(): number {
  return nextId++
}

export function resetIdCounter() {
  nextId = 1
}

export function syncIdCounter(maxId: number) {
  if (maxId >= nextId) {
    nextId = maxId + 1
  }
}

export function activatePhysics(dominoes: DominoObject[], world: CANNON.World) {
  for (const d of dominoes) {
    d.body.type = CANNON.Body.DYNAMIC
    d.body.mass = 0.5
    d.body.updateMassProperties()
    d.body.wakeUp()
  }
}

/**
 * Apply topple impulse to a specific domino in its facing direction.
 * Domino's thin side is local Z axis → world direction = (sin(rot), 0, cos(rot))
 */
export function toppleDominoAt(target: DominoObject, impulseStrength = 0.25) {
  const rot = target.data.rotation
  // Fall direction: local Z axis of domino (thin side)
  // Just a horizontal push at the top — gravity + collision does the rest
  const dir = new CANNON.Vec3(
    Math.sin(rot),
    0,
    Math.cos(rot)
  )
  dir.normalize()
  dir.scale(impulseStrength, dir)

  // Apply impulse near the top to tip it over
  const wp = new CANNON.Vec3(
    target.body.position.x,
    DOMINO_H * 0.85,
    target.body.position.z
  )
  target.body.applyImpulse(dir, wp)
}

export function resetPhysics(dominoes: DominoObject[], world: CANNON.World) {
  for (const d of dominoes) {
    world.removeBody(d.body)
  }
  for (const d of dominoes) {
    // Create new kinematic body at correct height
    const newBody = createDominoBody()
    newBody.position.set(d.data.x, DOMINO_H / 2, d.data.z)
    newBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), d.data.rotation)
    d.body = newBody
    world.addBody(newBody)

    // Reset mesh to match
    d.mesh.position.set(d.data.x, DOMINO_H / 2, d.data.z)
    d.mesh.rotation.y = d.data.rotation
  }
}
