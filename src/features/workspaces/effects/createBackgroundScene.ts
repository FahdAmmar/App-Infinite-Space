import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  NormalBlending,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three'
import { approach, fibonacciSphere, smoothing } from './fibonacci-sphere'

/**
 * مشهد Three.js زخرفي لخلفية لوحة التحكم: كرتان من النقاط المضيئة تدوران ببطء وتتحركان قليلاً مع المؤشر.
 *
 * حدود صارمة بحسب المواصفات (زخرفة اختيارية لا تمس اللوحة):
 *  - يُحمَّل كسولاً (import ديناميكي) ولا يدخل حزمة المحرر.
 *  - لا يستقبل مؤشراً (الحاوية pointer-events: none) ولا يغيّر التركيز.
 *  - يتوقف تماماً (لا إطارات) حين تُخفى الصفحة أو يخرج المشهد من الشاشة.
 *  - دقة العرض محدودة (≤ 1.5) ويطلب GPU منخفض الاستهلاك.
 *  - dispose() يحرر كل موارد GPU والمستمعين ويزيل العنصر من الصفحة.
 *  - فشل إنشاء WebGL يرمي خطأً يتولاه المستدعي (يُعطَّل المؤثر بصمت، ولا أثر على الوظائف).
 */

export interface SceneColors {
  primary: string
  secondary: string
  /** السمة الداكنة تستعمل مزج الإضافة (توهج)؛ الفاتحة مزجاً عادياً بلون أغمق */
  additive: boolean
}

export interface BackgroundScene {
  setColors: (colors: SceneColors) => void
  dispose: () => void
}

const MAX_PIXEL_RATIO = 1.5
const MAX_DELTA = 0.1 // ثوانٍ: بعد توقف طويل لا نقفز

/** نقطة دائرية ناعمة الحواف (بلا ملف صورة): تدرج شعاعي صغير يُرسم مرة واحدة ويُحرَّر مع المشهد. */
function makeDotTexture(): CanvasTexture {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  return new CanvasTexture(canvas)
}

function makeCloud(
  count: number,
  radius: number,
  size: number,
  dot: CanvasTexture,
): { points: Points; geometry: BufferGeometry; material: PointsMaterial } {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(fibonacciSphere(count, radius), 3))
  const material = new PointsMaterial({ size, map: dot, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false })
  return { points: new Points(geometry, material), geometry, material }
}

export function createBackgroundScene(
  container: HTMLElement,
  initialColors: SceneColors,
  options: { followPointer: boolean; onContextLost: () => void },
): BackgroundScene {
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.append(canvas)

  const scene = new Scene()
  const camera = new PerspectiveCamera(45, 1, 0.1, 50)
  camera.position.z = 6.2

  const group = new Group()
  // حجم النقطة بوحدات العالم مع sizeAttenuation: ≈ size × (ارتفاع المشهد/2) ÷ المسافة بالبكسل. القيم أدناه تعطي 2–3px.
  const dot = makeDotTexture()
  const inner = makeCloud(560, 1.65, 0.11, dot)
  const outer = makeCloud(220, 2.5, 0.09, dot)
  group.add(inner.points, outer.points)
  scene.add(group)

  const applyColors = (colors: SceneColors): void => {
    inner.material.color = new Color(colors.primary)
    outer.material.color = new Color(colors.secondary)
    const blending = colors.additive ? AdditiveBlending : NormalBlending
    for (const material of [inner.material, outer.material]) {
      material.blending = blending
      material.opacity = colors.additive ? 0.9 : 0.75
      material.needsUpdate = true
    }
  }
  applyColors(initialColors)

  const resize = (): void => {
    const { clientWidth, clientHeight } = container
    if (clientWidth === 0 || clientHeight === 0) return
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  // تحريك المؤشر: ننقل الإحداثيات إلى [-1, 1] ونقرّب الدوران منها تدريجياً
  const pointer = { x: 0, y: 0 }
  const handlePointer = (event: PointerEvent): void => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1
  }
  if (options.followPointer) window.addEventListener('pointermove', handlePointer, { passive: true })

  let frame = 0
  let last = 0
  let visible = true
  let tabVisible = document.visibilityState === 'visible'
  let disposed = false
  let tiltX = 0
  let tiltY = 0

  const render = (time: number): void => {
    frame = 0
    if (disposed) return
    const delta = Math.min(MAX_DELTA, last === 0 ? 0 : (time - last) / 1000)
    last = time
    const follow = smoothing(3, delta)
    tiltY = approach(tiltY, pointer.x * 0.35, follow)
    tiltX = approach(tiltX, pointer.y * 0.2, follow)
    group.rotation.y += delta * 0.09
    group.rotation.x = tiltX
    group.position.x = approach(group.position.x, tiltY * 0.4, follow)
    renderer.render(scene, camera)
    schedule()
  }

  const schedule = (): void => {
    if (!frame && !disposed && visible && tabVisible) frame = requestAnimationFrame(render)
  }
  const stop = (): void => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    last = 0 // بعد الاستئناف لا نحسب الزمن المنقضي أثناء التوقف
  }

  // لا نرسم ما لا يراه أحد: خارج الشاشة أو في تبويب مخفي
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting)
    if (visible) schedule()
    else stop()
  })
  intersection.observe(container)
  const handleVisibility = (): void => {
    tabVisible = document.visibilityState === 'visible'
    if (tabVisible) schedule()
    else stop()
  }
  document.addEventListener('visibilitychange', handleVisibility)

  const handleContextLost = (event: Event): void => {
    event.preventDefault()
    stop()
    options.onContextLost()
  }
  canvas.addEventListener('webglcontextlost', handleContextLost)

  schedule()

  return {
    setColors: applyColors,
    dispose: () => {
      if (disposed) return
      disposed = true
      stop()
      resizeObserver.disconnect()
      intersection.disconnect()
      window.removeEventListener('pointermove', handlePointer)
      document.removeEventListener('visibilitychange', handleVisibility)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      for (const cloud of [inner, outer]) {
        group.remove(cloud.points)
        cloud.geometry.dispose()
        cloud.material.dispose()
      }
      dot.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
