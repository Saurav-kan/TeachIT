# TeachIT design brief

Research and design decisions recorded November 13, 2026. Read this brief before redesigning TeachIT. It preserves the project's decisions across future work; it does not imply automatic memory outside the repository.

## Product and selected direction

TeachIT helps people learn by teaching artificial students. The teacher explains aloud, optionally draws, receives targeted questions, and sees a student-style glossary of ideas already explained. Learn IT is supportive and self-paced. Test IT is timed, with instructor-controlled hints in the intended product. The current prototype is not a secure exam system.

The user chose **Cobalt Guava**: vibrant, comforting, age-inclusive, and mature. Avoid childish characters, gamified rewards, excessive copy, and a corporate analytics-dashboard feel.

### User correction: preserve the energy

The first mockups were rejected as too mellow and drained of energy. The user supplied a Coco Coders dashboard as a reference for effective color use: a large saturated dark sidebar, a bright logo accent, pale colored grouping surfaces, crisp white content and dark outlines. Treat this as evidence of the user's preference for confident color fields and stronger contrast, not permission to copy the logo or student details.

Do not equate mature design with desaturation, beige backgrounds or tiny accent areas. Use saturated navigation and active-student surfaces while keeping the drawing area clear. Short copy, clean geometry and disciplined hierarchy supply maturity. The previous 70/20/10 color suggestion is not a constraint.

The new **Cobalt studio**, **Guava seminar** and **Electric notebook** alternatives propose richer cobalt `#244FE5`, vivid guava `#F65383`, warm yellow `#FFD168`, deep ink `#14244B`, crisp white `#FFFFFF` and cool supporting backgrounds. These specific revised tokens are proposals pending review; the preference for stronger vibrancy is explicit. The original palette below remains the historical starting point.

Palette:

- Ink/navigation: `#21324A`.
- Cobalt/actions: `#315DC6`.
- Guava/student interaction: `#D989A3`.
- Sand/context and warmth: `#EBCB9F`.
- Warm background: `#F6F2EB`.
- Additional light board surface: `#FFFDFA`.
- Supporting readable text: `#586479`.

Use cobalt for navigation, the current action, selected tools and the active mode. Give guava enough area to make the active student/question visually expressive. Use dark ink on guava and yellow. Keep drawing surfaces white and quiet; concentrate the strongest color in the surrounding interface. These are design choices, not universal psychological meanings.

## Research translated into product decisions

### Attention follows hierarchy

Scale, placement, contrast and grouping should tell people what matters first. The current teaching surface or active student question should dominate. Session time and microphone state remain visible but quiet. Remove the oversized marketing headline and sidebar quote from the active classroom. Keep one clear primary action per state, with finishing visually secondary. Source: [NN/g, visual design principles](https://www.nngroup.com/articles/principles-visual-design/).

### Reveal tools when needed

Keep common actions visible; reveal secondary settings on request. Whiteboard is optional. Preserve notes behind a labeled control when collapsed, and never hide the only route to the current question. Uploads, model configuration and grading settings belong before class or in settings rather than the speaking workspace. Keep mode and hint policy obvious before beginning. Source: [NN/g, progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

### Reduce competing mental tasks

Mayer and Fiorella summarize evidence for removing irrelevant material, signaling structure, and placing related words and graphics together. For TeachIT, this suggests positioning the current question near the explanation, keeping diagram labels adjacent to marks, and avoiding simultaneous prominent transcript, glossary, score and chat feeds. This is an application of multimedia-learning findings, not proof of the best layout for a teacher using TeachIT. Retain captions/transcript as an accessibility option. Source: [Mayer & Fiorella, Cambridge Handbook of Multimedia Learning](https://doi.org/10.1017/CBO9781139547369.015).

### Make comfort compatible with readability

WCAG AA calls for at least 4.5:1 text contrast for normal text, with 3:1 allowed for qualifying large text. Use dark ink on warm surfaces and a verified light-on-cobalt pairing. Soft color does not justify faint labels. Actual runtime states and non-text component contrast need separate verification. Source: [W3C, Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### Make controls easy to operate

WCAG 2.2 AA target-size minimum is 24 by 24 CSS pixels, with specified exceptions. Aim for 44px for touch controls as a product design target, rather than claiming 44px is the AA minimum. Use real buttons, visible keyboard focus, concise labels, and text alternatives for drawings. Never communicate student attention, mode, errors or microphone state through color alone. Sources: [W3C, target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [W3C, focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

## Layout alternatives to evaluate

- **Studio:** whiteboard leads; question sits directly below it; notes occupy a narrow right pane; compact students stay visible. Strong candidate for diagram-heavy teaching. Risk: unnecessary board space for entirely verbal subjects. Provide a genuine board-off state.
- **Seminar:** the audience and current question lead; whiteboard opens only when requested; notes remain nearby. Strong candidate for teaching by conversation. Risk: student visuals can become decoration; keep them quiet while the question is prominent.
- **Notebook:** explanation and captured notes share a desk-like layout, with the student question in a side conversation area. Strong candidate for verbal topics and organizing concepts. Risk: reading notes can compete with explaining; allow notes to collapse and do not add untaught answers.

These alternatives are hypotheses for comparison, not research-validated rankings. Start with Studio for the pitch if a diagram is central, and demonstrate that it can become a speaking workspace when the board closes.

## Interaction and content rules

- Keep wording short and concrete. Use space, alignment and typography before adding borders or more cards.
- Show one student question at a time. Queue another until the teacher finishes or chooses to move on.
- Capture notes quietly. Avoid moving text under the teacher's eyes while they read; preserve scroll position when implemented.
- Keep camera self-view optional. Do not equate camera activity or gaze with comprehension or cheating.
- Keep Learn IT and Test IT controls consistent; change timing, hints and policy rather than making Test IT feel punitive.
- Restrict provisional grading and detailed feedback to review rather than showing a changing score while the person speaks.
- Keep diagram strokes distinct from interface-state colors. AI-only recency overlays never replace the teacher's original drawing.
- On narrow screens put teaching and the active question first; move notes below or into a labeled drawer. Reflow instead of scaling a desktop down.
- Keep a simple spacing scale, consistent radii, and readable body typography. Limit gratuitous animation and respect reduced motion.

## Checks completed for these mockups

JavaScript syntax check passed. All three layout alternatives were inspected in a browser. Studio's board-off state was exercised. At 736px and 320px viewport widths, Studio's body content did not exceed its available width. Diagram flow changes to a vertical arrangement at the narrowest breakpoint so the arrows retain their direction. These checks are limited design QA, not a full accessibility audit.

Calculated text contrast ratios for the original palette (before optional color tweaks): ink/background 11.62:1; light paper/cobalt 5.89:1; ink/guava 4.97:1; ink/sand 8.38:1; supporting text/background 5.36:1; supporting text/light paper 5.89:1. Other tints, component states, adjustable colors, focus contrast and non-text indicators still need an implementation audit.

## Checks before choosing a layout

Ask a few representative users to start a lesson, teach without a board, open the board, answer a student, find a prior concept, pause and finish. Observe task success, wrong turns and hesitation; ask whether feedback feels supportive. Compare alternatives with the same topic and content. Include keyboard use, zoom, narrow screens and users with different visual/motor needs. No usability study or full accessibility audit has been performed yet.

## Implemented visual milestone

The vivid Cobalt Studio direction is now implemented. The user approved its stronger saturation and requested the app be updated. The question section uses warm yellow (#FFD168) in place of the disputed large pink fill. Cobalt navigation, lavender notes, crisp white drawing space, compact student cards and optional notes/board panels are the current design. Three generated raster assets enhance the lower sidebar, dialog borders and camera-off corner. No decorative image is drawn into the whiteboard or sent to the classroom model. Generation prompts are recorded in design/asset-prompts.json.

