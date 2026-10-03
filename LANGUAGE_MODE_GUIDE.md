# Language mode update

## What changed

The lesson generator now has one language setting shared by the complete lesson plan, DOCX template labels, PowerPoint content, and PowerPoint template labels.

- **Auto — match the lesson input** (default): Filipino/Tagalog-medium subject names and Filipino wording in the lesson title, MELC/competency, or classroom notes select Filipino. If no Filipino signal is found, the app uses English.
- **Filipino / Tagalog**: force Filipino output for any subject, including Mathematics or Science.
- **English**: force English output even when the subject is Filipino or the source text is Tagalog.

The form displays the current Auto decision before generation. The generated plan's selected language is retained when the teacher later generates slides.

## Notes

Language detection is heuristic in Auto mode. Use the explicit language choice when input is short, mixed-language, or the detected choice is not what you want. The generation prompts strongly request the selected language, but AI output is not formally proofread by a language classifier; proper names, curriculum codes, and official publication titles may remain in their source form.

## Deploy

Deploy the updated project to Vercel as usual. No new environment variables are required. The ZIP contains the source project and lockfile, but excludes installed dependencies and local build output; install dependencies from `package-lock.json` during deployment.

## Checks performed

- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- Language resolver regression cases — passed (Filipino input, English input, Tagalog subject, explicit overrides, VE, and GMRC).
- `npm run lint` still reports existing project lint issues outside this feature (including `any` types, React state-in-effect, and unescaped JSX text); the full lint backlog was not part of this language-mode change.
