# CSS architecture

Last verified against commit HEAD.

## Where does X go?
- New color → tokens/tokens.css (and themes.ts for runtime values).
- New spacing → Tailwind scale or tokens.
- New component style → components/<family>.css.
- New animation → animations/animations.css.
- New theme → themes/<name>.css overriding tokens only.

## Structure
src/renderer/styles/index.css imports tokens, base, animations. Component styles use Tailwind utilities primarily.
