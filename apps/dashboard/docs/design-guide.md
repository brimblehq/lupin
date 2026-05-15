# Dashboard Design Guide

Conventions for building **Modals**, **Input fields**, **Toggles**, and **Sidebars** in the Brimble dashboard. Patterns were derived by scanning the current codebase — every class name, token, and behavior below is what ships today. Reference this before introducing a new primitive.

> When in doubt: open the closest existing surface (payment modal, domain form, toggle row) and mirror it.

---

## Tokens & primitives

### Colors (from `src/styles.css`)

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--dash-bg` | `#ffffff` | `#202022` | Surface (modals, cards) |
| `--dash-bg-elevated` | `#fafafa` | `#29292a` | Headers, hovered rows |
| `--dash-text-strong` | `#23252a` | `#ffffff` | Primary text, titles |
| `--dash-text-body` | `#535358` | `#bdbcbc` | Secondary body text |
| `--dash-text-faded` | `#646569` | `#9a9d9c` | Labels, helper text |
| `--dash-text-extra-faded` | `#b6b8bd` | `#8e9195` | Placeholder, subtle hints |
| `--dash-border` | `#d9dadd` | `#454545` | Standard borders |
| `--dash-border-soft` | `#e6e5e5` | `#454545` | Dividers |

**Accent hexes** (used directly, no token):

- Interactive blue: `#4879f8`
- Destructive / error red: `#ef2f1f` (solid), `#e1291d` (focus/border)
- Warning orange: `#f5a623`
- Success green: `#34d399`

### Typography

| Context | Classes |
|---|---|
| Modal title | `text-base leading-[1.4] tracking-[-0.096px] text-dash-text-strong` |
| Section / field label | `text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong` |
| Body text | `text-sm leading-6 text-dash-text-body` |
| Helper text | `text-xs text-dash-text-faded` |
| Error message | `text-sm font-light leading-5 text-[#e1291d]` |

### Radii & borders

- Inputs & pills: `rounded-[4px]` or `rounded-[6px]`
- Modals & cards: `rounded-[4px]`
- Borders are almost always `border-[0.5px] border-dash-border` (or `border-dash-border-soft` for dividers).

### Motion

- Easing curve: `[0.16, 1, 0.3, 1]` as a cubic-bezier. Reuse, do not invent.
- Typical durations: 200ms for overlays/chevrons, 250ms for modal entrance.
- Toggle uses spring `{ type: "spring", stiffness: 500, damping: 30 }`.

---

## 1. Modals

### Base component

`src/components/shared/modal.tsx` exports the core primitives. Compose the pieces — do not re-implement a modal from scratch.

```tsx
import { Modal, ModalHeader, ModalFooter, ModalCancelButton, ModalContinueButton } from "@/components/shared/modal";

<Modal open={open} onClose={() => setOpen(false)} width={420}>
  <ModalHeader title="Change plan" description="Select a new plan for your workspace." />

  <div className="flex flex-col gap-4 px-6 py-5">
    {/* body */}
  </div>

  <ModalFooter>
    <ModalCancelButton />
    <ModalContinueButton onClick={handleConfirm} disabled={!selectedPlan} />
  </ModalFooter>
</Modal>
```

### Structure at a glance

| Part | Class / token |
|---|---|
| Backdrop | `fixed inset-0 bg-black/40 backdrop-blur-[2px]` (fade 200ms) |
| Container | `rounded-[4px] border-[0.5px] border-dash-border bg-dash-bg` |
| Header | `rounded-t-lg border-b-[0.5px] border-dash-border bg-dash-bg-elevated px-6 py-4` |
| Body | `flex flex-col gap-4 px-6 py-5` |
| Footer | `flex items-center justify-between border-t-[0.5px] border-dash-border px-4 py-4` |

**Entrance / exit** (built in): opacity `0 → 1`, scale `0.96 → 1`, y `10 → 0` over 250ms. AnimatePresence handles the cycle — don't wrap calls in your own `motion` components.

### Width conventions

| Modal type | Width |
|---|---|
| Confirmation (destructive, ownership, small choices) | `420px` |
| Standard form (plan change, add domain, settings) | `500px` |
| Wider forms with repeating rows (team invites, env-vars) | `520px` |

Mobile: `max-w-[calc(100vw-16px)]` is already applied. Footer buttons stack as `flex-col-reverse` on narrow viewports — the primary action stays on top.

### Footer buttons

- **Cancel** — `ModalCancelButton` renders a neutral button (h-34, border, `bg-dash-bg`).
- **Primary action** — `ModalContinueButton` or `GlossyButton` with a color prop (`blue` / `red` / `black`).
- Destructive flows put the confirm button on the right and style it red.
- Order left→right: secondary then primary. Always.

### Close behavior (consistent across all modals)

- Backdrop click closes.
- `Escape` closes (Radix default).
- Header has an `X` icon close button.
- Haptics: `haptics.soft()` on open, `haptics.medium()` or `heavy()` on confirm.

### Variants you can copy

| Use case | Reference file |
|---|---|
| Warning / destructive confirmation | `src/components/shared/warning-modal.tsx` |
| Multi-step wizard (motion scale+fade between steps) | `src/components/shared/add-domain-modal.tsx` |
| Plan / setting change | `src/components/shared/change-plan-modal.tsx` |
| Accept / deny with context icon | `src/components/shared/ownership-transfer-modal.tsx` |
| Dynamic row list (add/remove rows) | `src/components/settings/invite-members-modal.tsx` |

**Warning modal shorthand:**

```tsx
<WarningModal
  open={open}
  onClose={() => setOpen(false)}
  title="Delete project"
  description="This will permanently remove the project and all deployments."
  confirmLabel="Delete project"
  onConfirm={handleDelete}
/>
```

---

## 2. Input fields

### The canonical input

Every standard text input stacks these two utility classes, defined in `src/styles.css`:

- `input-base` — shape, background, and resting box-shadow border
- `input-focus` — focus-state box-shadow

```tsx
<input
  type="text"
  placeholder="brimble.io"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  className="w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af]"
/>
```

Height is intrinsic — `py-2.5` + `leading-6` produces the ~44px standard. If you need an explicit height use `min-h-[46px]` (the pattern used by `Dropdown` triggers so they align with inputs).

### Field row (label + input + helper / error)

```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">Domain URL</label>
  <input
    className={`w-full input-base px-3 py-2.5 text-sm leading-6 text-dash-text-strong ${
      error
        ? "shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)]"
        : "input-focus"
    }`}
  />
  {error && <p className="text-sm font-light leading-5 text-[#e1291d]">{error.message}</p>}
</div>
```

- Label spacing: `gap-1.5` between label and input.
- Error styling: replace `input-focus` with an explicit double box-shadow (1px solid red + 3px red tint). There is also an `input-focus-red` utility in `styles.css` that produces the same effect.
- Disabled inputs: `disabled` attribute + `disabled:opacity-60` or `disabled:cursor-not-allowed`.

### Input shapes for common cases

**Numeric / currency** (strip spinner chrome):

```tsx
<input
  type="number"
  className="w-full input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong placeholder:text-[#9ca3af] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

**Monospace / code value:** append `font-family-mono text-[13px]` to the base class.

**Search bar** — use the shared `SearchFilterBar`:

```tsx
import { SearchFilterBar } from "@/components/shared/search-filter-bar";

<SearchFilterBar value={query} onChange={setQuery} placeholder="Search…" className="flex-1 bg-dash-bg" />
```

**Textarea:** same classes plus `min-h-[46px]` (grows with content).

**Input with trailing icon / button:** nest the input in a `relative` wrapper and absolutely-position the action. The copy button in the request-log detail drawer is the reference (`logs.tsx:CopyValueButton`).

### Selection controls — use the shared component

Do not build a raw `<select>`. There are two shared dropdowns:

| Component | When to use |
|---|---|
| `Dropdown` (`src/components/shared/dropdown.tsx`) | Single-select, form field — trigger matches input height (`min-h-[46px]`), menu portals to the body, supports search |
| `FilterDropdown` (`src/components/shared/filter-dropdown.tsx`) | Toolbar filters (short trigger, icon-only reset) |

Specialized dropdowns (`DiskSizeSelect`, `RoleDropdown`) wrap `Dropdown` for domain-specific options.

```tsx
<Dropdown
  value={op}
  options={["eq", "contains", "regex"]}
  onChange={setOp}
  renderOption={(v) => FIELD_OP_LABELS[v]}
/>
```

### Checkbox

No component — plain input with accent color:

```tsx
<input type="checkbox" className="mt-0.5 size-4 rounded border-dash-border accent-[#4879f8]" />
```

### Form layout primitives

- Vertical stack: `flex flex-col gap-4` (between fields), `flex flex-col gap-1.5` (within a field).
- Inline pair: `grid grid-cols-2 gap-3` or `flex items-center gap-1.5`.
- Nothing wider than the modal / drawer container it lives in — inputs always take `w-full`.

---

## 3. Toggles

### ToggleSwitch

`src/components/shared/toggle-switch.tsx`. Always use this — there's no other toggle primitive.

**Props**

```ts
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "default"; // default: "default"
}
```

**Sizes**

| Size | Track | Thumb |
|---|---|---|
| `default` | 36×20 | 16×16, translate 16 |
| `sm` | 28×16 | 12×12, translate 12 |

**Visuals**

- Off track: `bg-dash-border`
- On track: `bg-[#4879f8]`
- Thumb: white with a dark soft shadow for lift
- Disabled: `opacity-40 cursor-not-allowed`
- Motion: spring `{ stiffness: 500, damping: 30 }`
- Haptic: `haptics.rigid()` on every toggle

**A11y built-in**: `role="switch"`, `aria-checked`, keyboard `Enter` / `Space`.

### Canonical row

Toggle on the right. Label + description stacked on the left. This is the pattern everywhere from domain-purchase to persistent-storage:

```tsx
<div className="flex items-center justify-between">
  <div className="flex flex-col">
    <span className="text-sm font-medium text-dash-text-strong">Domain privacy</span>
    <span className="text-xs text-dash-text-faded">$8/year extra</span>
  </div>
  <ToggleSwitch checked={privacy} onChange={setPrivacy} disabled={isApp} />
</div>
```

For toggles that reveal a sub-section when on, wrap the sub-section in `AnimatePresence` + a motion height/opacity wrapper (mirroring the persistent-storage pattern in `routes/projects/new.tsx`):

```tsx
<ToggleSwitch checked={diskEnabled} onChange={setDiskEnabled} size="sm" />

<AnimatePresence>
  {diskEnabled && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* reveal content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Not toggles — don't confuse

- **Tab bars / segment controls** (e.g. application vs. request logs) are button groups, not `ToggleSwitch`. Use a `flex overflow-clip rounded-[4px] border` container with button children — reference `routes/projects/$projectId/logs.tsx` around the tab switcher.
- **Checkbox** for multi-select in forms (see above).
- **FilterDropdown** for "All Levels / Info / Warn / …" single-select filters.

---

## Quick-reference cheatsheet

| Need | Class / file |
|---|---|
| Standard text input | `input-base input-focus px-3 py-2.5 text-sm leading-6 text-dash-text-strong` |
| Form field label | `text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong` |
| Helper text | `text-xs text-dash-text-faded` |
| Error text | `text-sm font-light leading-5 text-[#e1291d]` |
| Soft border | `border-[0.5px] border-dash-border` |
| Divider | `border-dash-border-soft` |
| Modal surface radius | `rounded-[4px]` |
| Input / pill radius | `rounded-[4px]` |
| Easing | `[0.16, 1, 0.3, 1]` |
| Toggle | `ToggleSwitch` from `components/shared/toggle-switch.tsx` |
| Modal primitives | `components/shared/modal.tsx` |
| Select / dropdown | `components/shared/dropdown.tsx` |
| Search field | `components/shared/search-filter-bar.tsx` |
| Glossy CTA button | `components/shared/glossy-button.tsx` |

If a primitive you need isn't listed, search `src/components/shared` before introducing a new one.
