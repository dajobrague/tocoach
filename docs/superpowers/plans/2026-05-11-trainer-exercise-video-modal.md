# Trainer Exercise Video Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile-only `VerticalVideoPlayerModal` used on the trainer side with a desktop-friendly, accessible modal so trainers can review client-uploaded exercise videos inside the GoHighLevel iframe without getting trapped in fullscreen.

**Architecture:** Create a new presentation-only component `TrainerExerciseVideoModal` under `components/trainer/`. It exposes the **same imperative handle** as the current modal (`open(url, name)`) so swapping is a one-line import change in `progress-tab.tsx`. The cliente flow is untouched: `VerticalVideoPlayerModal` stays as-is for any future client use. The data flow (video URL resolution via `lib/utils/video-url.ts`, the `/api/clients/{clientId}/exercise-logs/trainer` endpoint) does not change.

**Tech Stack:** Next.js 15 App Router, React 19, HeroUI v2 (`@heroui/modal`), framer-motion, Tailwind v4, `@iconify/react`. Native HTML5 `<video controls playsInline>` — no third-party player.

**UX/UI principles applied:**

- Native HTML5 controls (familiar, free fullscreen opt-in, seek bar, volume, playback speed, no learning curve)
- **Centered modal** (`max-w-4xl`, `max-h-[85vh]`) — not `inset-0` — so the trainer is never visually "trapped"
- `object-contain` on the video so client uploads (portrait or landscape) keep their aspect ratio
- Black letterbox background for visual stability while keeping the modal surface in the design system
- Persistent close affordances: visible X button (no auto-hide), backdrop click to dismiss, ESC key
- Loading and error states — important because videos served from Supabase Storage occasionally take a beat
- Focus trap + restore (HeroUI Modal handles this), `aria-label` on close, captions track preserved
- Responsive: on `< sm` viewports the modal expands to full width with a slim chrome — still not fullscreen-locked
- Dark mode aware (matches existing `Modal` usages in `components/dashboard/client-profile/`)

---

## File Structure

**Create:**

- `components/trainer/trainer-exercise-video-modal.tsx` — new presentation component, exposes `TrainerExerciseVideoHandle` with `open(url, name)`.

**Modify:**

- `components/dashboard/client-profile/tabs/progress-tab.tsx:22-25, 37, 240` — swap import and ref type from `VerticalVideoPlayerModal` to `TrainerExerciseVideoModal`. Three small touch points.

**Do not touch:**

- `components/client-dashboard/vertical-video-player-modal.tsx` (kept intact for the client side)
- `lib/utils/video-url.ts`
- `app/api/clients/[clientId]/exercise-logs/trainer/*`
- Anything under `app/[slug]/`

---

## Task 1: Scaffold the new component with a stable public API

**Files:**

- Create: `components/trainer/trainer-exercise-video-modal.tsx`

This task produces a working but minimal modal with the correct imperative handle, so Task 4's swap compiles immediately. We add polish (loading, error, motion) in Tasks 2–3.

- [ ] **Step 1: Create the file with the component skeleton, types, and imperative handle**

Write `components/trainer/trainer-exercise-video-modal.tsx`:

```tsx
"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface TrainerExerciseVideoHandle {
  open: (url: string, name: string) => void;
}

interface TrainerExerciseVideoModalProps {
  onClose?: () => void;
}

export const TrainerExerciseVideoModal = forwardRef<
  TrainerExerciseVideoHandle,
  TrainerExerciseVideoModalProps
>(function TrainerExerciseVideoModal({ onClose }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [exerciseName, setExerciseName] = useState("");

  useImperativeHandle(
    ref,
    () => ({
      open(url: string, name: string) {
        setVideoSrc(url);
        setExerciseName(name);
        setIsOpen(true);
      },
    }),
    []
  );

  const handleClose = useCallback(() => {
    const el = videoRef.current;

    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setIsOpen(false);
    setVideoSrc("");
    onClose?.();
  }, [onClose]);

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-transparent shadow-none",
        wrapper: "items-center",
        closeButton: "hidden",
      }}
      hideCloseButton
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="4xl"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center justify-between gap-3 bg-zinc-900/95 text-white rounded-t-xl px-4 py-3">
          <span className="truncate text-base font-semibold">
            {exerciseName}
          </span>
          <button
            aria-label="Cerrar video"
            className="rounded-full p-1.5 hover:bg-white/10 transition-colors"
            type="button"
            onClick={handleClose}
          >
            <Icon icon="solar:close-circle-bold" width={24} />
          </button>
        </ModalHeader>
        <ModalBody className="p-0 bg-black rounded-b-xl">
          <div className="relative w-full aspect-video max-h-[78vh]">
            {videoSrc && (
              <video
                ref={videoRef}
                controls
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-contain bg-black"
                preload="metadata"
                src={videoSrc}
              >
                <track kind="captions" label="Spanish" srcLang="es" />
              </video>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});
```

- [ ] **Step 2: Verify the file type-checks in isolation**

Run: `npm run type-check`
Expected: PASS (no errors related to the new file).
If errors appear, they are likely import path issues — fix and re-run.

- [ ] **Step 3: Commit the scaffold**

```bash
git add components/trainer/trainer-exercise-video-modal.tsx
git commit -m "feat(trainer): scaffold TrainerExerciseVideoModal component"
```

---

## Task 2: Add loading and error states

The video may take seconds to load from Supabase Storage; without feedback the user sees a black rectangle and assumes it's stuck.

**Files:**

- Modify: `components/trainer/trainer-exercise-video-modal.tsx`

- [ ] **Step 1: Add `status` state and event handlers**

Inside the component body, after the existing `useState` declarations, add:

```tsx
const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

const handleLoadedData = useCallback(() => setStatus("ready"), []);
const handleError = useCallback(() => setStatus("error"), []);
```

Update `open(url, name)` inside `useImperativeHandle` to reset status:

```tsx
open(url: string, name: string) {
  setVideoSrc(url);
  setExerciseName(name);
  setStatus("loading");
  setIsOpen(true);
},
```

- [ ] **Step 2: Wire handlers and render overlays**

Replace the `<div className="relative w-full aspect-video max-h-[78vh]">` block in `ModalBody` with:

```tsx
<div className="relative w-full aspect-video max-h-[78vh]">
  {videoSrc && (
    <video
      ref={videoRef}
      controls
      playsInline
      autoPlay
      className="absolute inset-0 w-full h-full object-contain bg-black"
      preload="metadata"
      src={videoSrc}
      onError={handleError}
      onLoadedData={handleLoadedData}
    >
      <track kind="captions" label="Spanish" srcLang="es" />
    </video>
  )}

  {status === "loading" && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
      <Icon
        className="text-white animate-spin"
        icon="solar:refresh-bold"
        width={40}
      />
    </div>
  )}

  {status === "error" && (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white px-6 text-center">
      <Icon
        className="text-red-400"
        icon="solar:videocamera-record-broken"
        width={48}
      />
      <p className="text-sm font-medium">No se pudo cargar el video.</p>
      <p className="text-xs text-white/60">
        Intentá cerrar y volver a abrirlo, o pedile al cliente que vuelva a
        subir el archivo.
      </p>
    </div>
  )}
</div>
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/trainer/trainer-exercise-video-modal.tsx
git commit -m "feat(trainer): add loading and error states to video modal"
```

---

## Task 3: Polish — keyboard, focus, and mobile responsiveness

HeroUI's `Modal` already gives us ESC-to-close and focus trap, but we want to be explicit about a few things and make the modal feel right on small screens.

**Files:**

- Modify: `components/trainer/trainer-exercise-video-modal.tsx`

- [ ] **Step 1: Make the modal full-width on small viewports without becoming a fullscreen trap**

Find the `<Modal …>` JSX and update the `classNames` and `size` props:

```tsx
<Modal
  backdrop="blur"
  classNames={{
    base: "bg-transparent shadow-none mx-2 sm:mx-6",
    wrapper: "items-center",
    closeButton: "hidden",
  }}
  hideCloseButton
  isOpen={isOpen}
  motionProps={{
    variants: {
      enter: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
      exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12 } },
    },
  }}
  placement="center"
  scrollBehavior="inside"
  size="4xl"
  onClose={handleClose}
>
```

Rationale: `mx-2 sm:mx-6` gives breathing room from the viewport edge on phones; HeroUI's default backdrop-click and ESC behavior remains. `motionProps` overrides HeroUI's default slide animation with a gentle scale-fade that feels more like a media viewer than a form dialog.

- [ ] **Step 2: Type-check and run the linter (autofix on)**

Run: `npm run type-check`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (any `import/order` or `jsx-sort-props` issues will be autofixed).

- [ ] **Step 3: Commit**

```bash
git add components/trainer/trainer-exercise-video-modal.tsx
git commit -m "feat(trainer): refine modal motion and small-screen spacing"
```

---

## Task 4: Wire the new modal into `progress-tab.tsx`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/progress-tab.tsx` (lines 22–25, 37, 240)

- [ ] **Step 1: Swap the import**

In `components/dashboard/client-profile/tabs/progress-tab.tsx`, replace the import block at lines 22–25:

```tsx
import {
  VerticalVideoPlayerModal,
  type VerticalVideoPlayerHandle,
} from "@/components/client-dashboard/vertical-video-player-modal";
```

with:

```tsx
import {
  TrainerExerciseVideoModal,
  type TrainerExerciseVideoHandle,
} from "@/components/trainer/trainer-exercise-video-modal";
```

- [ ] **Step 2: Swap the ref type**

In the same file at line 37, replace:

```tsx
const videoPlayerRef = useRef<VerticalVideoPlayerHandle>(null);
```

with:

```tsx
const videoPlayerRef = useRef<TrainerExerciseVideoHandle>(null);
```

- [ ] **Step 3: Swap the JSX element**

At line 240, replace:

```tsx
<VerticalVideoPlayerModal ref={videoPlayerRef} />
```

with:

```tsx
<TrainerExerciseVideoModal ref={videoPlayerRef} />
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run type-check`
Expected: PASS.

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/client-profile/tabs/progress-tab.tsx
git commit -m "feat(trainer): use TrainerExerciseVideoModal on progress tab"
```

---

## Task 5: Manual QA — verify the trainer flow end-to-end

This project has no component test infrastructure, so verification is browser-based. **Do this before declaring done.**

**Pre-requisites:** local Supabase env vars present, at least one trainer account with a client that has uploaded a strength-exercise video log.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server listens on `http://localhost:3000`.

- [ ] **Step 2: Smoke test on desktop (Chrome)**

Navigate to `http://localhost:3000/trainer/dashboard/clients/<clientId>` for a client with logged exercise videos. Open the **Progreso** tab, expand a strength exercise card that has a video log, and click the play affordance.

Verify, in order:

1. The modal opens **centered**, not fullscreen.
2. A loading spinner appears briefly, then the video plays with native HTML5 controls.
3. The video respects its aspect ratio (no crop/zoom).
4. The X button in the top-right closes the modal.
5. **Backdrop click** closes the modal.
6. **ESC** closes the modal.
7. After closing, the video element is unmounted/cleared (no audio continues in the background — check by reopening and confirming the time starts at 0).

- [ ] **Step 3: Smoke test the iframe context (the original bug)**

If a staging GHL environment is available, open the trainer dashboard there and repeat Step 2 verifications. If GHL is not accessible, simulate by loading the page inside a local iframe (create a throwaway HTML file with `<iframe src="http://localhost:3000/trainer/dashboard/clients/<clientId>" width="1200" height="800" allow="fullscreen"></iframe>`) and verify the modal is **not** locked to fullscreen and remains dismissable.

- [ ] **Step 4: Smoke test on mobile (Chrome DevTools device emulation, iPhone 14)**

Repeat Step 2 verifications. Confirm:

- The modal has visible horizontal margin (does not touch viewport edges).
- The native iOS playback controls appear.
- The modal does not auto-promote to iOS native fullscreen on `play()` (this is the `playsInline` guarantee).

- [ ] **Step 5: Error state check**

Temporarily edit `progress-tab.tsx` line 40 to call `openVideo("https://example.com/does-not-exist.mp4", "Test")` from a button, or feed an invalid URL via the React DevTools, and confirm the error overlay renders with the friendly Spanish message. **Revert this change before continuing.**

- [ ] **Step 6: Confirm client side untouched**

Sign in as a client (any tenant slug). Navigate to the client dashboard and open a video they uploaded for themselves. Verify the **vertical TikTok-style player still works** — this is `VerticalVideoPlayerModal` which we intentionally left untouched.

- [ ] **Step 7: Stop the dev server**

`Ctrl+C` in the terminal.

---

## Task 6: Final verification and PR

- [ ] **Step 1: Re-run the full verification suite**

Run these three commands sequentially and confirm each passes:

```bash
npm run type-check
npm run lint:check
npm run format:check
```

Expected: all three PASS. If `format:check` fails, run `npm run format` and commit:

```bash
git add -A
git commit -m "chore: format trainer video modal files"
```

- [ ] **Step 2: Review the diff before pushing**

Run: `git log --oneline -6`
Expected: see the 4–5 commits from Tasks 1–4 (and optionally Task 6 step 1).

Run: `git diff main...HEAD --stat`
Expected: at most two files changed —

- `components/trainer/trainer-exercise-video-modal.tsx` (created)
- `components/dashboard/client-profile/tabs/progress-tab.tsx` (modified, ~3 lines)

If anything else appears in the diff, investigate before pushing.

- [ ] **Step 3: Push and open the PR**

Ask the user how they want to ship (direct push to a branch + PR, or stay local). Do not push without confirmation.
