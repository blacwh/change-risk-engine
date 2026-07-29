export function integerOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = options[name] ?? defaultValue;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

export function numberOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = options[name] ?? defaultValue;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${name} must be a number from ${minimum} to ${maximum}`);
  }
  return value;
}

export function globMatches(pattern: string, path: string): boolean {
  if (pattern.length === 0 || pattern.length > 1_000) {
    throw new Error('Glob patterns must contain from 1 to 1000 characters');
  }
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        expression += '.*';
        index += 1;
      } else expression += '[^/]*';
    } else if (character === '?') expression += '[^/]';
    else expression += character?.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&') ?? '';
  }
  return new RegExp(`${expression}$`, 'u').test(path);
}
