import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { config, getSelectedColor } from './config'
import { playImpact } from './sound'

export interface DominoData {
  id: number
  x: number
  z: number
  rotation: number
  color: number
  w?: number
  h?: number
  d?: number
}

export interface DominoObject {
  data: DominoData
  mesh: THREE.Mesh
  body: CANNON.Body
}

// Read effective dimensions from data or config
export function dominoW(d?: DominoData) { return d?.w ?? config.width }
export function dominoH(d?: DominoData) { return d?.h ?? config.height }
export function dominoD(d?: DominoData) { return d?.d ?? config.depth }

// --- Physics ---
export function createPhysicsWorld(): CANNON.World {
  const world = new CANNON.World()
  world.gravity.set(0, -9.82, 0)
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true

  const defaultMat = new CANNON.Material('default')
  const contactMat = new CANNON.ContactMaterial(defaultMat, defaultMat, {
    friction: config.friction,
    restitution: config.restitution,
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
  const w = config.width
  const h = config.height
  const d = config.depth
  const geo = new THREE.BoxGeometry(w, h, d)
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
  const w = config.width
  const h = config.height
  const d = config.depth
  const mat = new CANNON.Material('domino')
  const body = new CANNON.Body({
    mass: config.mass,
    material: mat,
    linearDamping: 0.1,
    angularDamping: config.angularDamping,
    shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
  })
  body.type = CANNON.Body.KINEMATIC
  return body
}

export function buildDomino(
  scene: THREE.Scene,
  world: CANNON.World,
  data: DominoData
): DominoObject {
  // Store current dimensions in data for persistence
  data.w = data.w ?? config.width
  data.h = data.h ?? config.height
  data.d = data.d ?? config.depth

  const mesh = createDominoMesh(data.color)
  const body = createDominoBody()

  const h2 = data.h / 2
  body.position.set(data.x, h2, data.z)
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), data.rotation)

  mesh.position.set(data.x, h2, data.z)
  mesh.rotation.y = data.rotation

  // Use stored dimensions for mesh
  mesh.geometry.dispose()
  mesh.geometry = new THREE.BoxGeometry(data.w, data.h, data.d)

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
    d.body.mass = config.mass
    d.body.updateMassProperties()
    d.body.wakeUp()
  }
}

/**
 * Apply topple impulse to a specific domino.
 * @param target - domino to push
 * @param direction - world-space push direction (normalized)
 */
/**
 * Set up collision event listener on a body for sound effects.
 * Only fires when body is dynamic (physics active).
 */
export function setupBodyCollisionSound(body: CANNON.Body) {
  body.addEventListener(CANNON.Body.COLLIDE_EVENT_NAME, (event: any) => {
    if (body.type !== CANNON.Body.DYNAMIC) return
    try {
      const contact = event.contact
      const impactVel = contact.getImpactVelocityAlongNormal()
      if (Math.abs(impactVel) > 0.5) {
        const strength = Math.min(1, Math.abs(impactVel) / 8)
        playImpact(strength)
      }
    } catch {
      // ignore if contact info isn't available
    }
  })
}

export function toppleDominoAt(target: DominoObject, direction: CANNON.Vec3) {
  const h = dominoH(target.data)
  const dir = direction.clone()
  dir.scale(config.impulseStrength, dir)

  const wp = new CANNON.Vec3(
    target.body.position.x,
    h * 0.85,
    target.body.position.z
  )
  target.body.applyImpulse(dir, wp)
}

export function resetPhysics(dominoes: DominoObject[], world: CANNON.World) {
  for (const d of dominoes) {
    world.removeBody(d.body)
  }
  for (const d of dominoes) {
    const h = dominoH(d.data)
    const newBody = createDominoBody()
    newBody.position.set(d.data.x, h / 2, d.data.z)
    newBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), d.data.rotation)
    d.body = newBody
    world.addBody(newBody)

    d.mesh.position.set(d.data.x, h / 2, d.data.z)
    d.mesh.rotation.y = d.data.rotation
  }
}
