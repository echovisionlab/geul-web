// Keep diagnostic syntax intact. Only redact credentials, email addresses and
// values the caller identifies as private; never serialize error objects.
const knownPrivateValues = new WeakMap<Error, readonly string[]>();

function privateStrings(privateValues: readonly unknown[]): Set<string> {
  const strings = new Set<string>();
  const pending = [...privateValues];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string' && value) {
      strings.add(value);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      strings.add(String(value));
    } else if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value);
      for (const item of Object.values(value)) {
        pending.push(item);
      }
    }
  }
  return strings;
}

function redact(message: string, privateValues: readonly (string | undefined)[]): string {
  // JSON parser diagnostics can quote a body excerpt even after an RPC has
  // wrapped the SyntaxError as an ordinary Error or string.
  let result = message.replace(/(["']).*\1(?=(?:\.\.\.)? is not valid JSON)/gs, '"[redacted-body]"');
  for (const value of privateValues
    // Short values ("15", "ko") would erase unrelated parts of a message.
    .filter((value): value is string => typeof value === 'string' && value.length >= 4)
    .sort((a, b) => b.length - a.length)) {
    const variants = new Set([value, value.trim(), JSON.stringify(value).slice(1, -1)]);
    try {
      variants.add(encodeURIComponent(value));
    } catch {
      // Lone surrogates cannot occur in a valid encoded URL. Still redact the
      // literal and JSON-escaped forms without breaking the failure path.
    }
    for (const encoded of variants) {
      if (encoded) {
        result = result.split(encoded).join('[redacted]');
      }
    }
  }
  return result
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s<>"']+/gi, (url) =>
      url.replace(/^(\w[\w+.-]*:\/\/)[^/?#\s]*@/, '$1[redacted]@').replace(/\?[^#]*/, '?[redacted]'),
    )
    .replace(/(^|[\s"'(])(\/[^\s"'<>?]*)\?[^\s"'<>]*/g, '$1$2?[redacted]')
    .replace(/[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}.-]+/gu, '[redacted-email]')
    .replace(/\b(Bearer|Basic)\s+[^\s,;"'}]+/gi, '$1 [redacted]')
    .replace(
      /\b((?:authorization|proxy-authorization)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:Bearer|Basic)\s+[^\s,;"'}]+|[^\s,;\]}]+)/gi,
      '$1[redacted]',
    )
    .replace(
      /\b((?:cookie|set-cookie)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,]+)/gi,
      '$1[redacted]',
    )
    .replace(
      /\b((?:password|passwd|secret(?:[_-]?[a-z]+)*|(?:access|refresh|id)[_-]?token|token|access[_-]?key(?:[_-]?id)?|credential(?:s)?|api[_-]?key)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;\]}]+)/gi,
      '$1[redacted]',
    )
    .replace(/\beyJ[\w-]+\.[\w-]+(?:\.[\w-]+)?\b/g, '[redacted-token]')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 2048);
}

export function failureCause(error: unknown, privateValues: readonly unknown[] = []): string {
  // A caller and Next's error hook may log the same rethrown error. Retain the
  // caller's explicit redactions without mutating the error or its cause chain.
  const chain = new Set<Error>();
  let candidate = error;
  // Explicit private payloads (for example form answers) can contain nested
  // arrays/records. Collect their values without serializing the error.
  const values = privateStrings(privateValues);
  while (candidate instanceof Error && !chain.has(candidate) && chain.size < 8) {
    chain.add(candidate);
    for (const value of knownPrivateValues.get(candidate) ?? []) {
      values.add(value);
    }
    candidate = candidate.cause;
  }
  const redactions = [...values];
  if (redactions.length > 0) {
    for (const cause of chain) {
      knownPrivateValues.set(cause, redactions);
    }
  }
  const causes: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && current !== null && !seen.has(current) && causes.length < 8) {
    seen.add(current);
    if (current instanceof Error) {
      causes.push(redact(current.message, redactions));
      current = current.cause;
    } else {
      // Arbitrary objects can contain request/response bodies or credentials.
      causes.push(typeof current === 'string' ? redact(current, redactions) : '[non-Error rejection]');
      break;
    }
  }
  return causes.join(' <- ');
}
