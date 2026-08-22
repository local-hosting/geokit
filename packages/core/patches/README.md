# Patches

## `maplibre-gl+5.14.0.patch`

Defensive fix in MapLibre `SourceFeatureState.coalesceChanges`: treat `deletedStates[sourceLayer][feature] === undefined` like `null` so `Object.keys(undefined)` cannot throw during feature-state teardown or style churn. Applied via `patch-package` on `postinstall`. Drop when upstream merges an equivalent guard.
