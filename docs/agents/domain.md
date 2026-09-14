# Domain Documents

This repo uses **single-context** domain documentation.

## Where to Read

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** for Architecture Decision Records (ADRs)

## What to Look For

When reviewing domain docs, look for:

1. **Domain boundaries** - what systems, services, or features exist
2. **Core responsibilities** - what each part is responsible for
3. **Data models** - key entities and their relationships
4. **API contracts** - interfaces, schemas, and endpoints
5. **Technical constraints** - APIs, libraries, or patterns to follow
6. **Known issues** - problems or debts already identified

## How to Contribute ADRs

New ADRs should be added to `docs/adr/` with:
- A clear title
- The problem being solved
- The decision made
- The context and rationale
- Pros and cons of alternatives

## PRD Integration

Domain docs inform the `to-spec` and `to-prd` skills. When working on a new feature:
1. Review `CONTEXT.md` to understand existing domain boundaries
2. Review relevant ADRs for architectural context
3. Use this information to inform your specification
