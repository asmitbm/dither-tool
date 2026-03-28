# Dither Tool

A real-time dithering tool that converts images into interactive particle-based dot patterns. Upload any image, apply dithering algorithms, and interact with the result through physics-based mouse effects.

## Demo



Inspired by a dithered particle effect by [Emil Kowalski](https://x.com/emilkowalski_), see his [original tweet](https://x.com/emilkowalski/status/2036778116748542220).


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

