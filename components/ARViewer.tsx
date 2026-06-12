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

// ─────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

type Status = 'loading' | 'ready' | 'scanning' | 'detected' | 'error'

export default function ARViewer() {
  const sceneRef    = useRef<HTMLDivElement>(null)
  const videoRef    = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus]   = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [detected, setDetected] = useState(false)

  // ── inject the A-Frame / MindAR scene into the DOM ──────────────
  const buildScene = useCallback(() => {
    if (!sceneRef.current) return

    sceneRef.current.innerHTML = `
      <a-scene
        id="ar-scene"
        mindar-image="imageTargetSrc: ${TARGET_MIND}; autoStart: true; uiLoading: no; uiError: no; uiScanning: no;"
        color-space="sRGB"
        renderer="colorManagement: true; physicallyCorrectLights: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
      >
        <a-assets timeout="10000">
          <video
            id="brochure-video"
            src="${VIDEO_SRC}"
            preload="auto"
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
      setStatus('scanning')
    })

    scene?.addEventListener('arError', (e: any) => {
      console.error('AR Error:', e)
      setStatus('error')
      setErrorMsg('Camera access denied or AR not supported on this browser.')
    })

    // ── Brochure detected ──
    scene?.addEventListener('targetFound', () => {
      setDetected(true)
      setStatus('detected')

      const vid = videoRef.current
      if (!vid) return

      vid.muted = false
      vid.play().catch(() => {
        // Auto-play blocked — retry muted (browser policy)
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
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | undefined

    async function init() {
      try {
        await loadScript('/vendor/aframe.min.js')
        await loadScript('/vendor/mindar-image-aframe.prod.js')

        if (cancelled) return

        const AFRAME = (window as any).AFRAME
        if (AFRAME?.components?.['mindar-image']) {
          buildScene()
          return
        }

        // Fallback: poll briefly in case registration is deferred
        let attempts = 0
        interval = setInterval(() => {
          if (cancelled) return
          attempts++
          const af = (window as any).AFRAME
          if (af?.components?.['mindar-image']) {
            clearInterval(interval)
            buildScene()
          } else if (attempts > 30) {
            clearInterval(interval)
            setStatus('error')
            setErrorMsg('AR library failed to load. Please refresh.')
          }
        }, 100)
      } catch {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg('AR library failed to load. Please refresh.')
        }
      }
    }

    init()
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [buildScene])

  return (
    <div className="fixed inset-0 bg-black">

      {/* ── A-Frame scene container ── */}
      <div ref={sceneRef} className="fixed inset-0 z-0" />

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

      {/* ── Top HUD (shown while scanning or detected) ── */}
      {(status === 'scanning' || status === 'detected') && (
        <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}
        >
          <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">
            AR Live
          </span>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            detected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-white/10 text-white/50'
          }`}>
            {detected ? '● Brochure detected' : '● Scanning…'}
          </span>
        </div>
      )}

      {/* ── Scan frame + hint (only while scanning) ── */}
      {status === 'scanning' && (
        <>
          {/* Corner frame */}
          <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div
              className="scan-corner relative"
              style={{ width: 'min(75vw, 300px)', aspectRatio: '1.414' }}
            >
              {/* TL */}
              <span className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
              {/* TR */}
              <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
              {/* BL */}
              <span className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
              {/* BR */}
              <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-indigo-400 rounded-br" />
            </div>
          </div>

          {/* Bottom hint */}
          <div className="fixed bottom-10 left-0 right-0 z-20 flex justify-center">
            <div className="scan-corner px-5 py-2.5 rounded-2xl text-white/80 text-sm text-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              🔍 Point camera at your brochure
            </div>
          </div>
        </>
      )}

      {/* ── Detected flash badge ── */}
      {status === 'detected' && (
        <div className="fixed bottom-10 left-0 right-0 z-20 flex justify-center fade-in">
          <div className="px-5 py-2.5 rounded-2xl text-white text-sm font-semibold"
            style={{ background: 'rgba(99,102,241,0.75)', backdropFilter: 'blur(8px)' }}
          >
            ▶ Playing video
          </div>
        </div>
      )}

    </div>
  )
}
