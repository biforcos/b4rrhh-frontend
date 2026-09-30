# API clients layer

This folder contains the hand-written wrappers around generated OpenAPI services used by the
employee file (reads, catalogs, tax information). They predate the rule below and stay here.

Any other client goes in the `client/` folder of its feature, next to the gateway that uses
it (`client/ → gateway/ → store/ → ui/`), not here. `npm run lint:client-location` fails the
pipeline if a `*.client.ts` lives anywhere else (#122).
