'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/* ─────────────────────────────────────────────
   CONFIG — edit these to change your brochure
   ─────────────────────────────────────────────
   1. Put your compiled .mind file in /public/targets/target.mind
   2. Put your video in /public/videos/brochure-video.mp4
   3. Adjust VIDEO_ASPECT if your video isn't 16:9
      e.g. 1:1 square → width=1, height=1
           4:3        → width=1, height=0.75
           9:16       → width=1, height=1.77
*/
const TARGET_MIND  = '/targets/target.mind'   // compiled MindAR image target
const VIDEO_SRC    = '/videos/brochure-video.mp4'
const VIDEO_WIDTH  = 1        // AR plane width  (in A-Frame units)
const VIDEO_HEIGHT = 0.5625  // AR plane height — 16:9 ratio (1 × 9/16)

// MindAR smoothing — lower minCF = less jitter, higher tolerance = more stable lock
const FILTER_MIN_CF      = 0.0001
const FILTER_BETA        = 800
const MISS_TOLERANCE     = 12
const WARMUP_TOLERANCE   = 8

// Camera zoom: 1 = normal, 0.5 = zoomed out (wider). Lower = see more area.
const CAMERA_ZOOM        = 0.5

// ─────────────────────────────────────────────

const AFRAME_SRC = '/vendor/aframe.min.js'
const MINDAR_SRC = '/vendor/mindar-image-aframe.prod.js'

function waitForReady(check: () => boolean, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (check()) return resolve()
    const started = Date.now()
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        reject(new Error('Timed out waiting for AR library'))
      }
    }, 50)
  })
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
    if (existing?.dataset.loaded === 'true') {
      resolve()
      return
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

let arLibrariesPromise: Promise<void> | null = null

function loadARLibraries(): Promise<void> {
  if (arLibrariesPromise) return arLibrariesPromise

  arLibrariesPromise = (async () => {
    patchCameraConstraints()

    // Warm .mind cache while scripts finish loading
    fetch(TARGET_MIND).catch(() => {})

    if ((window as any).AFRAME?.components?.['mindar-image']) return

    // Layout preloads scripts — wait briefly, then fallback to dynamic load
    try {
      await waitForReady(() => !!(window as any).AFRAME?.components?.['mindar-image'], 8000)
    } catch {
      await loadScript(AFRAME_SRC)
      await waitForReady(() => !!(window as any).AFRAME)
      await loadScript(MINDAR_SRC)
      await waitForReady(() => !!(window as any).AFRAME?.components?.['mindar-image'])
    }
  })().catch((err) => {
    arLibrariesPromise = null
    throw err
  })

  return arLibrariesPromise
}

function patchCameraConstraints() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
  const media = navigator.mediaDevices
  if ((media as any).__arPatched) return

  const original = media.getUserMedia.bind(media)
  media.getUserMedia = (constraints) => {
    const next = { ...constraints } as MediaStreamConstraints
    if (next.video && typeof next.video === 'object') {
      next.video = {
        ...next.video,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        focusMode: { ideal: 'continuous' },
        zoom: { ideal: CAMERA_ZOOM },
      } as MediaTrackConstraints
    }
    return original(next)
  }
  ;(media as any).__arPatched = true
}

function makeSceneTransparent(scene: any) {
  if (!scene) return
  if (scene.object3D) scene.object3D.background = null
  if (scene.renderer) {
    scene.renderer.setClearColor(0x000000, 0)
    scene.renderer.domElement.style.background = 'transparent'
  }
  const bg = scene.components?.background
  if (bg?.mesh) bg.mesh.visible = false
}

function ensureFullScreenCamera(scene: any) {
  const camVideo = scene?.systems?.['mindar-image-system']?.video as HTMLVideoElement | undefined
  if (!camVideo) return

  // Override MindAR pixel positioning — always fill full viewport
  const zoomFactor = CAMERA_ZOOM < 1 ? (100 / CAMERA_ZOOM).toFixed(2) : '100'

  camVideo.style.setProperty('position', 'fixed', 'important')
  camVideo.style.setProperty('top', '50%', 'important')
  camVideo.style.setProperty('left', '50%', 'important')
  camVideo.style.setProperty('min-width', `${zoomFactor}vw`, 'important')
  camVideo.style.setProperty('min-height', `${zoomFactor}dvh`, 'important')
  camVideo.style.setProperty('width', 'auto', 'important')
  camVideo.style.setProperty('height', 'auto', 'important')
  camVideo.style.setProperty('transform', 'translate(-50%, -50%)', 'important')
  camVideo.style.setProperty('object-fit', 'cover', 'important')
  camVideo.style.setProperty('z-index', '0', 'important')
  camVideo.play().catch(() => {})
}

function ensureCameraVisible(scene: any) {
  ensureFullScreenCamera(scene)
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

function resizeMindAR() {
  const scene = document.getElementById('ar-scene') as any
  scene?.systems?.['mindar-image-system']?._resize?.()
  if (scene) ensureFullScreenCamera(scene)
}

async function focusCameraAtPoint(
  scene: any,
  clientX: number,
  clientY: number,
  container: HTMLElement,
) {
  const system = scene?.systems?.['mindar-image-system']
  const video = system?.video as HTMLVideoElement | undefined
  const track = (video?.srcObject as MediaStream | undefined)?.getVideoTracks()?.[0]
  if (!track?.applyConstraints) return

  const rect = container.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
  const caps = track.getCapabilities?.() ?? {} as MediaTrackCapabilities
  const focusModes = (caps as MediaTrackCapabilities & { focusMode?: string[] }).focusMode ?? []

  const attempts: MediaTrackConstraints[] = []

  if ((caps as any).pointsOfInterest) {
    attempts.push({ advanced: [{ pointsOfInterest: [{ x, y }] }] } as unknown as MediaTrackConstraints)
  }
  attempts.push({ pointsOfInterest: [{ x, y }] } as unknown as MediaTrackConstraints)

  if (focusModes.includes('single-shot')) {
    attempts.push({ advanced: [{ focusMode: 'single-shot' }] } as unknown as MediaTrackConstraints)
  } else if (focusModes.includes('manual')) {
    attempts.push({ advanced: [{ focusMode: 'manual' }] } as unknown as MediaTrackConstraints)
  }

  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints)
      break
    } catch {
      // try next method
    }
  }
}

async function enhanceCameraQuality(scene: any) {
  const system = scene?.systems?.['mindar-image-system']
  const video = system?.video as HTMLVideoElement | undefined
  const track = (video?.srcObject as MediaStream | undefined)?.getVideoTracks()?.[0]
  if (!track) return

  try {
    const caps = track.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min?: number; max?: number } }
    const zoomCaps = caps?.zoom
    const targetZoom = zoomCaps
      ? Math.max(zoomCaps.min ?? CAMERA_ZOOM, Math.min(zoomCaps.max ?? 1, CAMERA_ZOOM))
      : CAMERA_ZOOM

    await track.applyConstraints({
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      zoom: { ideal: targetZoom },
    } as MediaTrackConstraints)
  } catch {
    // Keep default camera settings if device rejects constraints
  }
  system?._resize?.()
  ensureFullScreenCamera(scene)
}

type Status = 'loading' | 'ready' | 'scanning' | 'detected' | 'error'
type FocusPoint = { x: number; y: number }

export default function ARViewer() {
  const sceneRef    = useRef<HTMLDivElement>(null)
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const sceneBuilt  = useRef(false)
  const [status, setStatus]   = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [detected, setDetected] = useState(false)
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null)

  const handleTapToFocus = useCallback((e: React.PointerEvent) => {
    if (status !== 'scanning' && status !== 'detected') return
    const container = sceneRef.current
    const scene = document.getElementById('ar-scene')
    if (!container || !scene) return

    const x = (e.clientX / window.innerWidth) * 100
    const y = (e.clientY / window.innerHeight) * 100
    setFocusPoint({ x, y })
    setTimeout(() => setFocusPoint(null), 700)

    focusCameraAtPoint(scene, e.clientX, e.clientY, container)
  }, [status])

  // ── inject the A-Frame / MindAR scene into the DOM ──────────────
  const buildScene = useCallback(() => {
    if (!sceneRef.current || sceneBuilt.current) return
    sceneBuilt.current = true

    sceneRef.current.innerHTML = `
      <a-scene
        id="ar-scene"
        mindar-image="imageTargetSrc: ${TARGET_MIND}; autoStart: true; uiLoading: no; uiError: no; uiScanning: no; filterMinCF: ${FILTER_MIN_CF}; filterBeta: ${FILTER_BETA}; missTolerance: ${MISS_TOLERANCE}; warmupTolerance: ${WARMUP_TOLERANCE};"
        color-space="sRGB"
        renderer="alpha: true; antialias: false; precision: mediump"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
      >
        <a-assets timeout="5000">
          <video
            id="brochure-video"
            preload="none"
            loop="true"
            playsinline
            webkit-playsinline
            muted
            crossorigin="anonymous"
          ></video>
        </a-assets>

        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <!-- Target 0 = first image in your .mind file -->
        <a-entity mindar-image-target="targetIndex: 0">
          <a-video
            src="#brochure-video"
            position="0 0 0.001"
            width="${VIDEO_WIDTH}"
            height="${VIDEO_HEIGHT}"
            rotation="0 0 0"
          ></a-video>
        </a-entity>
      </a-scene>
    `

    const scene = document.getElementById('ar-scene') as any

    scene?.addEventListener('loaded', () => {
      videoRef.current = document.getElementById('brochure-video') as HTMLVideoElement
      makeSceneTransparent(scene)
    })

    scene?.addEventListener('renderstart', () => {
      makeSceneTransparent(scene)
    })

    scene?.addEventListener('arReady', () => {
      setStatus('scanning')
      resizeMindAR()
      makeSceneTransparent(scene)
      ensureCameraVisible(scene)
      resizeMindAR()

      // Improve quality in background — don't block camera startup
      const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000))
      idle(() => enhanceCameraQuality(scene))
    })

    scene?.addEventListener('arError', (e: any) => {
      console.error('AR Error:', e)
      setStatus('error')
      const detail = e?.detail?.error
      if (detail === 'VIDEO_FAIL') {
        setErrorMsg('Camera access denied. Allow camera permission and reload the page.')
      } else {
        setErrorMsg('AR failed to start. Use Chrome/Safari on a phone with HTTPS.')
      }
    })

    // ── Brochure detected ──
    scene?.addEventListener('targetFound', () => {
      setDetected(true)
      setStatus('detected')

      const vid = videoRef.current
      if (!vid) return

      if (!vid.src) vid.src = VIDEO_SRC
      vid.muted = false
      vid.play().catch(() => {
        vid.muted = true
        vid.play()
      })
    })

    // ── Brochure lost ──
    scene?.addEventListener('targetLost', () => {
      setDetected(false)
      setStatus('scanning')
      videoRef.current?.pause()
    })
  }, [])

  useEffect(() => {
    const onResize = debounce(() => resizeMindAR(), 200)
    window.addEventListener('orientationchange', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('orientationchange', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await loadARLibraries()
        if (cancelled) return
        buildScene()
      } catch {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg('AR library failed to load. Please refresh the page.')
        }
      }
    }

    init()
    return () => {
      cancelled = true
      sceneBuilt.current = false
    }
  }, [buildScene])

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-black overflow-hidden touch-none">

      <div ref={sceneRef} className="ar-scene-container" />

      {/* ── Loading overlay ── */}
      {status === 'loading' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black gap-5">
          <div
            className="spinner w-12 h-12 rounded-full border-4 border-white/10"
            style={{ borderTopColor: '#6366f1' }}
          />
          <p className="text-white/60 text-sm tracking-wide">Starting AR camera…</p>
        </div>
      )}

      {/* ── Error screen ── */}
      {status === 'error' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-8 text-center gap-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-white font-bold text-lg">AR Unavailable</h2>
          <p className="text-white/50 text-sm leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold"
          >
            Try Again
          </button>
          <p className="text-white/30 text-xs mt-1">
            Use Chrome on Android or Safari on iPhone
          </p>
        </div>
      )}

      {/* Tap anywhere to focus camera */}
      {(status === 'scanning' || status === 'detected') && (
        <div
          className="fixed inset-0 z-10"
          onPointerDown={handleTapToFocus}
          aria-label="Tap to focus camera"
        />
      )}

      {/* Focus ring feedback */}
      {focusPoint && (
        <div
          className="fixed z-30 pointer-events-none focus-ring"
          style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
        />
      )}

      {/* Scanning status only */}
      {(status === 'scanning' || status === 'detected') && (
        <div className="fixed top-4 right-4 z-20 pointer-events-none">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium backdrop-blur-sm ${
            detected
              ? 'bg-green-500/30 text-green-300'
              : 'bg-black/40 text-white/80'
          }`}>
            {detected ? '● Brochure detected' : '● Scanning…'}
          </span>
        </div>
      )}

    </div>
  )
}
