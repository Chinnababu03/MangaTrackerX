# MangaTrackerX - Claymorphism Design System Documentation

This document describes the design architecture, visual tokens, and implementation detail of the **Claymorphism** theme style (housed in the `frontend-claymorphism` branch).

---

## Design Concept: Puffy Clay & Vivid Shadows
The claymorphism theme focuses on a friendly, soft, and tactile "clay-like" aesthetic. It replaces sharp edges with bubble-like rounded corners, uses high-saturation gradients, and relies on colorful layered drop shadows to make elements appear "inflated" and floating above the surface.

```
  ┌────────────────────────────────────────────────────────┐
  │  (Puffy Top Highlight Border: inset 2px white (18%))   │
  │  ┌──────────────────────────────────────────────────┐  │
  │  │  Smooth Non-Linear Gradient: Clay Surface        │  │
  │  └──────────────────────────────────────────────────┘  │
  │  (Layered Color Glow Shadow: e.g. Purple/Cyan Glow)    │
  └────────────────────────────────────────────────────────┘
```

---

## Design Tokens (CSS Variables)

### 1. Font Family & Weight
* **Font:** `Nunito` — a clean, rounded, bubbly font.
* **Font Weights:** Heavy bold and extra-heavy (`900` to `1000` weight) for titles and badges to reinforce the toy-like, rounded feel.

### 2. Clay Accent Palette
* **Background:** Deep midnight blue (`#0f0f18` to `#1e1e35`).
* **Saturated Accents:**
  * `--clay-purple`: `#a855f7` (Primary branding color)
  * `--clay-pink`: `#ec4899`
  * `--clay-cyan`: `#06b6d4`
  * `--clay-green`: `#22c55e`
  * `--clay-orange`: `#f97316`
* **Clay Gradients:**
  * `--nav-bg`: `linear-gradient(135deg, #1e1535 0%, #14102b 100%)`
  * `--card-bg`: `linear-gradient(145deg, #1e1a38 0%, #13102a 100%)`
  * `--modal-bg`: `linear-gradient(145deg, #1d1936 0%, #110e24 100%)`

### 3. Light Theme Clay (Glossy Pastel)
When switched to Light Mode (`[data-theme="light"]`), the UI morphs into a soft pastel palette resembling fresh glossy plasticine:
* **Background:** Clean sky-tinted white (`#f3f4fd`).
* **Cards:** Pastel violet/pink plates with white highlight rings.
* **Text:** Deep indigo (`#232438`) for soft, readable contrast.

---

## Clay volume & Shadows
Unlike flat designs, claymorphism uses multi-layered shadow definitions to create a puffy 3D volume. Cards and pills use a combination of outset ambient shadows, colorful highlight glows, and thin light-colored borders:

```css
/* Card shadow combining occlusion, color glow, and border */
--shadow-card: 
  0 10px 25px rgba(0,0,0,0.45),
  0 4px 10px rgba(168,85,247,0.08),
  0 0 0 1.5px rgba(255,255,255,0.06);

/* Ultra-rounded radii for bubbly elements */
--r-sm: 16px;
--r-md: 22px;
--r-lg: 30px;
--r-xl: 40px; /* applied to main card bodies */
--r-full: 9999px; /* applied to pills & buttons */
```

---

## Interactive Components & States

### 1. Inflated Buttons (Pills)
Buttons are fully pill-shaped (`border-radius: 9999px`).
* **Hover:** They scale up slightly (`transform: scale(1.03)`) and trigger a strong colored glow matching the button's accent color (e.g. purple/pink glow).
* **Click (`:active`):** The button scales down (`transform: scale(0.97)`) and its shadow flattens, simulating squeezing a piece of soft clay.

### 2. Manga Cards (Bubble Plates)
Manga cards render with a top accent color border stripe (like a colored cap) and ultra-rounded bottom corners (`40px`).
* **Hover:** The card floats upwards dynamically (`translateY(-6px)`) and its colored shadow expands outward to make it look like it's inflating.
* **Chapter pills:** Rendered as small, fully solid, colored clay pills that invert colors and glow on hover.

### 3. Modals & Dialogs
Modals feature a header with a thick colored gradient stripe (e.g. purple-to-pink) and a soft translucent body. The close buttons and actions are rounded clay cylinders that respond with spring animations when clicked.
