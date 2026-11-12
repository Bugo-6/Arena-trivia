import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Props = { speaking?: boolean; large?: boolean; pointing?: boolean }

export default function Guy3D({ speaking = false, large = false, pointing = false }: Props) {
  const mount = useRef<HTMLDivElement>(null)
  const speakingRef = useRef(speaking)
  const pointingRef = useRef(pointing)
  useEffect(() => { speakingRef.current = speaking }, [speaking])
  useEffect(() => { pointingRef.current = pointing }, [pointing])

  useEffect(() => {
    const host = mount.current
    if (!host) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 1.05, 6.8)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    host.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xc8ddff, 0x34213e, 2.1))
    const key = new THREE.DirectionalLight(0xffe0bd, 3.2); key.position.set(-3, 5, 5); scene.add(key)
    const rim = new THREE.PointLight(0x718cff, 22, 12); rim.position.set(2, 2, -2); scene.add(rim)
    const gold = new THREE.PointLight(0xffc96b, 10, 8); gold.position.set(-2, 1, 2); scene.add(gold)

    const guy = new THREE.Group(); scene.add(guy)
    const mat = (color: number, roughness = .62, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
    const skin = mat(0xe7a77f), skinShade = mat(0xc98261), hair = mat(0x211b2b), suit = mat(0x17294f, .38), suitLight = mat(0x344d80, .4), shirt = mat(0xf6f4ef), tie = mat(0xe5ad4f, .35), eyeWhite = mat(0xffffff), iris = mat(0x27334d), black = mat(0x171827), shoe = mat(0x101729, .32)
    const sphere = (parent: THREE.Object3D, material: THREE.Material, pos: [number,number,number], scale: [number,number,number]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material); m.position.set(...pos); m.scale.set(...scale); parent.add(m); return m }
    const box = (parent: THREE.Object3D, material: THREE.Material, pos: [number,number,number], scale: [number,number,number]) => { const g = new THREE.BoxGeometry(...scale); const m = new THREE.Mesh(g, material); m.position.set(...pos); parent.add(m); return m }

    // Oversized friendly animated-film head and sculpted hairstyle.
    sphere(guy, suit, [0,-.05,0], [.63,.72,.37])
    sphere(guy, shirt, [0,.05,.34], [.25,.48,.09])
    sphere(guy, suit, [0,-.48,0], [.83,.92,.48])
    sphere(guy, suitLight, [-.55,-.25,.04], [.2,.53,.43]); sphere(guy, suitLight, [.55,-.25,.04], [.2,.53,.43])
    sphere(guy, tie, [0,-.27,.445], [.105,.37,.075])
    sphere(guy, tie, [0,.04,.45], [.13,.12,.08])
    // Lapels
    const lapelL = box(guy, suitLight, [-.22,-.18,.43], [.16,.55,.07]); lapelL.rotation.z = -.28
    const lapelR = box(guy, suitLight, [.22,-.18,.43], [.16,.55,.07]); lapelR.rotation.z = .28
    sphere(guy, skinShade, [0,.52,.02], [.19,.22,.18])
    const head = new THREE.Group(); head.position.set(0,1.08,.05); guy.add(head)
    sphere(head, skin, [0,0,0], [.66,.77,.55])
    sphere(head, hair, [0,.52,-.02], [.67,.35,.56])
    sphere(head, hair, [-.38,.37,.18], [.24,.3,.3]); sphere(head, hair, [.15,.63,.19], [.38,.22,.25])
    // ears
    sphere(head, skinShade, [-.65,-.02,0], [.15,.23,.16]); sphere(head, skin, [.65,-.02,0], [.15,.23,.16])
    // eyebrows, eyes and smile
    for (const x of [-.25,.25]) {
      const brow = sphere(head, hair, [x,.2,.49], [.19,.055,.045]); brow.rotation.z = x < 0 ? .12 : -.12
      sphere(head, eyeWhite, [x,-.02,.49], [.16,.2,.09])
      sphere(head, iris, [x+.015,-.025,.57], [.075,.105,.045])
      sphere(head, black, [x+.018,-.025,.605], [.035,.06,.02])
      sphere(head, eyeWhite, [x-.015,.025,.622], [.025,.03,.014])
      sphere(head, skinShade, [x*1.7,-.24,.46], [.13,.065,.025])
    }
    const mouth = sphere(head, black, [0,-.34,.51], [.17,.045,.035])
    sphere(head, eyeWhite, [0,-.295,.52], [.12,.025,.02])
    // Arms, with right arm rigged for a pointing gesture.
    const armPivot = new THREE.Group(); armPivot.position.set(.68,-.18,0); guy.add(armPivot)
    const arm = sphere(armPivot, suit, [.22,-.3,0], [.23,.52,.25]); arm.rotation.z = -.4
    sphere(armPivot, skin, [.36,-.64,.03], [.19,.19,.18])
    const leftArm = sphere(guy, suit, [-.78,-.45,.03], [.22,.57,.24]); leftArm.rotation.z = .32
    sphere(guy, skin, [-.9,-.87,.08], [.18,.18,.18])
    // Handheld microphone
    const mic = new THREE.Group(); mic.position.set(-.98,-.48,.3); mic.rotation.z = -.22; guy.add(mic)
    const micMetal = mat(0xcbd5e1,.25,.75), micDark = mat(0x38445f,.3,.55)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.55,20), micMetal); mic.add(handle)
    const headMic = new THREE.Mesh(new THREE.SphereGeometry(.13,24,18), micDark); headMic.position.y=.3; mic.add(headMic)
    // legs and shoes
    for (const x of [-.34,.34]) { sphere(guy,suit,[x,-1.25,0],[.25,.48,.28]); sphere(guy,shoe,[x,-1.68,.12],[.3,.16,.43]) }
    guy.scale.setScalar(large ? 1.13 : .75)
    guy.position.y = large ? -.05 : -.12

    let raf = 0
    const clock = new THREE.Clock()
    const resize = new ResizeObserver(() => { if (!host.clientWidth || !host.clientHeight) return; camera.aspect=host.clientWidth/host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth,host.clientHeight) })
    resize.observe(host)
    const animate = () => {
      const t = clock.getElapsedTime()
      guy.position.y += (Math.sin(t*2.1)*.025 - (guy.position.y-(large ? -.05 : -.12)))*.08
      guy.rotation.y = Math.sin(t*.7)*.055
      head.rotation.y = Math.sin(t*1.1)*.045
      mouth.scale.y = speakingRef.current ? .12 + Math.abs(Math.sin(t*13))*.19 : .045
      armPivot.rotation.z += ((pointingRef.current ? -.9 : -.12) - armPivot.rotation.z)*.07
      renderer.render(scene,camera)
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => { cancelAnimationFrame(raf); resize.disconnect(); renderer.dispose(); scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m=o.material; if (Array.isArray(m)) m.forEach(x=>x.dispose()); else m.dispose() } }); renderer.domElement.remove() }
  }, [large])

  return <div ref={mount} className={large ? 'guy3d guy3d-large' : 'guy3d'} aria-label="גיא, מנחה תלת ממדי" />
}
