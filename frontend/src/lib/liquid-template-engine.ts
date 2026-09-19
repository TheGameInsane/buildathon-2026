/**
 * Resolves a template server-side (before any LLM call), so "template" tier
 * touches can still feel branch-aware without spending a model call.
 *
 * Intentionally narrow — merge tags plus one level of if/else — not a full Liquid
 * implementation:
 *   - merge tags:  {{ prospect.firstName }}
 *   - conditionals: {% if prospect.segment == "voice_ai_founder" %}...{% else %}...{% endif %}
 * No nesting, loops, or filters. That's all §1 needs.
 */

type TemplateContext = Record<string, unknown>

function resolvePath(context: TemplateContext, path: string): unknown {
  return path
    .trim()
    .split(".")
    .reduce<unknown>((value, key) => {
      if (value && typeof value === "object" && key in (value as Record<string, unknown>)) {
        return (value as Record<string, unknown>)[key]
      }
      return undefined
    }, context)
}

function stringify(value: unknown): string {
  return value === undefined || value === null ? "" : String(value)
}

const IF_BLOCK =
  /\{%\s*if\s+([\w.]+)\s*==\s*"([^"]*)"\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g
const MERGE_TAG = /\{\{\s*([\w.]+)\s*\}\}/g

export function renderTemplate(template: string, context: TemplateContext): string {
  const withConditionals = template.replace(
    IF_BLOCK,
    (_match, path: string, expected: string, ifBranch: string, elseBranch = "") =>
      stringify(resolvePath(context, path)) === expected ? ifBranch : elseBranch,
  )
  return withConditionals.replace(MERGE_TAG, (_match, path: string) => stringify(resolvePath(context, path)))
}
