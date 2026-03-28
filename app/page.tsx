"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Upload, Download, Copy, MousePointer2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ColorPicker, type GradientConfig, type GradientStop } from "@/components/color-picker"
import "@/styles/dither.css"

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v / 16) * 255))

interface Particle {
  restX: number
  restY: number
  cx: number
  cy: number
  vx: number
  vy: number
}

export default function DitherTool() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [sourceSize, setSourceSize] = useState({ width: 1024, height: 1024 })
  const [algorithm, setAlgorithm] = useState("Floyd-Steinberg")
  const [threshold, setThreshold] = useState(150)
  const [invert, setInvert] = useState(false)
  const [scale, setScale] = useState(72)
  const [contrast, setContrast] = useState(10)
  const [gamma, setGamma] = useState(0.79)
  const [highlightsCompression, setHighlightsCompression] = useState(0)
  const [blurRadius, setBlurRadius] = useState(0)
  const [errorStrength, setErrorStrength] = useState(100)
  const [serpentine, setSerpentine] = useState(true)
  const [cornerRadius, setCornerRadius] = useState(20)
  const [renderScale, setRenderScale] = useState(0.49)
  const [dots, setDots] = useState<{ x: number; y: number }[]>([])
  const [outputSize, setOutputSize] = useState({ width: 205, height: 205 })

  // Mouse effect controls
  const [influenceRadius, setInfluenceRadius] = useState(20)
  const [pushStrength, setPushStrength] = useState(30)
  const [returnSpeed, setReturnSpeed] = useState(1)
  const [friction, setFriction] = useState(100)
  const [trailLength, setTrailLength] = useState(20)

  // Particle effect controls
  const [particleOpacity, setParticleOpacity] = useState(100)
  const [particleColor, setParticleColor] = useState("#000000")
  const [gradientConfig, setGradientConfig] = useState<GradientConfig>({
    enabled: false,
    type: "linear",
    angle: 180,
    stops: [
      { id: "stop-1", color: "#000000", position: 0 },
      { id: "stop-2", color: "#666666", position: 100 },
    ],
  })

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null)
  const ditherCanvasRef = useRef<HTMLCanvasElement>(null)
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const liveContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Particle system refs (mutable, no re-renders)
  const particlesRef = useRef<Particle[]>([])
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const liveSizeRef = useRef({ width: 800, height: 600 })

  // Keep effect values in refs so animation loop sees latest without re-creating
  const influenceRadiusRef = useRef(influenceRadius)
  const pushStrengthRef = useRef(pushStrength)
  const returnSpeedRef = useRef(returnSpeed)
  const frictionRef = useRef(friction)
  const trailLengthRef = useRef(trailLength)
  const particleOpacityRef = useRef(particleOpacity)
  const particleColorRef = useRef(particleColor)
  const gradientConfigRef = useRef(gradientConfig)
  const invertRef = useRef(invert)
  const renderScaleRef = useRef(renderScale)
  const outputSizeRef = useRef(outputSize)

  useEffect(() => { influenceRadiusRef.current = influenceRadius }, [influenceRadius])
  useEffect(() => { pushStrengthRef.current = pushStrength }, [pushStrength])
  useEffect(() => { returnSpeedRef.current = returnSpeed }, [returnSpeed])
  useEffect(() => { frictionRef.current = friction }, [friction])
  useEffect(() => { trailLengthRef.current = trailLength }, [trailLength])
  useEffect(() => { particleOpacityRef.current = particleOpacity }, [particleOpacity])
  useEffect(() => { particleColorRef.current = particleColor }, [particleColor])
  useEffect(() => { gradientConfigRef.current = gradientConfig }, [gradientConfig])
  useEffect(() => { invertRef.current = invert }, [invert])
  useEffect(() => { renderScaleRef.current = renderScale }, [renderScale])
  useEffect(() => { outputSizeRef.current = outputSize }, [outputSize])

  // Live canvas size — state triggers particle rebuild, ref for animation loop
  const [liveCanvasSize, setLiveCanvasSize] = useState({ width: 800, height: 600 })

  // Track live canvas container size
  useEffect(() => {
    const el = liveContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (w > 0 && h > 0) {
        liveSizeRef.current = { width: w, height: h }
        setLiveCanvasSize({ width: w, height: h })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const generateDefaultImage = useCallback(() => {
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="147" height="70" viewBox="0 0 147 70"><path d="M56 50.2031V14H70V60.1562C70 65.5928 65.5928 70 60.1562 70C57.5605 70 54.9982 68.9992 53.1562 67.1573L0 14H19.7969L56 50.2031Z" fill="black"/><path d="M147 56H133V23.9531L100.953 56H133V70H96.6875C85.8144 70 77 61.1856 77 50.3125V14H91V46.1562L123.156 14H91V0H127.312C138.186 0 147 8.81439 147 19.6875V56Z" fill="black"/></svg>`
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setSourceImage(img)
      setSourceSize({ width: 147, height: 70 })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [])

  useEffect(() => {
    generateDefaultImage()
  }, [generateDefaultImage])

  const applyToneCurve = (value: number): number => {
    let v = value / 255
    if (contrast !== 0) {
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      v = factor * (v - 0.5) + 0.5
    }
    v = Math.pow(Math.max(0, Math.min(1, v)), 1 / gamma)
    if (highlightsCompression > 0) {
      const comp = highlightsCompression / 100
      v = v * (1 - comp * 0.5) + comp * 0.25 * v * v
    }
    return Math.max(0, Math.min(255, v * 255))
  }

  const applyBlur = (
    pixels: Uint8ClampedArray, width: number, height: number, radius: number
  ): Uint8ClampedArray => {
    if (radius === 0) return pixels
    const result = new Uint8ClampedArray(pixels.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += pixels[(ny * width + nx) * 4]
              count++
            }
          }
        }
        const idx = (y * width + x) * 4
        const avg = sum / count
        result[idx] = avg
        result[idx + 1] = avg
        result[idx + 2] = avg
        result[idx + 3] = 255
      }
    }
    return result
  }

  const createRoundedMask = (
    width: number, height: number, radiusPercent: number
  ): boolean[][] => {
    const mask: boolean[][] = []
    const radius = Math.min(width, height) * (radiusPercent / 100) * 0.5
    for (let y = 0; y < height; y++) {
      mask[y] = []
      for (let x = 0; x < width; x++) {
        let inside = true
        if (x < radius && y < radius) {
          inside = Math.hypot(x - radius, y - radius) <= radius
        } else if (x >= width - radius && y < radius) {
          inside = Math.hypot(x - (width - radius), y - radius) <= radius
        } else if (x < radius && y >= height - radius) {
          inside = Math.hypot(x - radius, y - (height - radius)) <= radius
        } else if (x >= width - radius && y >= height - radius) {
          inside = Math.hypot(x - (width - radius), y - (height - radius)) <= radius
        }
        mask[y][x] = inside
      }
    }
    return mask
  }

  // Generic error-diffusion dithering engine
  // kernel: array of [dx, dy, weight] offsets (for left-to-right scan)
  // divisor: sum to divide error by (0 = weights are pre-normalized, e.g. Atkinson)
  const errorDiffusionDither = (
    pixels: Float32Array, width: number, height: number,
    threshold: number, strength: number, serpentine: boolean,
    kernel: [number, number, number][], divisor: number
  ): boolean[][] => {
    const result: boolean[][] = []
    const data = new Float32Array(pixels)
    for (let y = 0; y < height; y++) {
      result[y] = []
      const leftToRight = !serpentine || y % 2 === 0
      const startX = leftToRight ? 0 : width - 1
      const endX = leftToRight ? width : -1
      const step = leftToRight ? 1 : -1
      for (let x = startX; x !== endX; x += step) {
        const idx = y * width + x
        const oldPixel = data[idx]
        const newPixel = oldPixel < threshold ? 0 : 255
        result[y][x] = newPixel === 0
        const rawError = (oldPixel - newPixel) * (strength / 100)
        for (let k = 0; k < kernel.length; k++) {
          const kDx = leftToRight ? kernel[k][0] : -kernel[k][0]
          const kDy = kernel[k][1]
          const weight = kernel[k][2]
          const nx = x + kDx
          const ny = y + kDy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            data[ny * width + nx] += divisor > 0
              ? (rawError * weight) / divisor
              : rawError * weight
          }
        }
      }
    }
    return result
  }

  // Floyd-Steinberg: /16
  const KERNEL_FLOYD_STEINBERG: [number, number, number][] = [
    [1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1],
  ]

  // Jarvis, Judice, Ninke: /48
  const KERNEL_JJN: [number, number, number][] = [
    [1, 0, 7], [2, 0, 5],
    [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
    [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
  ]

  // Stucki: /42
  const KERNEL_STUCKI: [number, number, number][] = [
    [1, 0, 8], [2, 0, 4],
    [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
    [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
  ]

  // Atkinson: each neighbor gets 1/8 of error (only 6/8 diffused)
  const KERNEL_ATKINSON: [number, number, number][] = [
    [1, 0, 1], [2, 0, 1],
    [-1, 1, 1], [0, 1, 1], [1, 1, 1],
    [0, 2, 1],
  ]

  // Burkes: /32
  const KERNEL_BURKES: [number, number, number][] = [
    [1, 0, 8], [2, 0, 4],
    [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
  ]

  // Sierra (full): /32
  const KERNEL_SIERRA: [number, number, number][] = [
    [1, 0, 5], [2, 0, 3],
    [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
    [-1, 2, 2], [0, 2, 3], [1, 2, 2],
  ]

  const orderedDither = (
    pixels: Float32Array, width: number, height: number, threshold: number
  ): boolean[][] => {
    const result: boolean[][] = []
    for (let y = 0; y < height; y++) {
      result[y] = []
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const bayerValue = BAYER_4X4[y % 4][x % 4]
        const adjustedThreshold = threshold + bayerValue - 128
        result[y][x] = pixels[idx] < adjustedThreshold
      }
    }
    return result
  }

  // Build particles from dots whenever dithering changes
  const buildParticles = useCallback((
    newDots: { x: number; y: number }[], w: number, h: number
  ) => {
    const { width: liveW, height: liveH } = liveSizeRef.current
    const fitSize = Math.min(liveW, liveH)
    const dScale = (fitSize / Math.max(w, h)) * renderScaleRef.current
    const offX = (liveW - w * dScale) / 2
    const offY = (liveH - h * dScale) / 2

    particlesRef.current = newDots.map((dot) => {
      const rx = offX + dot.x * dScale
      const ry = offY + dot.y * dScale
      return { restX: rx, restY: ry, cx: rx, cy: ry, vx: 0, vy: 0 }
    })
  }, [])

  const processDither = useCallback(() => {
    if (!sourceImage || !sourceCanvasRef.current) return
    const srcCanvas = sourceCanvasRef.current
    const srcCtx = srcCanvas.getContext("2d")!
    const scaleFactor = scale / 100
    const width = Math.max(1, Math.floor(sourceImage.width * scaleFactor))
    const height = Math.max(1, Math.floor(sourceImage.height * scaleFactor))
    srcCanvas.width = width
    srcCanvas.height = height
    // White background so transparent SVG areas read as white in luminance
    srcCtx.fillStyle = "#ffffff"
    srcCtx.fillRect(0, 0, width, height)
    srcCtx.drawImage(sourceImage, 0, 0, width, height)
    const imageData = srcCtx.getImageData(0, 0, width, height)
    const pixels = imageData.data
    const grayscale = new Float32Array(width * height)
    for (let i = 0; i < width * height; i++) {
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2]
      let lum = 0.299 * r + 0.587 * g + 0.114 * b
      lum = applyToneCurve(lum)
      grayscale[i] = lum
    }
    if (blurRadius > 0) {
      const blurredPixels = new Uint8ClampedArray(width * height * 4)
      for (let i = 0; i < grayscale.length; i++) {
        blurredPixels[i * 4] = grayscale[i]
        blurredPixels[i * 4 + 1] = grayscale[i]
        blurredPixels[i * 4 + 2] = grayscale[i]
        blurredPixels[i * 4 + 3] = 255
      }
      const blurred = applyBlur(blurredPixels, width, height, blurRadius)
      for (let i = 0; i < grayscale.length; i++) grayscale[i] = blurred[i * 4]
    }
    const mask = createRoundedMask(width, height, cornerRadius)
    let ditherResult: boolean[][]
    switch (algorithm) {
      case "Jarvis-Judice-Ninke":
        ditherResult = errorDiffusionDither(grayscale, width, height, threshold, errorStrength, serpentine, KERNEL_JJN, 48)
        break
      case "Stucki":
        ditherResult = errorDiffusionDither(grayscale, width, height, threshold, errorStrength, serpentine, KERNEL_STUCKI, 42)
        break
      case "Atkinson":
        ditherResult = errorDiffusionDither(grayscale, width, height, threshold, errorStrength, serpentine, KERNEL_ATKINSON, 8)
        break
      case "Burkes":
        ditherResult = errorDiffusionDither(grayscale, width, height, threshold, errorStrength, serpentine, KERNEL_BURKES, 32)
        break
      case "Sierra":
        ditherResult = errorDiffusionDither(grayscale, width, height, threshold, errorStrength, serpentine, KERNEL_SIERRA, 32)
        break
      case "Ordered":
        ditherResult = orderedDither(grayscale, width, height, threshold)
        break
      default:
        ditherResult = errorDiffusionDither(grayscale, width, height, threshold, errorStrength, serpentine, KERNEL_FLOYD_STEINBERG, 16)
    }
    const newDots: { x: number; y: number }[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y][x]) continue
        let isDot = ditherResult[y][x]
        if (invert) isDot = !isDot
        if (isDot) newDots.push({ x, y })
      }
    }
    setDots(newDots)
    setOutputSize({ width, height })

    if (ditherCanvasRef.current) {
      const ditherCanvas = ditherCanvasRef.current
      ditherCanvas.width = width
      ditherCanvas.height = height
      const ditherCtx = ditherCanvas.getContext("2d")!
      // Match live renderer: white bg + black dots (normal), black bg + white dots (inverted)
      ditherCtx.fillStyle = invert ? "#000000" : "#ffffff"
      ditherCtx.fillRect(0, 0, width, height)
      ditherCtx.fillStyle = invert ? "#ffffff" : "#000000"
      newDots.forEach((dot) => ditherCtx.fillRect(dot.x, dot.y, 1, 1))
    }

    buildParticles(newDots, width, height)
  }, [
    sourceImage, algorithm, threshold, invert, scale, contrast, gamma,
    highlightsCompression, blurRadius, errorStrength, serpentine, cornerRadius, renderScale, buildParticles,
  ])

  useEffect(() => { processDither() }, [processDither])

  // Rebuild rest positions when renderScale or canvas size changes
  useEffect(() => {
    if (dots.length === 0) return
    const { width: liveW, height: liveH } = liveSizeRef.current
    const fitSize = Math.min(liveW, liveH)
    const w = outputSize.width, h = outputSize.height
    const dScale = (fitSize / Math.max(w, h)) * renderScale
    const offX = (liveW - w * dScale) / 2
    const offY = (liveH - h * dScale) / 2
    const particles = particlesRef.current
    dots.forEach((dot, i) => {
      if (!particles[i]) return
      particles[i].restX = offX + dot.x * dScale
      particles[i].restY = offY + dot.y * dScale
    })
  }, [renderScale, dots, outputSize, liveCanvasSize])

  // Main animation loop — runs once, reads refs
  useEffect(() => {
    let running = true
    lastTimeRef.current = performance.now()
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    // Parse hex color to RGB tuple
    const parseHex = (hex: string): [number, number, number] => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]

    // Build a color lookup table from gradient stops (multi-stop)
    const GRAD_LUT_SIZE = 64
    const buildGradientLUT = (stops: GradientStop[], opacity: number): string[] => {
      const sorted = stops.slice().sort((a, b) => a.position - b.position)
      const lut: string[] = []
      for (let i = 0; i <= GRAD_LUT_SIZE; i++) {
        const tPct = (i / GRAD_LUT_SIZE) * 100
        // Clamp to first/last stop
        if (tPct <= sorted[0].position) {
          const [r, g, b] = parseHex(sorted[0].color)
          lut.push(`rgba(${r},${g},${b},${opacity})`); continue
        }
        if (tPct >= sorted[sorted.length - 1].position) {
          const [r, g, b] = parseHex(sorted[sorted.length - 1].color)
          lut.push(`rgba(${r},${g},${b},${opacity})`); continue
        }
        // Find surrounding pair
        let lo = sorted[0], hi = sorted[sorted.length - 1]
        for (let j = 0; j < sorted.length - 1; j++) {
          if (tPct >= sorted[j].position && tPct <= sorted[j + 1].position) {
            lo = sorted[j]; hi = sorted[j + 1]; break
          }
        }
        const range = hi.position - lo.position
        const lt = range === 0 ? 0 : (tPct - lo.position) / range
        const [r1, g1, b1] = parseHex(lo.color)
        const [r2, g2, b2] = parseHex(hi.color)
        lut.push(`rgba(${Math.round(r1 + (r2 - r1) * lt)},${Math.round(g1 + (g2 - g1) * lt)},${Math.round(b1 + (b2 - b1) * lt)},${opacity})`)
      }
      return lut
    }

    // Compute gradient parameter t (0–1) for a particle based on type
    const gradientParam = (
      px: number, py: number, type: string, angle: number,
      cw: number, ch: number
    ): number => {
      const cx = cw / 2, cy = ch / 2
      const span = Math.max(cw, ch)
      switch (type) {
        case "radial": {
          const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
          return Math.min(1, dist / (span * 0.5))
        }
        case "conic": {
          const a = Math.atan2(py - cy, px - cx)
          return (a + Math.PI) / (2 * Math.PI)
        }
        default: { // linear
          const rad = ((angle - 90) * Math.PI) / 180
          const dx = Math.cos(rad), dy = Math.sin(rad)
          const dot = (px - cx) * dx + (py - cy) * dy
          const maxDot = span * 0.5
          return Math.max(0, Math.min(1, (dot + maxDot) / (2 * maxDot)))
        }
      }
    }

    // Shared helper: read current canvas size and sync resolution
    const syncCanvasSize = (canvas: HTMLCanvasElement): { liveW: number; liveH: number } => {
      const { width: liveW, height: liveH } = liveSizeRef.current
      if (canvas.width !== liveW) canvas.width = liveW
      if (canvas.height !== liveH) canvas.height = liveH
      return { liveW, liveH }
    }

    const drawStatic = () => {
      const liveCanvas = liveCanvasRef.current
      if (!liveCanvas) return
      const { liveW, liveH } = syncCanvasSize(liveCanvas)
      const liveCtx = liveCanvas.getContext("2d")!
      liveCtx.clearRect(0, 0, liveW, liveH)
      liveCtx.fillStyle = invertRef.current ? "#000000" : "#ffffff"
      liveCtx.fillRect(0, 0, liveW, liveH)
      const particles = particlesRef.current
      const opacity = particleOpacityRef.current / 100
      const color = particleColorRef.current
      const gc = gradientConfigRef.current
      const w = outputSizeRef.current.width
      const h = outputSizeRef.current.height
      const fitSize = Math.min(liveW, liveH)
      const dScale = (fitSize / Math.max(w, h)) * renderScaleRef.current
      const dotRadius = Math.max(0.3, dScale * 0.5)

      const isInverted = invertRef.current
      if (gc.enabled && gc.stops.length >= 2) {
        const lut = buildGradientLUT(gc.stops, opacity)
        let lastIdx = -1
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          const t = gradientParam(p.restX, p.restY, gc.type, gc.angle, liveW, liveH)
          const idx = Math.min(GRAD_LUT_SIZE, Math.max(0, Math.round(t * GRAD_LUT_SIZE)))
          if (idx !== lastIdx) { liveCtx.fillStyle = lut[idx]; lastIdx = idx }
          liveCtx.beginPath()
          liveCtx.arc(p.restX, p.restY, dotRadius, 0, Math.PI * 2)
          liveCtx.fill()
        }
      } else {
        const effectiveColor = (isInverted && color === "#000000") ? "#ffffff" : color
        const [cr, cg, cb] = parseHex(effectiveColor)
        liveCtx.fillStyle = `rgba(${cr},${cg},${cb},${opacity})`
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          liveCtx.beginPath()
          liveCtx.arc(p.restX, p.restY, dotRadius, 0, Math.PI * 2)
          liveCtx.fill()
        }
      }
    }

    const animate = (now: number) => {
      if (!running) return

      // Honor prefers-reduced-motion: draw static, skip physics
      if (prefersReducedMotion.matches) {
        drawStatic()
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      const liveCanvas = liveCanvasRef.current
      if (!liveCanvas) { animFrameRef.current = requestAnimationFrame(animate); return }

      const { liveW, liveH } = syncCanvasSize(liveCanvas)
      const liveCtx = liveCanvas.getContext("2d")!
      liveCtx.clearRect(0, 0, liveW, liveH)
      liveCtx.fillStyle = invertRef.current ? "#000000" : "#ffffff"
      liveCtx.fillRect(0, 0, liveW, liveH)

      const mouse = mousePosRef.current
      const particles = particlesRef.current
      const radius = influenceRadiusRef.current
      const strength = pushStrengthRef.current
      const returnSpd = returnSpeedRef.current / 100
      const fric = 1 - (frictionRef.current / 100) * 0.15
      // trailLength 0 = instant snap (decay=1), 100 = max trail (decay~0)
      const decay = 1 - trailLengthRef.current / 100
      const opacity = particleOpacityRef.current / 100
      const color = particleColorRef.current
      const gc = gradientConfigRef.current
      const w = outputSizeRef.current.width
      const h = outputSizeRef.current.height
      const fitSize = Math.min(liveW, liveH)
      const dScale = (fitSize / Math.max(w, h)) * renderScaleRef.current
      const dotRadius = Math.max(0.3, dScale * 0.5)

      const isInverted = invertRef.current
      const useGrad = gc.enabled && gc.stops.length >= 2
      const gradLUT = useGrad ? buildGradientLUT(gc.stops, opacity) : null
      if (!useGrad) {
        const effectiveColor = (isInverted && color === "#000000") ? "#ffffff" : color
        const [cr, cg, cb] = parseHex(effectiveColor)
        liveCtx.fillStyle = `rgba(${cr},${cg},${cb},${opacity})`
      }
      let lastIdx = -1

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        if (mouse) {
          const dx = p.cx - mouse.x
          const dy = p.cy - mouse.y
          const distSq = dx * dx + dy * dy
          const radiusSq = radius * radius
          if (distSq < radiusSq && distSq > 0.01) {
            const dist = Math.sqrt(distSq)
            const t = 1 - dist / radius
            const force = strength * t * t * t * dt * 60
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          }
        }

        const springDx = p.restX - p.cx
        const springDy = p.restY - p.cy
        p.vx += springDx * returnSpd
        p.vy += springDy * returnSpd
        p.vx *= fric
        p.vy *= fric
        p.cx += p.vx * dt * 60
        p.cy += p.vy * dt * 60

        // Position decay — lerp back toward rest to limit trail
        if (decay > 0) {
          const d = 1 - Math.pow(1 - decay, dt * 60)
          p.cx += (p.restX - p.cx) * d
          p.cy += (p.restY - p.cy) * d
        }

        if (gradLUT) {
          const t = gradientParam(p.restX, p.restY, gc.type, gc.angle, liveW, liveH)
          const idx = Math.min(GRAD_LUT_SIZE, Math.max(0, Math.round(t * GRAD_LUT_SIZE)))
          if (idx !== lastIdx) { liveCtx.fillStyle = gradLUT[idx]; lastIdx = idx }
        }

        liveCtx.beginPath()
        liveCtx.arc(p.cx, p.cy, dotRadius, 0, Math.PI * 2)
        liveCtx.fill()
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, []) // runs once — everything is in refs

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    // Scale from CSS coordinates to canvas pixel coordinates
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    mousePosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleCanvasMouseLeave = () => {
    mousePosRef.current = null
  }

  // Detect if a CSS color string is "light" (high luminance, poor contrast on white)
  const isLightColor = useCallback((color: string): boolean => {
    if (!color || color === "none" || color === "transparent" || color === "currentColor" || color === "inherit") return false
    const c = color.trim().toLowerCase()
    // Named light colors
    const lightNames = ["white", "snow", "ivory", "ghostwhite", "whitesmoke", "seashell",
      "beige", "linen", "floralwhite", "oldlace", "antiquewhite", "papayawhip",
      "blanchedalmond", "bisque", "lightyellow", "cornsilk", "lemonchiffon",
      "mintcream", "azure", "aliceblue", "lavenderblush", "mistyrose", "honeydew"]
    if (lightNames.includes(c)) return true
    // Hex
    if (c.startsWith("#")) {
      const hex = c.slice(1)
      let r: number, g: number, b: number
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16); g = parseInt(hex[1] + hex[1], 16); b = parseInt(hex[2] + hex[2], 16)
      } else if (hex.length >= 6) {
        r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16)
      } else return false
      return (0.299 * r + 0.587 * g + 0.114 * b) > 200
    }
    // rgb/rgba
    const rgbMatch = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (rgbMatch) {
      return (0.299 * +rgbMatch[1] + 0.587 * +rgbMatch[2] + 0.114 * +rgbMatch[3]) > 200
    }
    return false
  }, [])

  // Walk SVG DOM and recolor light fills/strokes to black for dithering contrast
  const recolorLightSvgElements = useCallback((svgEl: Element): boolean => {
    let recolored = false
    const process = (el: Element) => {
      for (const attr of ["fill", "stroke"] as const) {
        const val = el.getAttribute(attr)
        if (val && isLightColor(val)) {
          el.setAttribute(attr, "#000000")
          recolored = true
        }
      }
      const style = el.getAttribute("style")
      if (style) {
        let newStyle = style
        const fillMatch = style.match(/fill:\s*([^;]+)/)
        if (fillMatch && isLightColor(fillMatch[1].trim())) {
          newStyle = newStyle.replace(/fill:\s*[^;]+/, "fill: #000000")
          recolored = true
        }
        const strokeMatch = style.match(/stroke:\s*([^;]+)/)
        if (strokeMatch && isLightColor(strokeMatch[1].trim())) {
          newStyle = newStyle.replace(/stroke:\s*[^;]+/, "stroke: #000000")
          recolored = true
        }
        if (newStyle !== style) el.setAttribute("style", newStyle)
      }
    }
    process(svgEl)
    svgEl.querySelectorAll("*").forEach(process)
    return recolored
  }, [isLightColor])

  const handleFileUpload = (file: File) => {
    const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg")

    if (isSvg) {
      // SVG: parse text, fix dimensions, recolor light fills
      const reader = new FileReader()
      reader.onload = (e) => {
        const svgText = e.target?.result as string
        const parser = new DOMParser()
        const doc = parser.parseFromString(svgText, "image/svg+xml")
        const svgEl = doc.querySelector("svg")
        if (!svgEl) return

        let w = parseFloat(svgEl.getAttribute("width") || "0")
        let h = parseFloat(svgEl.getAttribute("height") || "0")
        const viewBox = svgEl.getAttribute("viewBox")
        if ((!w || !h) && viewBox) {
          const parts = viewBox.split(/[\s,]+/)
          w = parseFloat(parts[2]) || 1024
          h = parseFloat(parts[3]) || 1024
        }
        if (!w) w = 1024
        if (!h) h = 1024

        svgEl.setAttribute("width", String(w))
        svgEl.setAttribute("height", String(h))
        recolorLightSvgElements(svgEl)

        const serializer = new XMLSerializer()
        const fixedSvg = serializer.serializeToString(svgEl)
        const blob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(blob)

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          setSourceImage(img)
          setSourceSize({ width: img.width, height: img.height })
          URL.revokeObjectURL(url)
        }
        img.onerror = () => URL.revokeObjectURL(url)
        img.src = url
      }
      reader.readAsText(file)
    } else {
      // PNG / raster: load directly as image
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        setSourceImage(img)
        setSourceSize({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
    }
  }

  const exportJSON = () => {
    const data = dots.map((dot) => ({
      x: dot.x, y: dot.y,
      normalizedX: dot.x / outputSize.width,
      normalizedY: dot.y / outputSize.height,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "dots.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyJSCode = () => {
    const normalized = dots.map((d) => [
      +(d.x / outputSize.width).toFixed(4),
      +(d.y / outputSize.height).toFixed(4),
    ])
    const code = `// Dither dots data — ${dots.length} dots at ${outputSize.width}\u00d7${outputSize.height}
// Each entry is [normalizedX, normalizedY] in 0\u20131 range
const ditherDots = ${JSON.stringify(normalized)};

// Render function
function renderDots(ctx, width, height, dotRadius = 1) {
  ctx.fillStyle = '#000000';
  for (let i = 0; i < ditherDots.length; i++) {
    const [x, y] = ditherDots[i];
    ctx.beginPath();
    ctx.arc(x * width, y * height, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}`
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="dither-layout">
      {/* Left Sidebar — Dither Controls */}
      <aside className="dither-sidebar">
        <h1 className="dither-sidebar-title">Dither Tool</h1>

        <div className="dither-upload">
          <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
            <Upload /> Upload Image
          </Button>
          <input
            ref={fileInputRef} type="file" accept="image/*,.svg" className="dither-hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }}
          />
        </div>

        <Separator />

        <Card>
          <CardHeader><CardTitle className="dither-section-title">Algorithm</CardTitle></CardHeader>
          <CardContent className="dither-section">
            <Select value={algorithm} onValueChange={setAlgorithm}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Floyd-Steinberg">Floyd-Steinberg</SelectItem>
                <SelectItem value="Jarvis-Judice-Ninke">Jarvis, Judice &amp; Ninke</SelectItem>
                <SelectItem value="Stucki">Stucki</SelectItem>
                <SelectItem value="Atkinson">Atkinson</SelectItem>
                <SelectItem value="Burkes">Burkes</SelectItem>
                <SelectItem value="Sierra">Sierra</SelectItem>
                <SelectItem value="Ordered">Ordered</SelectItem>
              </SelectContent>
            </Select>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Luminance Threshold</Label>
                <span className="dither-slider-value">{threshold}</span>
              </div>
              <Slider min={0} max={255} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
            </div>
            <div className="dither-checkbox-row">
              <Checkbox id="invert" checked={invert} onCheckedChange={(v) => setInvert(v === true)} />
              <Label htmlFor="invert" className="dither-checkbox-label">Invert</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="dither-section-title">Main Settings</CardTitle></CardHeader>
          <CardContent className="dither-section">
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Scale</Label>
                <span className="dither-slider-value">{scale}%</span>
              </div>
              <Slider min={1} max={100} value={[scale]} onValueChange={([v]) => setScale(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Contrast</Label>
                <span className="dither-slider-value">{contrast}</span>
              </div>
              <Slider min={-100} max={100} value={[contrast]} onValueChange={([v]) => setContrast(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Midtones (Gamma)</Label>
                <span className="dither-slider-value">{gamma.toFixed(2)}</span>
              </div>
              <Slider min={50} max={200} value={[gamma * 100]} onValueChange={([v]) => setGamma(v / 100)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Highlights Compression</Label>
                <span className="dither-slider-value">{highlightsCompression}</span>
              </div>
              <Slider min={0} max={100} value={[highlightsCompression]} onValueChange={([v]) => setHighlightsCompression(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Blur Radius</Label>
                <span className="dither-slider-value">{blurRadius}px</span>
              </div>
              <Slider min={0} max={20} value={[blurRadius]} onValueChange={([v]) => setBlurRadius(v)} />
            </div>
            <p className="dither-hint">
              Tone curve is applied on luminance before dithering. Blur can help reduce high-frequency noise prior to ordered patterns.
            </p>
          </CardContent>
        </Card>

        <div className="dither-spacer" />
      </aside>

      {/* Main Canvas Area — split panels */}
      <main className="dither-main">
        <canvas ref={sourceCanvasRef} className="dither-hidden" />

        <div
          className="dither-panel dither-panel-dither"
          style={{ background: invert ? "#000000" : "#ffffff" }}
        >
          <span className="dither-panel-label" style={{ color: invert ? "rgba(255,255,255,0.4)" : undefined }}>Dither Output</span>
          <canvas
            ref={ditherCanvasRef}
            className="dither-canvas-dither"
            role="img"
            aria-label="Dithered pixel output of the uploaded image"
          />
        </div>

        <div className="dither-panel-divider" />

        <div
          className="dither-panel-live"
          style={{ background: invert ? "#000000" : "#ffffff" }}
        >
          <div className="dither-panel-header">
            <span className="dither-panel-header-label">Live Render</span>
            <div
              className="dither-render-scale"
              style={{ "--primary": "#000", "--muted": "#e5e5e5", "--ring": "rgba(0,0,0,0.15)" } as React.CSSProperties}
            >
              <Label htmlFor="render-scale" className="dither-render-scale-label" style={{ color: "#999" }}>Render Scale</Label>
              <Slider
                id="render-scale"
                aria-label="Render scale"
                aria-valuemin={10}
                aria-valuemax={200}
                aria-valuenow={Math.round(renderScale * 100)}
                aria-valuetext={`${Math.round(renderScale * 100)}%`}
                className="dither-render-scale-slider" min={10} max={200}
                value={[renderScale * 100]} onValueChange={([v]) => setRenderScale(v / 100)}
              />
              <span className="dither-render-scale-value" style={{ color: "#999" }}>{Math.round(renderScale * 100)}%</span>
            </div>
          </div>
          <div ref={liveContainerRef} className="dither-canvas-container">
            <canvas
              ref={liveCanvasRef}
              className="dither-canvas-live"
              role="img"
              aria-label="Live dither render preview — hover to interact with particles"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
            />
            <div className="dither-canvas-stats">
              <Badge variant="outline" style={{ fontSize: 12, padding: "4px 10px", color: "#999", borderColor: "rgba(0,0,0,0.15)" }}>{dots.length.toLocaleString()} dots</Badge>
              <Badge variant="outline" style={{ fontSize: 12, padding: "4px 10px", color: "#999", borderColor: "rgba(0,0,0,0.15)" }}>{outputSize.width}&times;{outputSize.height}</Badge>
            </div>
          </div>
        </div>
      </main>

      {/* Right Sidebar — Effects Controls */}
      <aside className="dither-sidebar-right">
        <div className="dither-export">
          <Button variant="secondary" onClick={exportJSON}><Download /> JSON</Button>
          <Button variant="secondary" onClick={copyJSCode}><Copy /> Copy JS</Button>
        </div>

        <h1 className="dither-sidebar-title">Effects</h1>

        <Separator />

        {/* Mouse Effects */}
        <Card>
          <CardHeader>
            <CardTitle className="dither-section-title">
              <MousePointer2 style={{ display: "inline", width: 14, height: 14, marginRight: 6, verticalAlign: -2 }} />
              Mouse Effects
            </CardTitle>
          </CardHeader>
          <CardContent className="dither-section">
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Influence Radius</Label>
                <span className="dither-slider-value">{influenceRadius}px</span>
              </div>
              <Slider min={20} max={200} value={[influenceRadius]} onValueChange={([v]) => setInfluenceRadius(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Push Strength</Label>
                <span className="dither-slider-value">{pushStrength}</span>
              </div>
              <Slider min={5} max={100} value={[pushStrength]} onValueChange={([v]) => setPushStrength(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Return Speed</Label>
                <span className="dither-slider-value">{returnSpeed}</span>
              </div>
              <Slider min={1} max={20} value={[returnSpeed]} onValueChange={([v]) => setReturnSpeed(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Friction</Label>
                <span className="dither-slider-value">{friction}%</span>
              </div>
              <Slider min={10} max={100} value={[friction]} onValueChange={([v]) => setFriction(v)} />
            </div>
            <div className="dither-slider-row">
              <div className="dither-slider-header">
                <Label className="dither-slider-label">Trail Length</Label>
                <span className="dither-slider-value">{trailLength}%</span>
              </div>
              <Slider min={0} max={100} value={[trailLength]} onValueChange={([v]) => setTrailLength(v)} />
            </div>
            <p className="dither-hint">
              0% = particles snap back instantly. 100% = particles linger at max displacement.
            </p>
          </CardContent>
        </Card>

        {/* Particle Style — Figma-like color picker */}
        <Card>
          <CardHeader>
            <CardTitle className="dither-section-title">
              <Sparkles style={{ display: "inline", width: 14, height: 14, marginRight: 6, verticalAlign: -2 }} />
              Particle Style
            </CardTitle>
          </CardHeader>
          <CardContent className="dither-section">
            <ColorPicker
              color={particleColor}
              opacity={particleOpacity}
              gradientConfig={gradientConfig}
              onColorChange={setParticleColor}
              onOpacityChange={setParticleOpacity}
              onGradientChange={setGradientConfig}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
