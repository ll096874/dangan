# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-file calculator web app built with vanilla HTML, CSS, and JavaScript. Dark-themed UI with basic arithmetic operations (add, subtract, multiply, divide), sign toggle, percentage, and keyboard support.

## Key Files

- `calculator.html` — Entire application (HTML structure, CSS styles, and JavaScript logic in one file)
- `CLAUDE.md` — This file

## Architecture

The app is self-contained in `calculator.html`:

- **State** — A `state` object tracks `current`, `previous`, `operator`, `shouldReset`, and `expression`
- **Display** — Two-part display showing the current expression and result
- **Event Handling** — Both click events (on `.buttons`) and keyboard events (`keydown`) route to the same action handlers
- **Operators** — Mapped via symbols object for display formatting (`add` → `+`, `subtract` → `−`, etc.)
- **Division by zero** — Returns `'Error'` string

## Development

Since this is a static HTML file, no build step is needed. Open `calculator.html` directly in a browser to run the app.
