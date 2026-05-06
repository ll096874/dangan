---
name: skill-creator
description: Guide for creating effective skills for Claude Code. This skill should be used when users want to create a new skill or update an existing skill to extend Claude's capabilities with specialized knowledge, workflows, or tool integrations.
---

# skill-creator

A skill is a modular, self-contained package that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.

## What Skills Provide

- **Specialized workflows** — Multi-step processes for specific domains
- **Tool integrations** — Wrappers around external tools and APIs
- **Domain expertise** — Deep knowledge of specific frameworks or domains
- **Bundled resources** — Reference files, schemas, templates

## Anatomy of a Skill

```
claude-skill-<name>/
├── SKILL.md              # Required: Skill definition
├── scripts/              # Optional: Helper scripts
│   └── <name>           # Executable scripts
├── references/           # Optional: Reference docs
│   └── *.md             # Additional context files
└── assets/              # Optional: Static resources
```

## SKILL.md Format

```yaml
---
name: <skill-name>
description: |
  <2-3 sentence description of what this skill does and when it should trigger.
  The first sentence is loaded as a trigger phrase.>
---

# <Skill Name>

<Full instructions for the agent. Keep under 5000 words.>
```

## Design Principles

1. **Progressive disclosure** — Three levels:
   - **Level 1**: Metadata (~100 words, always in context as trigger)
   - **Level 2**: SKILL.md body (loaded when skill triggers, <5000 words)
   - **Level 3**: Bundled references (loaded on demand)

2. **Single responsibility** — Each skill does one thing well
3. **Self-contained** — Include all necessary instructions and context

## Best Practices

- Start with a clear, specific `description` that helps Claude decide when to use it
- Use YAML frontmatter for metadata (name, description are required)
- Write instructions in a focused, actionable style
- Test the skill by triggering it in conversation
- Keep `description` triggers precise to avoid false positives
