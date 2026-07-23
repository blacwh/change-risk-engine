import type { RiskRule } from '@change-risk/rules';

export const PLUGIN_API_VERSION = 1 as const;

export type LanguageAdapterLimits = {
  maxEntries: number;
  maxFiles: number;
  maxFileBytes: number;
};

export type LanguageReference = {
  specifier: string;
  resolution: 'external' | 'internal' | 'unresolved';
  targetPath?: string;
};

export type LanguageModule = {
  path: string;
  imports: readonly LanguageReference[];
};

export type LanguageAdapterIssue = { kind: string; path?: string };

export type LanguageAdapterIndex = {
  repositoryRoot: string;
  modules: readonly LanguageModule[];
  issues: readonly LanguageAdapterIssue[];
};

export type LanguageAdapter = {
  id: string;
  canHandle(path: string): boolean;
  indexRepository(
    repositoryRoot: string,
    limits: LanguageAdapterLimits,
  ): Promise<LanguageAdapterIndex>;
};

export type PluginDefinition = {
  apiVersion: typeof PLUGIN_API_VERSION;
  id: string;
  rules?: readonly RiskRule[];
  languageAdapters?: readonly LanguageAdapter[];
};

export type PluginRegistryOptions = {
  builtInRules?: readonly RiskRule[];
  builtInLanguageAdapters?: readonly LanguageAdapter[];
  plugins?: readonly PluginDefinition[];
};

export type PluginRegistry = {
  rules: readonly RiskRule[];
  languageAdapters: readonly LanguageAdapter[];
  languageAdapter(id: string): LanguageAdapter | undefined;
};

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

function validId(id: string): boolean {
  return id.length <= 100 && ID_PATTERN.test(id);
}

function compareId(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function assertUniqueIds(
  values: readonly { id: string }[],
  label: string,
): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (!validId(value.id)) throw new Error(`${label} has an invalid id`);
    if (ids.has(value.id)) throw new Error(`${label} ids must be unique`);
    ids.add(value.id);
  }
}

function validateRule(rule: RiskRule): void {
  if (
    !validId(rule.id) ||
    !Number.isFinite(rule.defaultWeight) ||
    Math.abs(rule.defaultWeight) > 10_000 ||
    typeof rule.evaluate !== 'function'
  ) {
    throw new Error('Plugin rule is invalid');
  }
}

function validateLanguageAdapter(adapter: LanguageAdapter): void {
  if (
    !validId(adapter.id) ||
    typeof adapter.canHandle !== 'function' ||
    typeof adapter.indexRepository !== 'function'
  ) {
    throw new Error('Plugin language adapter is invalid');
  }
}

export function createPluginRegistry(
  options: PluginRegistryOptions = {},
): PluginRegistry {
  const plugins = [...(options.plugins ?? [])];
  if (plugins.length > 32) throw new Error('Plugin count limit exceeded');
  assertUniqueIds(plugins, 'Plugin');
  for (const plugin of plugins) {
    if (plugin.apiVersion !== PLUGIN_API_VERSION) {
      throw new Error(`Plugin ${plugin.id} uses an unsupported API version`);
    }
    if ((plugin.rules?.length ?? 0) > 100) {
      throw new Error(`Plugin ${plugin.id} rule count limit exceeded`);
    }
    if ((plugin.languageAdapters?.length ?? 0) > 16) {
      throw new Error(`Plugin ${plugin.id} adapter count limit exceeded`);
    }
  }
  plugins.sort(compareId);

  const rules = [
    ...(options.builtInRules ?? []),
    ...plugins.flatMap(({ rules }) => [...(rules ?? [])]),
  ];
  const languageAdapters = [
    ...(options.builtInLanguageAdapters ?? []),
    ...plugins.flatMap(({ languageAdapters: adapters }) => [
      ...(adapters ?? []),
    ]),
  ];
  if (rules.length > 1_000) throw new Error('Registered rule limit exceeded');
  if (languageAdapters.length > 100) {
    throw new Error('Registered language adapter limit exceeded');
  }
  for (const rule of rules) validateRule(rule);
  for (const adapter of languageAdapters) validateLanguageAdapter(adapter);
  assertUniqueIds(rules, 'Rule');
  assertUniqueIds(languageAdapters, 'Language adapter');
  const registeredRules = rules
    .map((rule) => Object.freeze({ ...rule }))
    .sort(compareId);
  const registeredLanguageAdapters = languageAdapters
    .map((adapter) => Object.freeze({ ...adapter }))
    .sort(compareId);
  const adapterById = new Map(
    registeredLanguageAdapters.map((adapter) => [adapter.id, adapter]),
  );

  return Object.freeze({
    rules: Object.freeze(registeredRules),
    languageAdapters: Object.freeze(registeredLanguageAdapters),
    languageAdapter: (id: string) => adapterById.get(id),
  });
}
