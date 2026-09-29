# Design system

**Personality**: trusted, human, modern, community-centred, privacy-focused. No stock people imagery; illustrations use abstract product UI.

## Tokens (`src/app/globals.css`)

- Brand teal `brand-50…950` (primary actions `brand-700`, 7:1 on white).
- Clay accent `clay-50…700` (text use `clay-600`+ only; `clay-500` is decorative).
- Neutrals: `ink` (text), `muted` (secondary text, ≥4.5:1 on canvas), `line` (borders), `canvas` (page), `surface`.
- Type: Plus Jakarta Sans (UI), Fraunces (display headings).
- Radius `--radius-card` 1.25rem; shadows `--shadow-card`, `--shadow-lift`; one subtle `fade-up` animation, disabled by reduced-motion.

## Components (`src/components/ui`)

`Button`/`ButtonLink` (primary, secondary, ghost, danger, accent, inverse; sm/md/lg ≥ 36px), `Card`/`CardHeader`/`CardBody`/`PageHeader`, `Badge`, **`VerificationBadge`** (only renderer of verification state), `DemoBadge`, `Alert`, `EmptyState`, `NotConfigured`, form controls (`Field`, `TextField`, `TextAreaField`, `SelectField`, `Checkbox` 24px, `Fieldset`), `ActionForm` + `SubmitButton` (pending state, announced errors, input preserved), `SafeMarkdown`, `KoraLogo`/`KoraMark`.

## Accessibility baseline

WCAG 2.2 AA verified by axe on every page at desktop and mobile: skip link, `main#main`, single h1, labelled controls, `aria-live` status, visible focus ring, 24px targets, no horizontal scroll at 390px.
