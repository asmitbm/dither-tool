"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Minus } from "lucide-react"
import "@/styles/color-picker.css"

// ── Types ──────────────────────────────────────────────────────────

export interface GradientStop {
  id: string
  color: string
  position: number // 0–100
}

export interface GradientConfig {
  enabled: boolean
  type: "linear" | "radial" | "conic"
  angle: number
  stops: GradientStop[]
}

// ── Color math ─────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else               { r = c; b = x }
  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  const s = max === 0 ? 0 : d / max
  return [h, s, max]
}

// ── Component ──────────────────────────────────────────────────────

interface ColorPickerProps {
  color: string
  opacity: number
  gradientConfig: GradientConfig
  onColorChange: (color: string) => void
  onOpacityChange: (opacity: number) => void
  onGradientChange: (config: GradientConfig) => void
}

export function ColorPicker({
  color,
  opacity,
  gradientConfig,
  onColorChange,
  onOpacityChange,
  onGradientChange,
}: ColorPickerProps) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color))
  const [hexInput, setHexInput] = useState(color.slice(1))
  const [activeStopId, setActiveStopId] = useState<string | null>(
    gradientConfig.stops[0]?.id ?? null,
  )

  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const opacityRef = useRef<HTMLDivElement>(null)
  const gradBarRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<"sv" | "hue" | "opacity" | "stop" | null>(null)
  const draggingStopIdRef = useRef<string | null>(null)
  const lastEmittedRef = useRef(color)

  // Sync from external color changes (only when not self-emitted)
  useEffect(() => {
    if (!gradientConfig.enabled && color !== lastEmittedRef.current) {
      lastEmittedRef.current = color
      setHsv(hexToHsv(color))
      setHexInput(color.slice(1))
    }
  }, [color, gradientConfig.enabled])

  // ── Emit helpers ─────────────────────────────────────────────────

  const emitColor = useCallback(
    (hex: string) => {
      lastEmittedRef.current = hex
      if (gradientConfig.enabled && activeStopId) {
        onGradientChange({
          ...gradientConfig,
          stops: gradientConfig.stops.map((s) =>
            s.id === activeStopId ? { ...s, color: hex } : s,
          ),
        })
      } else {
        onColorChange(hex)
      }
    },
    [gradientConfig, activeStopId, onColorChange, onGradientChange],
  )

  const updateFromHsv = useCallback(
    (h: number, s: number, v: number) => {
      setHsv([h, s, v])
      const hex = hsvToHex(h, s, v)
      setHexInput(hex.slice(1))
      emitColor(hex)
    },
    [emitColor],
  )

  // ── Picker interactions ──────────────────────────────────────────

  const handleSv = useCallback(
    (cx: number, cy: number) => {
      if (!svRef.current) return
      const r = svRef.current.getBoundingClientRect()
      const s = Math.max(0, Math.min(1, (cx - r.left) / r.width))
      const v = Math.max(0, Math.min(1, 1 - (cy - r.top) / r.height))
      updateFromHsv(hsv[0], s, v)
    },
    [hsv, updateFromHsv],
  )

  const handleHue = useCallback(
    (cx: number) => {
      if (!hueRef.current) return
      const r = hueRef.current.getBoundingClientRect()
      const h = Math.max(0, Math.min(360, ((cx - r.left) / r.width) * 360))
      updateFromHsv(h, hsv[1], hsv[2])
    },
    [hsv, updateFromHsv],
  )

  const handleOpacity = useCallback(
    (cx: number) => {
      if (!opacityRef.current) return
      const r = opacityRef.current.getBoundingClientRect()
      onOpacityChange(Math.max(0, Math.min(100, Math.round(((cx - r.left) / r.width) * 100))))
    },
    [onOpacityChange],
  )

  const handleStopDrag = useCallback(
    (cx: number) => {
      if (!gradBarRef.current || !draggingStopIdRef.current) return
      const r = gradBarRef.current.getBoundingClientRect()
      const pos = Math.max(0, Math.min(100, Math.round(((cx - r.left) / r.width) * 100)))
      onGradientChange({
        ...gradientConfig,
        stops: gradientConfig.stops.map((s) =>
          s.id === draggingStopIdRef.current ? { ...s, position: pos } : s,
        ),
      })
    },
    [gradientConfig, onGradientChange],
  )

  // Global mouse handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current === "sv") handleSv(e.clientX, e.clientY)
      else if (draggingRef.current === "hue") handleHue(e.clientX)
      else if (draggingRef.current === "opacity") handleOpacity(e.clientX)
      else if (draggingRef.current === "stop") handleStopDrag(e.clientX)
    }
    const onUp = () => {
      draggingRef.current = null
      draggingStopIdRef.current = null
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [handleSv, handleHue, handleOpacity, handleStopDrag])

  // ── Hex submit ───────────────────────────────────────────────────

  const submitHex = () => {
    const clean = hexInput.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).padEnd(6, "0")
    const hex = `#${clean}`
    setHsv(hexToHsv(hex))
    setHexInput(clean)
    emitColor(hex)
  }

  // ── Stop management ──────────────────────────────────────────────

  const selectStop = (id: string) => {
    setActiveStopId(id)
    const stop = gradientConfig.stops.find((s) => s.id === id)
    if (stop) {
      setHsv(hexToHsv(stop.color))
      setHexInput(stop.color.slice(1))
    }
  }

  const addStop = () => {
    const id = `stop-${Date.now()}`
    const sorted = [...gradientConfig.stops].sort((a, b) => a.position - b.position)
    // Place new stop at midpoint of widest gap
    let bestPos = 50
    if (sorted.length >= 2) {
      let maxGap = 0
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].position - sorted[i].position
        if (gap > maxGap) {
          maxGap = gap
          bestPos = Math.round(sorted[i].position + gap / 2)
        }
      }
    }
    const newStops = [...gradientConfig.stops, { id, color: "#888888", position: bestPos }]
    onGradientChange({ ...gradientConfig, stops: newStops })
    selectStop(id)
    // Also set internal state since selectStop reads from old config
    setHsv(hexToHsv("#888888"))
    setHexInput("888888")
  }

  const removeStop = (id: string) => {
    if (gradientConfig.stops.length <= 2) return
    const next = gradientConfig.stops.filter((s) => s.id !== id)
    onGradientChange({ ...gradientConfig, stops: next })
    if (activeStopId === id) selectStop(next[0].id)
  }

  const toggleGradient = (enabled: boolean) => {
    onGradientChange({ ...gradientConfig, enabled })
    if (enabled && gradientConfig.stops.length > 0) {
      selectStop(gradientConfig.stops[0].id)
    } else if (!enabled) {
      setHsv(hexToHsv(color))
      setHexInput(color.slice(1))
    }
  }

  // Derive the "active" HSV for the picker UI
  const activeHsv: [number, number, number] = hsv
  const activeHex = hsvToHex(activeHsv[0], activeHsv[1], activeHsv[2])

  // Gradient CSS for the bar preview
  const gradientCss = gradientConfig.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ")

  return (
    <div className="cp-root">
      {/* Mode toggle */}
      <div className="cp-mode-toggle">
        <button
          className={`cp-mode-btn ${!gradientConfig.enabled ? "cp-mode-btn-active" : ""}`}
          onClick={() => toggleGradient(false)}
        >
          Solid
        </button>
        <button
          className={`cp-mode-btn ${gradientConfig.enabled ? "cp-mode-btn-active" : ""}`}
          onClick={() => toggleGradient(true)}
        >
          Gradient
        </button>
      </div>

      {/* Saturation-Value area */}
      <div
        ref={svRef}
        className="cp-sv-area"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${activeHsv[0]}, 100%, 50%))`,
        }}
        onMouseDown={(e) => {
          draggingRef.current = "sv"
          handleSv(e.clientX, e.clientY)
        }}
      >
        <div
          className="cp-sv-cursor"
          style={{
            left: `${activeHsv[1] * 100}%`,
            top: `${(1 - activeHsv[2]) * 100}%`,
            backgroundColor: activeHex,
          }}
        />
      </div>

      {/* Hue bar */}
      <div
        ref={hueRef}
        className="cp-hue-bar"
        onMouseDown={(e) => {
          draggingRef.current = "hue"
          handleHue(e.clientX)
        }}
      >
        <div className="cp-bar-cursor" style={{ left: `${(activeHsv[0] / 360) * 100}%` }} />
      </div>

      {/* Opacity bar */}
      <div
        ref={opacityRef}
        className="cp-opacity-bar"
        style={{
          background: `linear-gradient(to right, transparent, ${activeHex}), repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px`,
        }}
        onMouseDown={(e) => {
          draggingRef.current = "opacity"
          handleOpacity(e.clientX)
        }}
      >
        <div className="cp-bar-cursor" style={{ left: `${opacity}%` }} />
      </div>

      {/* Hex + Opacity inputs */}
      <div className="cp-hex-row">
        <span className="cp-hex-label">Hex</span>
        <div className="cp-hex-input-wrap">
          <span className="cp-hex-hash">#</span>
          <input
            className="cp-hex-input"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={submitHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitHex()
            }}
            maxLength={6}
            spellCheck={false}
          />
        </div>
        <div className="cp-opacity-input-wrap">
          <input
            className="cp-opacity-input"
            type="number"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => onOpacityChange(Math.max(0, Math.min(100, +e.target.value)))}
          />
          <span className="cp-opacity-pct">%</span>
        </div>
      </div>

      {/* ── Gradient controls ─────────────────────────────────────── */}
      {gradientConfig.enabled && (
        <div className="cp-gradient-section">
          {/* Type + Angle */}
          <div className="cp-gradient-type-row">
            <Select
              value={gradientConfig.type}
              onValueChange={(v) =>
                onGradientChange({
                  ...gradientConfig,
                  type: v as GradientConfig["type"],
                })
              }
            >
              <SelectTrigger className="cp-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="conic">Conic</SelectItem>
              </SelectContent>
            </Select>

            {gradientConfig.type === "linear" && (
              <div className="cp-angle-wrap">
                <input
                  className="cp-angle-input"
                  type="number"
                  value={gradientConfig.angle}
                  onChange={(e) =>
                    onGradientChange({
                      ...gradientConfig,
                      angle: ((+e.target.value % 360) + 360) % 360,
                    })
                  }
                />
                <span className="cp-angle-unit">&deg;</span>
              </div>
            )}
          </div>

          {/* Gradient preview bar with draggable stops */}
          <div className="cp-gradient-bar-wrap">
            <div
              ref={gradBarRef}
              className="cp-gradient-bar"
              style={{ background: `linear-gradient(to right, ${gradientCss})` }}
            >
              {gradientConfig.stops.map((stop) => (
                <div
                  key={stop.id}
                  className={`cp-stop-handle ${activeStopId === stop.id ? "cp-stop-active" : ""}`}
                  style={{ left: `${stop.position}%`, backgroundColor: stop.color }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    draggingRef.current = "stop"
                    draggingStopIdRef.current = stop.id
                    selectStop(stop.id)
                  }}
                />
              ))}
            </div>
          </div>

          {/* Stops list */}
          <div className="cp-stops-header">
            <Label className="cp-stops-title">Stops</Label>
            <button className="cp-stops-add" onClick={addStop} aria-label="Add color stop">
              <Plus style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div className="cp-stops-list">
            {gradientConfig.stops
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((stop) => (
                <div
                  key={stop.id}
                  className={`cp-stop-row ${activeStopId === stop.id ? "cp-stop-row-active" : ""}`}
                  onClick={() => selectStop(stop.id)}
                >
                  <span className="cp-stop-pos">{stop.position}%</span>
                  <div className="cp-stop-swatch" style={{ backgroundColor: stop.color }} />
                  <span className="cp-stop-hex">{stop.color.toUpperCase()}</span>
                  <button
                    className="cp-stop-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeStop(stop.id)
                    }}
                    disabled={gradientConfig.stops.length <= 2}
                    aria-label={`Remove stop at ${stop.position}%`}
                  >
                    <Minus style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
