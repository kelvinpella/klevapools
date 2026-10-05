# Naja

WhatsApp marketplace conversation over staged menus with 7-day resume.

## Language

**Stage**:
A named step in the WhatsApp menu flow that maps to one message.
_Avoid_: step, state, option

**Message**:
The text plus buttons rendered for a Stage.
_Avoid_: prompt, template

**Option**:
A button inside a Message whose payload moves to another Stage.
_Avoid_: button, response, choice

**Flow**:
A WhatsApp native form (DRAFT for testing, never published by this codebase) opened from a Stage to collect input. Flow submissions arrive as nfm_reply and are logged.
_Avoid_: form, modal
