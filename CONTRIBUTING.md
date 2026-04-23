# Contributing to datalathe-tui

Thanks for your interest in contributing! This is the Ink-based terminal UI (`@datalathe/tui`) for [Datalathe](https://datalathe.com).

## Getting set up

You need Node 18 or newer.

```bash
git clone https://github.com/<your-fork>/datalathe-tui.git
cd datalathe-tui
npm install
```

Run the full local check (what CI runs):

```bash
npm run lint     # typecheck (tsc --noEmit)
npm run build    # tsc
```

Run the TUI locally against a Datalathe engine:

```bash
npm run build && node dist/cli.js
```

The TUI connects to an engine at `http://127.0.0.1:3000` by default.

## Supported Node versions

Node 18, 20, and 22. CI runs against all three — please make sure your change works on all of them.

## Making a change

1. Fork the repo and create a branch off `main`.
2. Make your change.
3. Run `npm run lint && npm run build` locally and confirm it passes.
4. Manually smoke-test the affected screen in the TUI.
5. Open a PR against `DataLathe/datalathe-tui:main`. CI will run automatically.

### Style

- Match the surrounding code. Screens live under `src/screens/`, reusable components under `src/components/`, and hooks under `src/hooks/`.
- The TUI consumes `@datalathe/client` from npm. If a change requires a new client capability, land that in `datalathe-client-javascript` first, release it, then bump the pin here.
- Prefer small, focused PRs. If a change touches more than one screen or area, split it.

### Commit messages

Short imperative subject line (e.g. `Add tag filter to chip list screen`). Reference issues with `Fixes #123` in the body when applicable.

## Reporting bugs

Open an issue with:

- Which screen / command you were on
- What you did (keystrokes, input)
- What you expected to happen
- What actually happened (screenshot or copy of the terminal output is ideal)
- `@datalathe/tui` version, Node version (`node --version`), and terminal (iTerm2 / Terminal.app / Alacritty / etc.)

## Releases

Releases are cut by the maintainers and published to npm — contributors don't need to do anything release-related as part of a PR.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
