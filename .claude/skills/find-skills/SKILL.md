---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities.
---

# find-skills

Helps users discover and install agent skills.

## Usage

When a user asks about finding a skill, installing one, or extending capabilities, respond with:

1. Search for available skills using `npx skills search <query>` or `gh skill search <query>`
2. Install a skill using `npx skills add <package>` or `gh skill install <owner/repo> <path>`
3. Skills can also be browsed at https://skills.sh

## Common Commands

- `npx skills search <keyword>` — Search for skills by keyword
- `npx skills add <name>` — Install a skill
- `npx skills list` — List installed skills
- `npx skills remove <name>` — Uninstall a skill
- `npx skills update` — Update all skills
- `npx skills check` — Check for updates

## Installation Paths

- **Project scope**: `.claude/skills/<skill-name>/` — current project only
- **User scope**: `~/.claude/skills/<skill-name>/` — all projects

## Official Sources

- https://skills.sh — Official skill directory
- https://github.com/vercel-labs/skills — Open source skill repository
- https://github.com/anthropics/skills — Anthropic official skills
