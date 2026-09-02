/**
 * Predicate helper functions - Pure lookup functions for predicate metadata
 */

import { PREDICATE_METADATA, type PredicateMetadata, type PredicateName } from './metadata';

/**
 * Get metadata for a specific predicate by name
 */
export function getPredicateMetadata(name: string): PredicateMetadata | undefined {
  if (name in PREDICATE_METADATA) {
    return PREDICATE_METADATA[name as PredicateName];
  }
  return undefined;
}
