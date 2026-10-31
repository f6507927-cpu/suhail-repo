// D-125: unrounded decisions and lossless numeric payloads; D-89 replay retained.
export const ENGINE_VERSION = "engine-1.0.2";
export const SUPPORTED_ENGINE_VERSIONS = ["engine-1.0.1", ENGINE_VERSION] as const;
// D-06/D-124: annual prohibited-income mapping; no methodology thresholds seeded.
export const CALCULATION_VERSION = "calc-2026.10.6";
// Historical calculation provenance remains executable under its engine version.
export const SUPPORTED_CALCULATION_VERSIONS = ["calc-2026.10.1", "calc-2026.10.2", "calc-2026.10.3", "calc-2026.10.4", "calc-2026.10.5", CALCULATION_VERSION] as const;
