# Dither Tool

A real-time dithering tool that converts images into interactive particle-based dot patterns. Upload any image, apply dithering algorithms, and interact with the result through physics-based mouse effects.

## Features

### Dithering Algorithms

Seven algorithms with a unified error-diffusion engine:

- **Floyd-Steinberg** — classic, balanced error diffusion
- **Jarvis, Judice & Ninke** — wider kernel, smoother gradients
- **Stucki** — similar to JJN with different weights
- **Atkinson** — partial error diffusion, preserves detail (used in original Macintosh)
- **Burkes** — fast two-row diffusion
- **Sierra** — three-row kernel, good quality
- **Ordered** — Bayer matrix threshold dithering

### Interactive Particle System

Every dithered dot becomes an independent particle with spring-based physics:

- **Mouse push** — cursor repels nearby particles with cubic falloff
- **Spring return** — particles spring back to rest positions
- **Friction damping** — controls how quickly motion settles
- **Trail persistence** — particles can linger before snapping back
- All parameters are adjustable in real-time via the Effects sidebar

### Tone Curve Controls

Fine-tune the image before dithering:

- Luminance threshold
- Contrast adjustment
- Gamma / midtones
- Highlights compression
- Pre-dither blur

### Color & Gradient

Figma-style color picker with:

- **Solid color** mode — SV area, hue bar, opacity bar, hex input
- **Gradient mode** — linear, radial, or conic gradients with draggable multi-stop editor
- Automatic color inversion when using the Invert toggle

### Export

- **Export JSON** — download dot coordinates with normalized positions
- **Copy JS** — copy a self-contained JavaScript render function to clipboard

### File Support

Accepts all image formats — PNG, JPEG, WebP, AVIF, GIF, BMP, TIFF, SVG, and more. SVG files get special handling: dimensions are extracted from `viewBox`, and light/white fills are auto-converted to black for dithering contrast.

## Tech Stack

- **Next.js** with React
- **Canvas 2D API** for dithering and rendering
- **shadcn/ui** components
- **Vanilla CSS** for layout
- `requestAnimationFrame` animation loop with frame-rate-independent physics
- `ResizeObserver` for responsive canvas sizing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Accessibility

- Full `prefers-reduced-motion` support — static rendering when enabled
- ARIA labels on all canvases and sliders
- Keyboard-navigable controls
- 44px minimum tap targets
- 16px input font sizes (prevents iOS zoom)
- Hover effects gated behind `@media (hover: hover)`
