import type { BundlerConfiguration } from '@remotion/bundler'

type LoaderEntry = { loader?: string; options?: Record<string, unknown> }

/**
 * Remotion's esbuild-loader reads tsconfig through `typescript.sys`, which
 * TypeScript 7 no longer exposes, so JSX silently fell back to the classic
 * `React.createElement` and broke any JSX evaluated at module scope.
 */
export const webpackOverride = <C extends BundlerConfiguration>(config: C): C => {
  const rules = (config.module?.rules ?? []) as { use?: unknown }[]
  return {
    ...config,
    module: {
      ...config.module,
      rules: rules.map(rule =>
        Array.isArray(rule?.use)
          ? {
              ...rule,
              use: rule.use.map((entry: LoaderEntry) =>
                entry?.loader?.includes('esbuild-loader') ? { ...entry, options: { ...entry.options, jsx: 'automatic' } } : entry,
              ),
            }
          : rule,
      ),
    },
  }
}
