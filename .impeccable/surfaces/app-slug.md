---
version: 1
slug: "app-slug"
primary_target: "app/[slug]"
related_targets: []
---

# Client portal (app/[slug]) — surface brief

Mode: Operate. Audience: a trainer's clients (Spanish, phone-first PWA, sometimes iframe). Jobs: do today's workout and log sets, follow today's menu, send daily log / weekly check-in, message the trainer. Constraint: every screen renders under ~44 arbitrary trainer palettes (light, dark, pale, broken legacy) via lib/theme/render-css.ts + client-surface.ts; semantic tokens only.

Decisions (Sep 29 2026, David): brand-forward tone; header = brand hero on Inicio, compact title bar on all other tabs; cards = soft elevation (theme shadow e1, no border); all phases, nothing off-limits.

## Direction contract

THESIS: The app is the trainer's, not ours. The trainer's brand greets once, loudly, on Inicio; everywhere else it recedes to a quiet frame and carries only actions and "today". Refuses: a per-page mix of greeting headers, oversized H1s and hero cards.
OWN-WORLD: Neutral surface from the tenant canvas; brand as one solid field (Inicio band, primary buttons, today markers) with computed foreground; brand tints only for selected/today; soft-elevated cards, one radius family (theme lg), sentence-case section headers, Solar linear icons.
STORY: Open → see who your coach is and what today asks → tap into the tab → same bar, same cards, same actions everywhere.
FIRST VIEWPORT: Inicio band: logo chip, "Hola, {nombre}", today's date, chat + bell on the brand field.
SIGNATURE: The brand band itself — the only place the trainer's color fills a region.
RISK: Pale/dark brands on a full band; mitigated by computed foreground and logo on a surface chip.
