# Tailwind Conventions

## Core Rules

- Prefer semantic theme tokens from `app/globals.css` over raw color literals.
- Keep class names in markup unless reuse or variants justify extraction.
- Use `cn(...)` for composed class strings and conflict-safe merges.
- Use `cva(...)` when a component has repeated visual variants.
- Keep UI behavior stable when refactoring styles.

## When Arbitrary Values Are Allowed

- Use arbitrary values only when Tailwind utilities and theme tokens cannot express the value.
- Prefer extracting repeated arbitrary values into `@theme` tokens.
- Keep one-off arbitrary values local to the component where they are needed.

## When To Extract Variants

- Extract to `cva` when a style block appears in 2+ places or has 2+ variant dimensions.
- Keep variant APIs narrow and semantic (for example `tone`, `shape`, `size`).
- Avoid variant props for one-off style changes; pass `className` instead.

## Dark Mode and State Patterns

- Use standard Tailwind variant order (`hover:`, `focus-visible:`, `disabled:`, `dark:`) and let Prettier sort classes.
- Define paired light/dark tokens once and reuse them in component variants.
- Keep dark-mode switching centralized through the `.dark` class on `<html>`.
