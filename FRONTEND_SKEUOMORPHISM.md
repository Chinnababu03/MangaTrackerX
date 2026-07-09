# MangaTrackerX - Skeuomorphism Design System Documentation

This document describes the design architecture, visual tokens, and implementation detail of the **Skeuomorphism** theme style (housed in the `frontend-skeomorphism` branch).

---

## Design Concept: The Slate-Metallic Console
The skeuomorphism theme is modeled after a physical synthesizer or instrument control panel. It uses deep metallic slate surfaces, glass panels, beveled edges, and colored LED indicator lights to create a tactile 3D feel.

```
  ┌────────────────────────────────────────────────────────┐
  │ [☼ Light Reflection Border: inset 1px white (12%)]     │
  │  ┌──────────────────────────────────────────────────┐  │
  │  │  Linear Gradient: Nav / Card Surface             │  │
  │  └──────────────────────────────────────────────────┘  │
  │ [✹ Shadow Well: outset shadow (70% opacity)]           │
  └────────────────────────────────────────────────────────┘
```

---

## Design Tokens (CSS Variables)

### 1. Color Palette (Dark Theme Console)
* **Backgrounds:** Slate-black console chassis (`#111115` to `#20202a`).
* **Skeuomorphic Gradients:**
  * `--nav-bg`: Top-to-bottom metallic sheen: `linear-gradient(180deg, rgba(28,24,48,0.88) 0%, rgba(12,10,20,0.95) 100%)`
  * `--card-bg`: Outset plate gradient: `linear-gradient(135deg, rgba(28,25,47,0.95) 0%, rgba(14,12,24,0.98) 100%)`
  * `--modal-bg`: Solid steel casing gradient: `linear-gradient(135deg, #1b1730 0%, #0c0a15 100%)`
* **LED Light Indicators (Accents):**
  * Electric Cyan/Blue (`#00f0ff` / `--violet`): Used for primary navigation highlights and active indicators.
  * Amber Orange (`#ff7b00` / `--cyan`): Used for ratings, updates, and caution badges.
  * Emerald Green (`#00ff88`): Used for ongoing status lights.

### 2. Light Theme Console (Apple/Braun Plastic)
When switched to Light Mode (`[data-theme="light"]`), the console transforms into a retro, smooth off-white/ivory plastic finish inspired by classic Apple and Braun designs:
* **Background:** Soft warm gray (`#eef1f6`).
* **Card Surface:** Clean glossy white plate with light top-border reflections.
* **Text:** Deep charcoal (`#1e2025`) for sharp legibility.

---

## Skeuomorphic Shadows (The Core 3D Engine)
The 3D volume is achieved through layered shadow chains combining **inset** highlights (light reflecting off the top edge) and **outset** drop-shadows (cast shadows):

```css
/* Outset drop-shadow + Inset light-reflection ring */
--shadow-card: 
  0 12px 36px rgba(0,0,0,0.75), 
  inset 0 1px 1px rgba(255,255,255,0.12), 
  inset 0 -1px 2px rgba(0,0,0,0.45);

/* Physical well/cutout recess shadow */
--shadow-inset: 
  inset 0 2.5px 7px rgba(0,0,0,0.85), 
  0 1px 0 rgba(255,255,255,0.04);
```

---

## Interactive Components & States

### 1. Tactile Buttons (Outset to Inset)
Buttons behave like real physical springs. In their default state, they sit raised above the console (outset shadow). When hovered, they illuminate. When clicked (`:active`), they compress into the console (inset shadow):

```css
/* Raised button state */
.btn {
  background: var(--card-bg);
  box-shadow: 
    0 4px 8px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.1);
  transform: translateY(-1px);
}

/* Pressed button state */
.btn:active {
  box-shadow: 
    inset 0 2px 4px rgba(0,0,0,0.8),
    0 1px 0 rgba(255,255,255,0.05);
  transform: translateY(1px);
}
```

### 2. Manga Cards (Raised Instrument Plates)
Manga cards render as modular plates attached to the console.
* **Top highlight:** A subtle border line simulating light reflecting off the top edge.
* **Bottom shadow:** Soft ambient occlusion shadow.
* **Hover effect:** A glow emitting behind the card, simulating an under-light source, combined with a smooth upward float (`transform: translateY(-4px)`).

### 3. Glassmorphic Overlays
Popups, search results, and navigation bars use `backdrop-filter: blur(16px)` layered over skeuomorphic borders to resemble smoked glass plates positioned above the console grid.
