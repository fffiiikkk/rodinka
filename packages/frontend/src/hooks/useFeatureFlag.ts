import { useFlags } from './useAuth.js';
import type { FeatureFlagKey } from '@rodinkal/shared';

/** Returns true if the given feature flag is enabled (defaults to true if not yet loaded). */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const flags = useFlags();
  return flags[key] !== false;
}
