# Connected health data

## Model

- `integrations` — catalog (slug, category, description, `status`, `scopes` with descriptions and data categories).
- `integration_connections` — a user's connection (active/revoked).
- `integration_permissions` — per-scope grants, individually revocable.
- `integration_credentials` — OAuth tokens; **service role only**, must be encrypted by the application (or Supabase Vault) before storage.
- `health_data.connection_id` — imported records are linked so they can be deleted on disconnect.

Functions: `connect_integration(slug, scopes)` (requires `status = 'available'` and `health_data_storage` consent), `revoke_integration_scope`, `disconnect_integration(id, delete_data)`. All write audit entries, visible to the user as access history.

## Status

Every catalog entry is **`coming_soon`**. No integration is implemented and none may be shown as connected.

| Integration | Requirement to build |
|---|---|
| Apple Health | Native iOS app with HealthKit entitlement; data synced from device |
| Health Connect | Native Android app |
| Wearables | Vendor OAuth APIs (per vendor agreement) |
| SMART on FHIR | Registration with each health system / EHR vendor |
| Lab results, pharmacy | Partner agreements |
| External scheduling | Per-vendor API agreements |

## Definition of available

An integration may be switched to `available` only when: OAuth/consent flow implemented; tokens encrypted and refreshable; import maps to `health_data` with `source` and `connection_id`; revoke/disconnect/delete tested end-to-end; data minimization reviewed (only listed scopes requested); privacy notice updated; security review done.
