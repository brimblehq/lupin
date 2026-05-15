# Brimble Design System

> **Purpose:** Standalone reference for any Claude Code instance working on Brimble services.
> Every value below is copied verbatim from source files — never approximated.

---

## Table of Contents

1. [Overview & Tech Stack](#1-overview--tech-stack)
2. [Tailwind CSS 4 Setup](#2-tailwind-css-4-setup)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing, Sizing & Layout](#5-spacing-sizing--layout)
6. [Dark Mode](#6-dark-mode)
7. [Component Reference](#7-component-reference)
8. [Input System](#8-input-system)
9. [Animation System](#9-animation-system)
10. [Image Handling](#10-image-handling)
11. [Scrollbar Styling](#11-scrollbar-styling)
12. [Z-Index Scale](#12-z-index-scale)
13. [Specialized CSS](#13-specialized-css)
14. [Icon Libraries](#14-icon-libraries)
15. [State Management & API Patterns](#15-state-management--api-patterns)

---

## 1. Overview & Tech Stack

### Monorepo Structure

| Package           | Name                 | Role                                     |
| ----------------- | -------------------- | ---------------------------------------- |
| `apps/web`        | `@brimble/web`       | Landing page / marketing site            |
| `apps/dashboard`  | `@brimble/dashboard` | Application dashboard                    |
| `packages/ui`     | `@brimble/ui`        | Shared UI components (Button, Accordion) |
| `packages/config` | `@brimble/config`    | Shared config (useTheme hook)            |

### Core Dependencies (exact versions from package.json)

| Dependency                            | Version             | Used In        |
| ------------------------------------- | ------------------- | -------------- |
| `react` / `react-dom`                 | `^19.2.0`           | All            |
| `tailwindcss`                         | `^4.1.18`           | All            |
| `@tailwindcss/vite`                   | `^4.1.18`           | web, dashboard |
| `motion` (framer-motion v12)          | `^12.34.3`          | web, dashboard |
| `@tanstack/react-router`              | `^1.132.0`          | web, dashboard |
| `@tanstack/react-start`               | `^1.132.0`          | web, dashboard |
| `@tanstack/router-plugin`             | `^1.132.0`          | web, dashboard |
| `lucide-react`                        | `^0.545.0`          | All            |
| `@phosphor-icons/react`               | `^2.1.10`           | dashboard      |
| `@radix-ui/react-dialog`              | `^1.1.15`           | dashboard      |
| `@radix-ui/react-slider`              | `^1.3.6`            | dashboard      |
| `@radix-ui/react-tooltip`             | `^1.2.8`            | dashboard      |
| `radix-ui`                            | `^1.4.3`            | packages/ui    |
| `class-variance-authority`            | `^0.7.1`            | packages/ui    |
| `clsx`                                | `^2.1.1`            | packages/ui    |
| `tailwind-merge`                      | `^3.5.0`            | packages/ui    |
| `zustand`                             | `^5.0.11`           | dashboard      |
| `cmdk`                                | `^1.1.1`            | dashboard      |
| `react-day-picker`                    | `^9.13.2`           | dashboard      |
| `recharts`                            | `^3.7.0`            | dashboard      |
| `formik` / `yup`                      | `^2.4.9` / `^1.7.1` | dashboard      |
| `date-fns`                            | `^4.1.0`            | dashboard      |
| `nprogress`                           | `^0.2.0`            | dashboard      |
| `sonner`                              | `^2.0.7`            | dashboard      |
| `vaul`                                | `^1.1.2`            | dashboard      |
| `@fontsource-variable/jetbrains-mono` | `^5.2.8`            | dashboard      |
| `@supabase/supabase-js`               | `^2.97.0`           | dashboard      |
| `ably`                                | `^2.18.0`           | dashboard      |
| `axios`                               | `^1.13.5`           | dashboard      |
| `socket.io-client`                    | `^4.8.3`            | dashboard      |
| `tw-animate-css`                      | `^1.4.0`            | web, dashboard |
| `shadcn`                              | `^3.8.5`            | web (devDep)   |
| `typescript`                          | `^5.7.2`            | All            |

### Build Tooling

- **Bundler:** Vite `^7.1.7` with `@vitejs/plugin-react` `^5.0.4`
- **Router:** TanStack Router (file-based routing) + TanStack Start (SSR)
- **Package Manager:** pnpm `10.28.2`
- **Port convention:** web → 3000, dashboard → 3001

---

## 2. Tailwind CSS 4 Setup

### Critical: `@theme inline` + CSS Variable Indirection

Tailwind CSS 4's `@theme inline` inlines token values directly into utilities at build time. This means `.dark {}` overrides to CSS custom properties **have no effect** unless you use indirection:

```css
/* ✅ CORRECT — var() indirection allows .dark overrides */
@theme inline {
  --color-brimble-black: var(--brimble-black);
}
:root {
  --brimble-black: #222528;
}
.dark {
  --brimble-black: #e8eaed;
}

/* ❌ WRONG — this value is inlined at build time, .dark can never change it */
@theme inline {
  --color-brimble-black: #222528;
}
```

**Exception:** Static values that don't change between themes can be set directly:

```css
@theme inline {
  --color-brimble-accent-blue: #006fff; /* same in light & dark */
}
```

### Import Chain

**apps/web/src/styles.css:**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

**apps/dashboard/src/styles.css:**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource-variable/jetbrains-mono";
```

### `@source` Directives

Both apps scan shared packages for Tailwind class usage:

```css
@source "../../../packages/ui/src";
@source "../../../packages/config/src";
```

### `@custom-variant dark`

Both apps:

```css
@custom-variant dark (&:is(.dark *));
```

### `cn()` Utility Function

From `packages/ui/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 3. Color System

### 3.1 Brimble Brand Primitives

Defined in `:root` / `.dark` blocks, consumed via `var()` indirection in `@theme inline`.

| Token                   | Light     | Dark      | Tailwind Class                                       |
| ----------------------- | --------- | --------- | ---------------------------------------------------- |
| `--brimble-black`       | `#222528` | `#e8eaed` | `text-brimble-black`, `bg-brimble-black`             |
| `--brimble-air-gray`    | `#fafafa` | `#1a1c1e` | `text-brimble-air-gray`, `bg-brimble-air-gray`       |
| `--brimble-light-gray`  | `#f6f8f7` | `#2a2d30` | `bg-brimble-light-gray`                              |
| `--brimble-surface`     | `#f5f7f7` | `#222528` | `bg-brimble-surface`                                 |
| `--brimble-accent-blue` | `#006fff` | `#006fff` | `text-brimble-accent-blue`, `bg-brimble-accent-blue` |
| `--brimble-accent`      | `#f5a623` | `#f5a623` | `text-brimble-accent` (dashboard only)               |

### 3.2 Dashboard Semantic Tokens (`--dash-*`)

Dashboard-only. Defined in `apps/dashboard/src/styles.css`.

| Token                       | Light     | Dark      | Tailwind Class                   |
| --------------------------- | --------- | --------- | -------------------------------- |
| `--dash-bg`                 | `#ffffff` | `#202022` | `bg-dash-bg`                     |
| `--dash-bg-elevated`        | `#fafafa` | `#29292a` | `bg-dash-bg-elevated`            |
| `--dash-text-strong`        | `#23252a` | `#ffffff` | `text-dash-text-strong`          |
| `--dash-text-body`          | `#535358` | `#bdbcbc` | `text-dash-text-body`            |
| `--dash-text-faded`         | `#7a7c81` | `#757877` | `text-dash-text-faded`           |
| `--dash-text-extra-faded`   | `#b6b8bd` | `#757877` | `text-dash-text-extra-faded`     |
| `--dash-border`             | `#d9dadd` | `#454545` | `border-dash-border`             |
| `--dash-border-soft`        | `#e6e5e5` | `#454545` | `border-dash-border-soft`        |
| `--dash-btn-outline-bg`     | `#ffffff` | `#29292a` | `bg-dash-btn-outline-bg`         |
| `--dash-btn-outline-border` | `#d1d1db` | `#454545` | `border-dash-btn-outline-border` |
| `--dash-btn-outline-text`   | `#535358` | `#e8eaed` | `text-dash-btn-outline-text`     |

### 3.3 shadcn/Radix Semantic Tokens (oklch)

Shared between both apps. Used by shadcn components and base layer.

| Token                    | Light (oklch)               | Dark (oklch)                |
| ------------------------ | --------------------------- | --------------------------- |
| `--background`           | `oklch(1 0 0)`              | `oklch(0.145 0 0)`          |
| `--foreground`           | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`          |
| `--card`                 | `oklch(1 0 0)`              | `oklch(0.205 0 0)`          |
| `--card-foreground`      | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`          |
| `--popover`              | `oklch(1 0 0)`              | `oklch(0.205 0 0)`          |
| `--popover-foreground`   | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`          |
| `--primary`              | `oklch(0.205 0 0)`          | `oklch(0.922 0 0)`          |
| `--primary-foreground`   | `oklch(0.985 0 0)`          | `oklch(0.205 0 0)`          |
| `--secondary`            | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`          |
| `--secondary-foreground` | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`          |
| `--muted`                | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`          |
| `--muted-foreground`     | `oklch(0.556 0 0)`          | `oklch(0.708 0 0)`          |
| `--accent`               | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`          |
| `--accent-foreground`    | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`          |
| `--destructive`          | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--border`               | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 10%)`        |
| `--input`                | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 15%)`        |
| `--ring`                 | `oklch(0.708 0 0)`          | `oklch(0.556 0 0)`          |

### 3.4 Sidebar Tokens (oklch)

| Token                          | Light              | Dark                         |
| ------------------------------ | ------------------ | ---------------------------- |
| `--sidebar`                    | `oklch(0.985 0 0)` | `oklch(0.205 0 0)`           |
| `--sidebar-foreground`         | `oklch(0.145 0 0)` | `oklch(0.985 0 0)`           |
| `--sidebar-primary`            | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)`           |
| `--sidebar-accent`             | `oklch(0.97 0 0)`  | `oklch(0.269 0 0)`           |
| `--sidebar-accent-foreground`  | `oklch(0.205 0 0)` | `oklch(0.985 0 0)`           |
| `--sidebar-border`             | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)`         |
| `--sidebar-ring`               | `oklch(0.708 0 0)` | `oklch(0.556 0 0)`           |

### 3.5 Chart Colors (oklch)

| Token       | Light                       | Dark                         |
| ----------- | --------------------------- | ---------------------------- |
| `--chart-1` | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` |
| `--chart-2` | `oklch(0.6 0.118 184.704)`  | `oklch(0.696 0.17 162.48)`   |
| `--chart-3` | `oklch(0.398 0.07 227.392)` | `oklch(0.769 0.188 70.08)`   |
| `--chart-4` | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)`   |
| `--chart-5` | `oklch(0.769 0.188 70.08)`  | `oklch(0.645 0.246 16.439)`  |

### 3.6 Status Chip Colors (CSS gradients)

Used by `StatusChip` component. Each is a `linear-gradient(180deg, ...)`.

| Variant    | Gradient                                | Border    |
| ---------- | --------------------------------------- | --------- |
| **green**  | `#34e89e 0%, #13d282 30%, #0fba72 100%` | `#0fba72` |
| **red**    | `#f07070 0%, #ef4444 30%, #d63031 100%` | `#d63031` |
| **orange** | `#ffa040 0%, #ff7a00 30%, #e06800 100%` | `#e06800` |
| **gray**   | `#a0a2a7 0%, #7a7c81 30%, #65676c 100%` | `#65676c` |

Status → variant mapping: `READY|ACTIVE` → green, `FAILED` → red, `BUILDING|INPROGRESS|PENDING|QUEUED` → orange, else → gray.

### 3.7 GlossyButton Gradients

| Variant   | Gradient                                | Border    |
| --------- | --------------------------------------- | --------- |
| **blue**  | `#7babf7 0%, #5b8def 30%, #4a7ee0 100%` | `#4a7ee0` |
| **red**   | `#f07070 0%, #e84545 30%, #d63031 100%` | `#c0392b` |
| **white** | `#ffffff 0%, #f5f7fb 55%, #eef2f7 100%` | `#d0d7e2` |
| **black** | `#3a3f47 0%, #232830 45%, #12161d 100%` | `#0f141b` |

### 3.8 Snackbar Colors

| Variant     | Color     | Icon                     |
| ----------- | --------- | ------------------------ |
| **info**    | `#4879f8` | `Info` (lucide)          |
| **warning** | `#f5a623` | `AlertTriangle` (lucide) |
| **error**   | `#ef2f1f` | `AlertCircle` (lucide)   |

### 3.9 NProgress Colors

| Mode      | Bar       | Shadow                            |
| --------- | --------- | --------------------------------- |
| **Light** | `#006fff` | `0 0 0 1px rgb(0 111 255 / 16%)`  |
| **Dark**  | `#b27a22` | `0 0 0 1px rgb(178 122 34 / 18%)` |

### 3.10 Fixed Colors (do not change with theme)

| Element                   | Color     | Notes                  |
| ------------------------- | --------- | ---------------------- |
| Terminal background       | `#222528` | Always dark, hardcoded |
| CTA card text             | `#fafafa` | Always white-ish       |
| Accent blue               | `#006fff` | Brand constant         |
| ToggleSwitch "on"         | `#4879f8` | Same light/dark        |
| DashButton primary bg     | `#4879f8` | Same light/dark        |
| DashButton primary border | `#3964d5` | Same light/dark        |

---

## 4. Typography

### 4.1 Font Stacks

**apps/web (landing page):**
| Role | Font Stack | CSS |
|------|-----------|-----|
| Body | IBM Plex Sans | `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif` |
| Heading | Lora (italic) | `'Lora', Georgia, serif` with `font-style: italic` |
| Code | IBM Plex Mono | `'IBM Plex Mono', source-code-pro, Menlo, Monaco, Consolas, monospace` |

**apps/dashboard:**
| Role | Font Stack | CSS |
|------|-----------|-----|
| Body | ABC Marfa | `'ABC Marfa', -apple-system, BlinkMacSystemFont, sans-serif` |
| Heading | Lora (italic) | `'Lora', Georgia, serif` with `font-style: italic` |
| Code | ABC Marfa Mono | `'ABC Marfa Mono', source-code-pro, Menlo, Monaco, Consolas, monospace` |
| Logs/Terminal | JetBrains Mono Variable | `'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |

### 4.2 `@font-face` Declarations

```css
/* Shared between web & dashboard */
@font-face {
  font-family: "Lora";
  src: url("./assets/fonts/Lora-Italic-Variable.ttf") format("truetype");
  font-weight: 400 700;
  font-style: italic;
  font-display: swap;
}

/* Dashboard only */
@font-face {
  font-family: "ABC Marfa";
  src: url("./assets/fonts/ABCMarfaVariableVF-Trial.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "ABC Marfa Mono";
  src: url("./assets/fonts/ABCMarfaMonoVariable-Trial.ttf") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

### 4.3 `font-heading` Utility

Both apps define:

```css
@utility font-heading {
  font-family: "Lora", Georgia, serif;
  font-style: italic;
}
```

Usage: `<h1 className="font-heading">...</h1>`

### 4.4 Theme Font Tokens

**apps/web `@theme inline`:**

```css
--font-family-heading: "Great Vibes", cursive;
--font-family-body: "IBM Plex Sans", sans-serif;
--font-family-mono: "IBM Plex Mono", monospace;
```

**apps/dashboard `@theme inline`:**

```css
--font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
--font-logs: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace;
--font-family-body: "ABC Marfa", sans-serif;
--font-family-mono: "ABC Marfa Mono", monospace;
```

### 4.5 Body Defaults

**apps/web:**

```css
body {
  font-family:
    "IBM Plex Sans",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  /* no explicit font-size — browser default 16px */
}
```

**apps/dashboard:**

```css
body {
  font-family:
    "ABC Marfa",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.09px;
}
```

---

## 5. Spacing, Sizing & Layout

### 5.1 Border Radius Scale

Defined in both apps' `@theme inline`:

```css
--radius: 0.625rem; /* 10px */
--radius-sm: calc(var(--radius) - 4px); /* 6px */
--radius-md: calc(var(--radius) - 2px); /* 8px */
--radius-lg: var(--radius); /* 10px */
--radius-xl: calc(var(--radius) + 4px); /* 14px */
--radius-2xl: calc(var(--radius) + 8px); /* 18px */
```

Web app additionally defines:

```css
--radius-3xl: calc(var(--radius) + 12px); /* 22px */
--radius-4xl: calc(var(--radius) + 16px); /* 26px */
```

**Common hardcoded radii in dashboard components:**

- `rounded-[4px]` — DashButton, ModalCancelButton, ModalContinueButton, StatusChip
- `rounded-[6px]` — input-base, date picker pills
- `rounded-[8px]` — GlossyButton, command palette dialog
- `rounded-[4px]` — Modal container
- `rounded-full` — ToggleSwitch, StatusChip dots, pills

### 5.2 Shadow Tokens

**Web app (`:root`):**

```css
--shadow-big: 0px 1.7px 2.6px rgba(0, 0, 0, 0.04), 0px 10.4px 27.7px rgba(0, 0, 0, 0.04), 0px 55.5px 20.8px rgba(0, 0, 0, 0.02);
--shadow-button: 0px 0.646px 1.292px rgba(18, 18, 23, 0.05);
```

**Web app (`.dark`):**

```css
--shadow-big: 0px 1.7px 2.6px rgba(0, 0, 0, 0.12), 0px 10.4px 27.7px rgba(0, 0, 0, 0.12), 0px 55.5px 20.8px rgba(0, 0, 0, 0.06);
--shadow-dark-big: 0px 1px 1px rgba(0, 0, 0, 0.25), 0px 8.3px 21.8px -2.5px rgba(0, 0, 0, 0.55), 0px 2.5px 3.3px rgba(0, 0, 0, 0.25);
--shadow-button: 0px 0.646px 1.292px rgba(255, 255, 255, 0.04);
```

**Component-level shadows (dashboard):**

```
Standard button:      shadow-[0px_1px_2px_rgba(18,18,23,0.05)]
GlossyButton:        shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)]
Modal:                shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)]
Modal (dark):         shadow-[0px_2px_3px_rgba(0,0,0,0.2)]
Tooltip:              shadow-[0px_0.6px_0px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]
Command palette:      box-shadow: 0px 10px 28px -4px rgba(0, 0, 0, 0.26);
ToggleSwitch thumb:   shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)]
ToggleSwitch (dark):  shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]
```

### 5.3 Sidebar Width

```
w-[185px]   /* fixed 185px */
```

### 5.4 Layout Patterns

**Dashboard layout (desktop):**

```
┌─────────────────────────────────────────┐
│  Sidebar (185px) │  Main Content Area   │
│  fixed, border-r │  flex-1, overflow-y  │
│                  │                      │
│  nav items       │  ┌── Topbar ───────┐ │
│  ...             │  │ breadcrumbs     │ │
│  theme toggle    │  ├── Snackbar? ────┤ │
│  settings        │  │ Page content    │ │
│                  │  │                 │ │
└─────────────────────────────────────────┘
```

- Full-width mode (no sidebar) for project detail routes
- Mobile: sidebar collapses, topbar with hamburger menu + dropdown navigation
- Modal width default: `500px`, max: `calc(100vw - 32px)`

---

## 6. Dark Mode

### 6.1 Implementation Pattern

Class-based `.dark` on `<html>` element:

```typescript
document.documentElement.classList.toggle("dark", isDark);
```

### 6.2 FOWT (Flash of Wrong Theme) Prevention

Inline `<script>` in `<head>` of root route component. Runs synchronously before paint.

**apps/web:**

```javascript
(function () {
  var t = localStorage.getItem("brimble-theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme:dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
})();
```

**apps/dashboard:**

```javascript
(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem("theme");
    var dark = t === "dark" || (!t && window.matchMedia("(prefers-color-scheme:dark)").matches);
    if (dark) {
      d.classList.add("dark");
    } else {
      d.classList.remove("dark");
    }
  } catch (e) {}
})();
```

### 6.3 `useTheme` Hooks

**packages/config (shared, used by web):**

```typescript
import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "brimble-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme, setTheme]);

  return { theme, toggleTheme } as const;
}
```

**apps/dashboard (local, uses `useSyncExternalStore`):**

```typescript
import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  localStorage.setItem("theme", t);
  for (const cb of listeners) cb();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((t: Theme) => applyTheme(t), []);

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }, []);

  return { theme, setTheme, toggleTheme };
}
```

**Key difference:** Web uses localStorage key `"brimble-theme"`, dashboard uses `"theme"`.

### 6.4 Fixed Dark Elements

- **Tooltips** — Always dark: `bg-gradient-to-b from-[#434343] to-[#232323]` with white text
- **Command palette** — Always dark: `background: rgba(124, 124, 124, 0.9)` with white text
- **Terminal** — Always dark: hardcoded `bg-[#222528]`

---

## 7. Component Reference

### 7.1 Button (packages/ui)

**File:** `packages/ui/src/button.tsx`
**Import:** `import { Button, buttonVariants } from "@brimble/ui"`

Uses `class-variance-authority` (CVA).

**Base classes:**

```
inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md
text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50
[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0
outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive
```

**Variants:**

| Variant       | Classes                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/90`                                                                                                                                                                                                                                                            |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60`                                                                                                                                                                 |
| `outline`     | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50`                                                                                                                                                                             |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-secondary/80`                                                                                                                                                                                                                                                      |
| `ghost`       | `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50`                                                                                                                                                                                                                                              |
| `link`        | `text-primary underline-offset-4 hover:underline`                                                                                                                                                                                                                                                                   |
| `pill`        | `bg-gradient-to-b from-[rgba(34,37,40,0.69)] via-[rgba(34,37,40,0.81)] to-[#222528] border border-brimble-black text-brimble-air-gray rounded-full font-body font-medium shadow-[var(--shadow-button)] hover:opacity-90 transition-opacity dark:from-white/80 dark:via-white/90 dark:to-white dark:border-white/20` |
| `pill-light`  | `bg-brimble-light-gray text-brimble-black rounded-full font-body font-medium shadow-[var(--shadow-button)] hover:opacity-80 transition-opacity dark:shadow-[0px_0px_0px_1px_rgba(255,255,255,0.1)]`                                                                                                                 |
| `ghost-nav`   | `font-body font-medium text-brimble-black shadow-[var(--shadow-button)] rounded hover:bg-brimble-air-gray dark:hover:bg-white/10 transition-colors`                                                                                                                                                                 |

**Sizes:**

| Size      | Classes                                                                                    |
| --------- | ------------------------------------------------------------------------------------------ |
| `default` | `h-9 px-4 py-2 has-[>svg]:px-3`                                                            |
| `xs`      | `h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3` |
| `sm`      | `h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5`                                            |
| `lg`      | `h-10 rounded-md px-6 has-[>svg]:px-4`                                                     |
| `icon`    | `size-9`                                                                                   |
| `icon-xs` | `size-6 rounded-md [&_svg:not([class*='size-'])]:size-3`                                   |
| `icon-sm` | `size-8`                                                                                   |
| `icon-lg` | `size-10`                                                                                  |

**Props:**

```typescript
interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "pill" | "pill-light" | "ghost-nav";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  asChild?: boolean;
}
```

### 7.2 Accordion (packages/ui)

**File:** `packages/ui/src/accordion.tsx`
**Import:** `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@brimble/ui"`

Built on `radix-ui` Accordion primitives.

**AccordionItem classes:**

```
border-b border-[rgba(152,157,164,0.3)] dark:border-white/10 last:border-b-0
transition-colors duration-200 hover:bg-brimble-air-gray/60 dark:hover:bg-white/5
```

**AccordionTrigger classes:**

```
flex flex-1 cursor-pointer items-center justify-between gap-4 rounded-md py-4
text-left font-body font-medium text-xl leading-[30px] tracking-[-0.24px] text-brimble-black
transition-all duration-200 ease-out outline-none hover:text-brimble-accent-blue
[&[data-state=open]>svg]:rotate-180 [&[data-state=open]]:text-brimble-black
dark:[&[data-state=open]]:text-white
```

**AccordionContent classes:**

```
data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down
overflow-hidden font-body text-base text-brimble-black/50 tracking-[0.16px] leading-[20px]
```

### 7.3 DashButton (dashboard)

**File:** `apps/dashboard/src/components/shared/dash-button.tsx`

**Props:**

```typescript
interface DashButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "primary";
  size?: "sm" | "default";
  children: ReactNode;
}
```

**Base:** `inline-flex items-center gap-1 font-medium transition-colors shadow-[0px_1px_2px_rgba(18,18,23,0.05)]`

**Variants:**
| Variant | Classes |
|---------|---------|
| `outline` | `rounded-[4px] border border-dash-btn-outline-border bg-dash-btn-outline-bg text-dash-btn-outline-text hover:bg-dash-bg-elevated` |
| `primary` | `rounded-[4px] border border-[#3964d5] bg-[#4879f8] text-white hover:bg-[#3a6ae6]` |

**Sizes:**
| Size | Classes |
|------|---------|
| `sm` | `px-3 py-1 text-xs` |
| `default` | `px-3 py-[7px] text-sm` |

### 7.4 GlossyButton (dashboard)

**File:** `apps/dashboard/src/components/shared/glossy-button.tsx`

**Props:**

```typescript
interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "blue" | "red" | "white" | "black";
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: React.ReactNode;
}
```

**Base classes:**

```
flex h-[40px] items-center justify-center rounded-[8px] border px-3.5 text-sm font-medium
leading-5 text-white shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)]
transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-40
```

Background applied via inline `style={{ background: gradient }}`.

### 7.5 Modal (dashboard)

**File:** `apps/dashboard/src/components/shared/modal.tsx`

Built on `@radix-ui/react-dialog` + `motion/react`.

**Components & Props:**

```typescript
// Root wrapper
interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  width?: number;     // default: 500
  className?: string;
}

// Subcomponents
ModalHeader:         { title: string; description?: string }
ModalFooter:         { children: React.ReactNode }
ModalCancelButton:   { onClick?: () => void }
ModalContinueButton: { onClick?: () => void | Promise<void>; disabled?: boolean; loading?: boolean; loadingLabel?: React.ReactNode; children?: React.ReactNode }
```

**Overlay:** `fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]`

**Content container:**

```
fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg
shadow-[0px_2px_3px_rgba(0,0,0,0.06),inset_0px_-3px_2px_rgba(245,245,245,0.3)]
dark:shadow-[0px_2px_3px_rgba(0,0,0,0.2)]
```

**ModalHeader:**

```
flex flex-col gap-0.5 rounded-t-lg border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-4
```

Title: `text-base leading-[1.4] tracking-[-0.096px] text-dash-text-strong`
Description: `text-sm font-light leading-[1.3] text-dash-text-faded`

**ModalContinueButton:**

```
flex items-center rounded-[4px] border border-[#232931]
bg-gradient-to-b from-[#545459] via-[#45454b] to-[#2d2d32]
px-4 py-[5px] text-sm font-medium text-white
shadow-[0px_1px_2px_rgba(18,18,23,0.05)] transition-opacity
hover:opacity-90 disabled:pointer-events-none disabled:opacity-40
```

### 7.6 StatusChip (dashboard)

**File:** `apps/dashboard/src/components/shared/status-chip.tsx`

**Props:**

```typescript
interface StatusChipProps {
  status: string;
  className?: string;
}
```

**Container:**

```
flex h-5 items-center gap-2 rounded-[4px] border px-2
shadow-[0px_1px_2px_rgba(16,24,40,0.1),inset_0px_1px_0px_rgba(255,255,255,0.25)]
```

Dot: `size-1.5 rounded-full bg-white`
Label: `text-[8px] font-medium tracking-[-0.01px] text-white`

### 7.7 ToggleSwitch (dashboard)

**File:** `apps/dashboard/src/components/shared/toggle-switch.tsx`

**Props:**

```typescript
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}
```

**Sizes:**
| Size | Track | Thumb | Translate |
|------|-------|-------|-----------|
| `sm` | `w-[28px] h-[16px]` | `size-[12px]` | 12px |
| `default` | `w-[36px] h-[20px]` | `size-[16px]` | 16px |

**Track:** `relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors`

- Checked: `bg-[#4879f8]`
- Unchecked: `bg-dash-border`

**Thumb animation:** `{ type: "spring", stiffness: 500, damping: 30 }`

### 7.8 Spinner (dashboard)

**File:** `apps/dashboard/src/components/shared/spinner.tsx`

**Props:**

```typescript
interface SpinnerProps {
  className?: string;
  size?: string; // Tailwind size class, default "size-4"
}
```

SVG-based spinner with `animate-spin`. Background ring at 20% opacity, arc at full opacity.

### 7.9 Snackbar (dashboard)

**File:** `apps/dashboard/src/components/shared/snackbar.tsx`

**Props:**

```typescript
interface SnackbarProps {
  variant: "info" | "warning" | "error";
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}
```

**Container:** `flex items-center gap-3 border-b border-dash-border px-4 py-2.5`

**Variant backgrounds:**

- info: `bg-[#4879f8]/5 dark:bg-[#4879f8]/15`
- warning: `bg-[#f5a623]/5 dark:bg-[#f5a623]/15`
- error: `bg-[#ef2f1f]/5 dark:bg-[#ef2f1f]/15`

### 7.10 Tooltip & SimpleTooltip (dashboard)

**File:** `apps/dashboard/src/components/shared/tooltip.tsx`

Built on `@radix-ui/react-tooltip` + `motion/react`.

**TooltipProvider:** Wraps the app. `delayDuration={200}`, `skipDelayDuration={0}`.

**Tooltip (user profile card):**

```typescript
interface TooltipProps {
  children: ReactNode;
  user: { name: string; role: string; avatarUrl?: string; avatarFallback?: string };
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number; // default: 6
  delayDuration?: number;
}
```

**SimpleTooltip (text label):**

```typescript
interface SimpleTooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number; // default: 6
  delayDuration?: number;
}
```

**Shared tooltip card classes:**

```
z-50 rounded-md border border-[#141414]
bg-gradient-to-b from-[#434343] to-[#232323]
shadow-[0px_0.6px_0px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.18),inset_0px_1px_0px_rgba(255,255,255,0.18)]
```

Text: `text-xs leading-5 tracking-[-0.019px] text-white`

### 7.11 Dropdown (dashboard)

**File:** `apps/dashboard/src/components/shared/dropdown.tsx`

**Props:**

```typescript
interface DropdownProps {
  value: string;
  options: DropdownOption[] | string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  renderOption?: (option: DropdownOption, isSelected: boolean) => React.ReactNode;
}

interface DropdownOption {
  label: string;
  value: string;
}
```

Portal-based positioning with `AnimatePresence`. Supports searchable mode.

### 7.12 Pagination (dashboard)

**File:** `apps/dashboard/src/components/shared/pagination.tsx`

Two variants:

**NumberPagination:**

```typescript
interface NumberPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisible?: number;
  isLoading?: boolean;
  loadingPage?: number;
}
```

**CursorPagination:**

```typescript
interface CursorPaginationProps {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNext: () => void;
  onPrev: () => void;
  label?: string;
  showLabels?: boolean;
}
```

### 7.13 RangeSlider (dashboard)

**File:** `apps/dashboard/src/components/shared/range-slider.tsx`

Built on `@radix-ui/react-slider`.

**Props:**

```typescript
interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  hideValue?: boolean;
}
```

### 7.14 DateRangePicker (dashboard)

**File:** `apps/dashboard/src/components/shared/date-range-picker.tsx`

Built on `react-day-picker` with `mode="range"`, `numberOfMonths={2}`.

**Props:**

```typescript
interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  children: React.ReactNode;
}
```

Styled via `.brimble-date-picker` CSS class (see [Specialized CSS](#13-specialized-css)).

### 7.15 TabHeader (dashboard)

**File:** `apps/dashboard/src/components/shared/tab-header.tsx`

**Props:** `{ title: string; children?: React.ReactNode }`

Simple heading component for dashboard tab sections.

### 7.16 PageHeader (dashboard)

**File:** `apps/dashboard/src/components/shared/page-header.tsx`

**Props:** `{ title: string; children: React.ReactNode; image?: string }`

Features image with blend mode for non-white backgrounds. Image hidden on mobile.

### 7.17 FilterDropdown (dashboard)

**File:** `apps/dashboard/src/components/shared/filter-dropdown.tsx`

**Props:**

```typescript
interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  dropdownWidth?: number;
  align?: "left" | "right";
  loading?: boolean;
}

interface FilterOption {
  label: string;
  value: string;
  color?: string; // colored dot
}
```

### 7.18 StatusBar (dashboard)

**File:** `apps/dashboard/src/components/shared/status-bar.tsx`

**Props:** `{ show: boolean; children: React.ReactNode; action?: { label: string; onClick: () => void } }`

Fixed positioning at `bottom-6`. Includes a custom `OrangeSpinner` component.

---

## 8. Input System

Custom `@utility` definitions in `apps/dashboard/src/styles.css`.

### `input-base`

```css
@utility input-base {
  border-radius: 6px;
  background-color: #f9fafb;
  outline: none;
  box-shadow:
    0px 1px 2px rgba(3, 7, 18, 0.12),
    0px 0px 0px 1px rgba(3, 7, 18, 0.08);

  &:is(.dark *) {
    background-color: #1a1c1e;
    box-shadow:
      0px 1px 2px rgba(0, 0, 0, 0.3),
      0px 0px 0px 1px rgba(255, 255, 255, 0.08);
  }
}
```

### `input-focus`

```css
@utility input-focus {
  &:focus {
    box-shadow:
      0px 1px 2px rgba(3, 7, 18, 0.12),
      0px 0px 0px 1px rgba(3, 7, 18, 0.08),
      0px 0px 0px 3px rgba(72, 121, 248, 0.15);
  }

  &:is(.dark *):focus {
    box-shadow:
      0px 1px 2px rgba(0, 0, 0, 0.3),
      0px 0px 0px 1px rgba(255, 255, 255, 0.08),
      0px 0px 0px 3px rgba(72, 121, 248, 0.2);
  }
}
```

### `input-focus-within`

Same as `input-focus` but triggered on `:focus-within` (for wrapper elements containing inputs).

### `input-focus-red`

Error state — replaces blue ring `rgba(72, 121, 248, ...)` with red `rgba(225, 41, 29, 0.15)`:

```css
@utility input-focus-red {
  &:focus {
    box-shadow:
      0px 1px 2px rgba(3, 7, 18, 0.12),
      0px 0px 0px 1px rgba(3, 7, 18, 0.08),
      0px 0px 0px 3px rgba(225, 41, 29, 0.15);
  }

  &:is(.dark *):focus {
    box-shadow:
      0px 1px 2px rgba(0, 0, 0, 0.3),
      0px 0px 0px 1px rgba(255, 255, 255, 0.08),
      0px 0px 0px 3px rgba(225, 41, 29, 0.15);
  }
}
```

**Usage pattern:**

```tsx
<input className="input-base input-focus h-[34px] w-full px-3 text-sm text-dash-text-strong placeholder:text-dash-text-extra-faded" />
```

---

## 9. Animation System

### 9.1 Standard Easing

```
[0.16, 1, 0.3, 1]     /* "decelerate" — used everywhere */
```

This is a cubic-bezier that starts fast and decelerates smoothly.

### 9.2 Spring Configs

**ToggleSwitch:**

```typescript
{ type: "spring", stiffness: 500, damping: 30 }
```

**Tooltip:**

```typescript
{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }
```

### 9.3 Duration Scale

| Context               | Duration                            |
| --------------------- | ----------------------------------- |
| Overlay fade          | `0.2s`                              |
| Dropdown open/close   | `0.2s`                              |
| Date picker popover   | `0.22s`                             |
| Modal content         | `0.25s`                             |
| Snackbar enter/exit   | `0.25s`                             |
| Icon rotation         | `0.2s` via `duration-200`           |
| CSS hover transitions | `transition-colors` (150ms default) |

### 9.4 Stagger Pattern

```typescript
delay: 0.15 * i;
```

Used for staggering sequential elements (list items, grid cards).

### 9.5 `useInView` Config

```typescript
import { useInView } from "motion/react";

const ref = useRef(null);
const isInView = useInView(ref, { once: true, margin: "-80px" });
```

### 9.6 Modal Animation

**Overlay:**

```typescript
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
```

**Content:**

```typescript
initial={{ opacity: 0, scale: 0.96, y: 10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.96, y: 10 }}
transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
```

### 9.7 Snackbar Animation

```typescript
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: "auto" }}
exit={{ opacity: 0, height: 0 }}
transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
```

### 9.8 Tooltip Slide Animation

```typescript
const slideOffset = 6;

// Direction-aware initial/exit state:
// top/bottom → y offset, left/right → x offset
const initial = { opacity: 0, scale: 0.92, [axis]: direction };
const animate = { opacity: 1, scale: 1, [axis]: 0 };
const exit = initial;

transition = { type: "spring", stiffness: 500, damping: 30, mass: 0.8 };
```

### 9.9 Reduced Motion

Both apps respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Image Handling

### 10.1 Blend Mode Pattern

PNGs with baked-in near-white backgrounds on `bg-brimble-surface` (#f5f7f7) sections:

**Light mode:**

```
brightness-[1.02] mix-blend-multiply
```

- `brightness-[1.02]` pushes near-white (≈#f8f8f8) to pure white
- `mix-blend-multiply` then maps pure white → section background color exactly

**Dark mode:**

```
dark:brightness-100 dark:invert dark:mix-blend-screen dark:opacity-85
```

### 10.2 Mobile Safari Fix

**Problem:** Mobile Safari isolates `mix-blend-multiply` when `transform` (from framer-motion animations) is on the same element. The blend happens against transparent instead of the section background.

**Fix:** Put blend/brightness classes on a **static wrapper `<div>`**, NOT on the animated `<motion.img>`.

```tsx
{
  /* ✅ CORRECT */
}
<div className="brightness-[1.02] mix-blend-multiply dark:brightness-100 dark:invert dark:mix-blend-screen dark:opacity-85">
  <motion.img initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} src="/image.png" />
</div>;

{
  /* ❌ WRONG — blend breaks on mobile Safari */
}
<motion.img
  className="brightness-[1.02] mix-blend-multiply"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  src="/image.png"
/>;
```

### 10.3 Dark Mode Icon Inversion

For sidebar/nav icons that need to invert in dark mode:

```
dark:invert dark:sepia dark:saturate-[3] dark:hue-rotate-[345deg] dark:opacity-80
```

---

## 11. Scrollbar Styling

### apps/web (visible thin scrollbar)

```css
/* Webkit */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}
.dark * {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
```

### apps/dashboard (hidden scrollbar utility)

```css
.scrollbar-hidden {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
```

---

## 12. Z-Index Scale

| Value  | Usage                                                 |
| ------ | ----------------------------------------------------- |
| `2000` | NProgress loading bar (`#nprogress .bar`)             |
| `100`  | Command palette dialog (`.cmdk-dialog`)               |
| `99`   | Command palette overlay (`.cmdk-overlay`)             |
| `z-50` | Modals, dropdowns, popovers, tooltips, drawer content |
| `z-40` | Drawer/modal overlays                                 |
| `z-10` | Relative content layering                             |

---

## 13. Specialized CSS

### 13.1 Create New Project Card (hatched pattern)

```css
.create-new-project-card {
  background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='14' x2='14' y2='0' stroke='%23d9dadd' stroke-width='0.5'/%3E%3C/svg%3E");
  background-size: 14px 14px;
}
.dark .create-new-project-card {
  background-image: url("data:image/svg+xml,...stroke='%23454545'...");
}
```

### 13.2 NProgress Overrides

```css
#nprogress {
  pointer-events: none;
}
#nprogress .bar {
  background: #006fff;
  height: 4px;
  z-index: 2000;
  box-shadow: 0 0 0 1px rgb(0 111 255 / 16%);
}
#nprogress .peg {
  box-shadow:
    0 0 14px rgb(0 111 255 / 85%),
    0 0 7px rgb(0 111 255 / 65%);
}
.dark #nprogress .bar {
  background: #b27a22;
  box-shadow: 0 0 0 1px rgb(178 122 34 / 18%);
}
.dark #nprogress .peg {
  box-shadow:
    0 0 14px rgb(178 122 34 / 85%),
    0 0 7px rgb(178 122 34 / 65%);
}
```

### 13.3 Command Palette (cmdk)

Always-dark overlay UI. Key styles:

```css
.cmdk-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 99;
}

.cmdk-dialog {
  position: fixed;
  top: 12%;
  left: 50%;
  margin-left: -290px;
  z-index: 100;
  width: 580px;
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  background: rgba(124, 124, 124, 0.9);
  box-shadow: 0px 10px 28px -4px rgba(0, 0, 0, 0.26);
  font-family:
    "ABC Marfa",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

/* Search input */
.cmdk-dialog [cmdk-input] {
  height: 64px;
  padding: 0 20px;
  border-bottom: 0.5px solid #9f9f9f;
  font-size: 16px;
  font-weight: 300;
  letter-spacing: -0.0256px;
  color: #f9f9f9;
}

/* Action items */
.cmdk-dialog [cmdk-item] {
  height: 48px;
  gap: 8px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 300;
  letter-spacing: -0.0224px;
  color: #f9f9f9;
}

/* Selected item */
.cmdk-dialog [cmdk-item][data-selected="true"] {
  background: rgba(205, 205, 205, 0.5);
}

/* Group heading */
.cmdk-dialog [cmdk-group-heading] {
  height: 32px;
  padding: 0 20px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.0192px;
  color: #d1d1d1;
  text-transform: uppercase;
}

/* Shortcut badges */
.cmdk-shortcut {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: #e3e3e3;
}
.cmdk-shortcut-blue {
  background: #008cff;
}
.cmdk-shortcut-green {
  background: #00b85c;
}
.cmdk-shortcut-red {
  background: red;
}
.cmdk-shortcut-orange {
  background: #ff7a00;
}
```

### 13.4 Date Range Picker (rdp)

```css
.brimble-date-picker .rdp-month {
  padding: 12px;
}
.brimble-date-picker .rdp-month_grid {
  border-spacing: 0;
}
.brimble-date-picker .rdp-week {
  gap: 8px;
}
.brimble-date-picker .rdp-weekdays {
  gap: 8px;
}

/* Divider between two months */
.brimble-date-picker .rdp-months > .rdp-month:first-child {
  border-right: 0.5px solid #d9dadd;
}
.dark .brimble-date-picker .rdp-months > .rdp-month:first-child {
  border-right-color: var(--dash-border);
}

/* Range start/end pills */
.brimble-date-picker .rdp-range-start .rdp-day_button,
.brimble-date-picker .rdp-range-end .rdp-day_button {
  background-color: var(--dash-text-strong);
  color: var(--dash-bg);
  border-radius: 6px;
}

/* Range middle highlight */
.brimble-date-picker .rdp-range-middle {
  background-color: #f7f7f7;
}
.dark .brimble-date-picker .rdp-range-middle {
  background-color: rgba(255, 255, 255, 0.06);
}

/* Range edge rounding */
.brimble-date-picker .rdp-range-start {
  border-radius: 6px 0 0 6px;
}
.brimble-date-picker .rdp-range-end {
  border-radius: 0 6px 6px 0;
}
.brimble-date-picker .rdp-range-start.rdp-range-end {
  border-radius: 6px;
}

/* Today dot */
.brimble-date-picker .rdp-today .rdp-day_button::after {
  content: "";
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background-color: var(--dash-text-faded);
}
```

---

## 14. Icon Libraries

| Library                   | Package    | Used In   | Primary Usage                                                                     |
| ------------------------- | ---------- | --------- | --------------------------------------------------------------------------------- |
| **lucide-react**          | `^0.545.0` | All apps  | General icons (Moon, Sun, ChevronDown, Info, AlertTriangle, AlertCircle, X, etc.) |
| **@phosphor-icons/react** | `^2.1.10`  | Dashboard | Specialized icons (CheckCircle, ShieldCheck, ArrowLeft, ArrowsClockwise, X, etc.) |
| **Custom SVGs**           | —          | Both      | Sidebar nav icons, brand logos, feature illustrations                             |

**Icon sizing convention:**

- Default SVG size in buttons: `size-4` (16px) via `[&_svg:not([class*='size-'])]:size-4`
- Explicit overrides: `size-3` (12px), `size-3.5` (14px), `size-5` (20px)

---

## 15. State Management & API Patterns

### 15.1 Zustand Stores

**File:** `apps/dashboard/src/hooks/use-tags-store.ts`

Pattern: `create<StateInterface>((set, get) => ({ ... }))` with optimistic updates and server function integration.

```typescript
import { create } from "zustand";

interface TagsState {
  tags: Tag[];
  loading: boolean;
  hydrate: (tags: Tag[], workspace: string | null) => void;
  fetchTags: (workspace: string | null) => Promise<void>;
  createTag: (name: string, color?: string, workspace?: string) => Promise<Tag>;
  deleteTag: (tagId: string) => Promise<void>;
  // ... etc
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  loading: false,
  // Optimistic updates with rollback on error
}));
```

### 15.2 TanStack Router Configuration

File-based routing with TanStack Start (SSR). Auto-generated route tree in `routeTree.gen.ts`.

**Root route pattern:**

```typescript
export const Route = createRootRoute({
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  head: () => ({
    meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "Brimble Dashboard" }],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  beforeLoad: async ({ location }) => {
    await enforceRouteAuth(location.pathname, location.searchStr);
  },
  loader: async ({ location }) => {
    /* ... */
  },
});
```

**File route pattern:**

```typescript
export const Route = createFileRoute("/")({
  staleTime: 30_000,
  preloadStaleTime: 30_000,
  validateSearch: (search) => workspaceLoaderDeps(search),
  loaderDeps: ({ search }) => workspaceLoaderDeps(search),
  loader: async ({ deps }) => {
    /* ... */
  },
});
```

### 15.3 Server Functions

Pattern using `createServerFn` from `@tanstack/react-start`:

```typescript
import { createServerFn } from "@tanstack/react-start";

// GET — no payload
export const listWorkspacesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return getServerBackendApi().workspaces.list();
});

// POST — with payload
export const createTagServerFn = createServerFn({
  method: "POST",
}).handler(async ({ data }) => {
  const payload = data as { workspace?: string; name: string; color: string } | undefined;
  if (!payload?.name?.trim()) throw new Error("Tag name is required");
  return getServerBackendApi().tags.create({
    /* ... */
  });
});
```

### 15.4 localStorage Keys

| Key                                       | App       | Values                    | Purpose                           |
| ----------------------------------------- | --------- | ------------------------- | --------------------------------- |
| `brimble-theme`                           | web       | `"light"` \| `"dark"`     | Web theme preference              |
| `theme`                                   | dashboard | `"light"` \| `"dark"`     | Dashboard theme preference        |
| `brimble:welcome-modal-dismissed`         | dashboard | `"true"`                  | Welcome modal dismissed           |
| `brimble:followed-on-x`                   | dashboard | `"true"`                  | Onboarding X follow status        |
| `brimble:dismissed-snackbars:{workspace}` | dashboard | JSON array of message IDs | Per-workspace dismissed snackbars |

Pattern: `brimble:dismissed-snackbars:${workspace || "__personal__"}`

---

## Base Layer

Both apps apply in `@layer base`:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Dashboard additionally makes all buttons/roles use pointer cursor:

```css
button,
[role="button"] {
  cursor: pointer;
}
```
