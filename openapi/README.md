# Local OpenAPI snapshot

Source of truth is backend contract:

- ../b4rrhh_backend/openapi/personnel-administration-api.yaml

This snapshot is versioned: a clean clone builds from it without the backend checkout.
Do not edit the local YAML manually.

To update it, pull a new contract from a sibling backend checkout — and commit the
result:

- npm run api:pull

api:pull keeps two synchronized copies:

- openapi/personnel-administration-api.yaml
- src/app/core/api/generated/personnel-administration-api.yaml

Generate the frontend API client from the versioned snapshot (needs no backend;
runs automatically before build and start):

- npm run api:generate
