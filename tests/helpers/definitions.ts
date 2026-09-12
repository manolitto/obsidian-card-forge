import { load } from "js-yaml";
import { IGNORE_DIAGNOSTICS, type Diagnostics } from "../../src/definitions/diagnostics";
import {
  mergePropertyDefs,
  parsePropertyDefs,
  type PropertyDefsMap,
} from "../../src/definitions/property-defs";

/**
 * The definition layers are YAML in real life, so the tests write YAML. It
 * keeps a case readable as the thing an author would actually type, and it
 * exercises the shapes a hand-built object literal would quietly avoid — a bare
 * `key:` with no value, a `~`, a scalar where a list is expected.
 */

/** Stack `properties:` blocks, lowest layer first, into one resolved map. */
export function props(
  sources: readonly string[],
  diagnostics: Diagnostics = IGNORE_DIAGNOSTICS
): PropertyDefsMap {
  return sources.reduce<PropertyDefsMap>(
    (base, source) =>
      mergePropertyDefs(base, parsePropertyDefs(load(source), diagnostics)),
    {}
  );
}

/** Parse one YAML document, for the cases that want the raw shape. */
export function yaml(source: string): unknown {
  return load(source);
}
