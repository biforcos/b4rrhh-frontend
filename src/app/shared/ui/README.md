# Shared UI Master-Detail Pattern

These components are reusable presentation primitives. They do not own domain rules, feature filtering semantics, stores, gateways, or form workflows.

## app-master-detail-shell

Use it for page-level master-detail layout.

Does:
- page title and subtitle
- toolbar slot
- list slot
- detail slot
- responsive split layout

Does not:
- fetch data
- manage selection
- know feature semantics

Final slot naming:
- slot="toolbar"
- slot="list"
- slot="detail"

## app-master-list-panel

Use it for the left navigation/list area.

Does:
- header
- primary action button
- search input
- loading, error, and empty states
- item rendering through projected template
- event emission for selection, creation, and search value changes

Does not:
- filter items by itself
- interpret search meaning
- compare full objects for selection

Selection must be based on stable keys through itemKey and selectedItemKey.

## app-list-item

Use it as the visual card for one row inside master-list-panel.

Does:
- selected visual state
- optional status badge
- projected row content

Does not:
- own click handling
- know business meaning

## app-entity-header

Use it as the top block of the selected entity detail.

Does:
- title and optional subtitle
- metadata grid
- status badge
- optional actions slot
- optional visual slot

Does not:
- edit the entity
- decide workflow or domain status semantics

## app-section-card

Use it as the visual wrapper for detail sections.

Does:
- title and optional description
- optional actions slot
- optional footer slot rendered only when provided
- consistent visual surface for detail blocks

Does not:
- implement forms
- own section business behavior
- centralize feature logic

Final slot naming:
- sectionCardActions
- sectionCardFooter

## app-page-skeleton

The page plan (ADR-050). Every page lives inside it; nothing else decides widths.

Does:
- four named slots: `[slot=identidad]` (top strip, full width: who/what you are looking at and the page actions), `[slot=rail]` (left, folds as a unit, remembered), default content (`principal`, capped by the reading measure), `[slot=contextual]` (right, opens or folds by the available width on first render, remembered once the user chooses)
- `contextualTitle` names the contextual slot and switches it on; `contextualForcedOpen` opens it while a flow lives there
- `storageKey` identifies the page kind for the remembered states

Does not:
- style what goes inside a slot
- let a page override the measures (`--page-measure`, `--page-contextual`, `--page-rail` are the skeleton's)

## b4-icon

Use it for any icon of the B4RRHH set (`public/icons/`), never `<img>` or an inline `<svg>` copy.

Does:
- references a `<symbol>` of the sprite injected at bootstrap (`provideIconSprite`)
- inherits `currentColor`, so hover/active states colour it with no extra CSS
- `name` is the generated union of sprite names: an unknown icon does not compile
- `size` 16 | 20 | 24 (guide sizes), `aria-hidden` by default, `label` when it stands alone

Does not:
- carry a colour of its own
- replace the text label next to it (see `docs/identidad-visual.md`)

## Rule of Use

If behavior depends on catalog resolution, filtering rules, business keys, mutations, API contracts, or mode transitions, keep that behavior in the feature component, store, or gateway. Shared UI only carries structure and presentation.