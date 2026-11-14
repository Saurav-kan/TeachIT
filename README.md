# TeachIT

A local startup prototype: learn by teaching a classroom of AI students.

## Answers and source checks

The classroom tracks the current question across analyses. New transcript text is assessed automatically, with the existing 20-second request spacing, even if “I'll answer” was never clicked. That button only signals intent; it cannot mark an answer correct. Partial, incorrect and unrelated responses retain the question. A correct answer turns the question and sticky alert green, shows the transcript evidence, and leaves the result visible. Further teaching can prompt a new question, while the previous answer remains in the session history and exported notes.

Fact checks compare up to three claims per analysis against numbered passages in uploaded .txt/.md files or pasted lesson material. Source buttons open the document with the cited lines highlighted. The server verifies that quotes occur in the cited line range and that claims/evidence occur in the transcript. It downgrades missing or fabricated source references to “Needs verification.” These checks validate quotation locations, not semantic entailment or the truth of the source itself: assessment remains AI-based. There is no web-search fact checker. With no relevant source, the app suggests a topic to review and asks for supporting material instead of presenting a verified correction. Notes retain the teacher's own statements. Test mode without hints withholds source-check details until Finish/review, including from pre-review exports. Demo mode does not assess answer correctness or run source checks.

## Run

Requires Node.js 24+ (tested with Node 24). No dependencies to install.

```powershell
cd C:\Users\kande\Desktop\Pitch2ProtoProjects\TeachIT
node --use-system-ca --env-file-if-exists=.env server.mjs
```

Open http://127.0.0.1:3210 in Chrome or Edge for camera and speech recognition support.

You can also double-click `Start-TeachIT.cmd`. npm scripts are provided, but the direct Node command works even when npm is unavailable.

## Demo walkthrough

1. Start teaching. Select **Try a sample explanation** for a reliable photosynthesis walkthrough.
2. Draw on the optional whiteboard. Undo, erase, choose an ink color, or hide it entirely.
3. The student question and note sheet update. Without an API key these are clearly labeled scripted demo behaviors, not real AI understanding or grading.
4. **AI view** previews the experimental recency image: purple strokes are newer than 15 seconds, dark strokes are older. Original ink colors remain unchanged on the teacher's board.
5. Add your own topic and .txt/.md source materials through **New lesson**. PDF/DOCX extraction is not yet included.
6. Try Test IT with a configurable timer and hints policy. Finish to review feedback and export notes. No gaze tracking or cheating detection is implemented.

## Live AI

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` locally; never put it in frontend code or commit it. Restart the server after changes. The server calls OpenRouter's Chat Completions API with structured text and image content parts.

The default model is `meta/muse-spark-1.3-contributor` at `https://openrouter.ai/api/v1/chat/completions`. OpenRouter lists image input support and $0.10/M input, $0.20/M output pricing. Contributor allows training on request data, which is accepted for this prototype. A funded OpenRouter account with model access is required. Vision is enabled by default; set `OPENROUTER_VISION=false` for text-only mode. Camera frames are never sent.

`OPENROUTER_MODEL` and `OPENROUTER_BASE_URL` can override the defaults. The server requests JSON output and validates it before returning classroom content. No paid requests have been made or verified yet.

Official references (checked November 13, 2026):

- https://openrouter.ai/meta/muse-spark-1.3-contributor
- https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
- https://dev.meta.ai/docs/muse-spark

No credentials are bundled. The live network integration is implemented but has not been verified against a paid provider account.

## Whiteboard strategy

- Capture normalized vector strokes locally on pointer events. Preserve timestamped points, eraser strokes, undo, and clear operations.
- Never make a model request per pointer move or on a fixed five-second network poll.
- While teaching, schedule analysis after 2 seconds of idle input and at least 20 seconds since the last request. Skip unchanged content, in-progress strokes, and explanations shorter than 12 words. Manual questions also respect the live request cooldown.
- Bundle the transcript, up to 18,000 characters of source material, prior notes, last student question, and latest board event metadata in one call. The initial prototype bounds the transcript to its last 20,000 characters; longer-session retrieval and summarization remain future work.
- When vision is enabled, include the current board. Include the prior successful snapshot only when the board changed. An opt-in supplementary recency view adds a third image; it is off by default to save cost.
- Current/previous images preserve overall before/after structure. Event timestamps record intermediate stroke order locally; fine-grained semantic animation/gesture interpretation is not implemented. A future extension can select 2–3 meaningful intermediate frames from stroke replay when motion itself matters.
- Recency colors are a hypothesis to evaluate, not a guaranteed improvement. They can be confused with semantic colors; preserve the original image and label the overlay explicitly. Never rely on color alone for chronology.

Illustrative text-only Contributor cost: 2,000 input + 400 output tokens would cost $0.00028 at $0.10/$0.20 per million. At 30 requests this is $0.0084 of token usage, excluding subscription fees, images, speech services, reasoning tokens, and growing context. Real usage depends on the provider's billing.

## Privacy and limitations

Camera is a local preview, not a recording or assessment input. Browser speech recognition may send audio to the browser vendor's speech service. Explanations, notes, materials and enabled board images are sent to the selected model on live analysis. In-memory session data is lost on refresh; use Save notes before leaving. Notes are constrained to what the teacher has explained; provisional AI scores are practice feedback, not validated school grades. Test settings in this local prototype are teacher-controlled, not secure instructor/exam administration.

## Checks

```powershell
node --check server.mjs
node --check public/app.js
node --check public/board.js
node --test test/*.test.mjs
```

The loopback server blocks cross-origin API requests, limits payload sizes, rate-limits live model requests, and keeps API credentials server-side. There is no remote configured until a repository is provided.

## Design direction

Read [DESIGN.md](DESIGN.md) before UI changes. Cobalt Guava is the selected palette; Studio, Seminar and Notebook are layout alternatives for review. The mockup source is [design/cobalt-guava.html](design/cobalt-guava.html). These alternatives have not replaced the running classroom.


The latest visual exploration is [design/vivid-cobalt-guava.html](design/vivid-cobalt-guava.html): stronger saturation and larger color areas following the user's reference and correction. Read the feedback section in DESIGN.md before further styling.


## Current classroom styling

The running app now uses the vivid Cobalt Studio design in public/vivid.css, with a warm yellow question panel. Generated patterns and accents are in public/assets; the original prompts are in design/asset-prompts.json. Notes can collapse, and hiding the board opens a speaking workspace. Existing OpenRouter configuration and .env are preserved.


## Microphone controls

The teaching controls are above the lesson and stay pinned while scrolling. Start teaching requests microphone input; pause, finish and page exit release it. The icon shows a slashed microphone when muted and signal-driven bars when active. Green indicates detected input, amber a high digital level and red peaks near clipping. This is a digital amplitude guide, not a calibrated sound-pressure meter. The Web Audio analyser stays local and is never connected to speakers. Browser speech captions are a separate service; failures there are reported independently from the actual input state. In browsers without captions, the meter can remain live while the user types the explanation.

The meter was verified in a browser using a generated test signal, without capturing the user's device. Automated checks cover signal levels, permission denial, canceled requests, device disconnects, track/context cleanup and browser callback binding. Real device access still depends on browser permission and hardware.


## Transcription and classroom recovery

Speech-to-text and AI processing now have separate status lines beside the top controls. Interim speech is displayed immediately; the last partial phrase is preserved on interruption and marked for review. The browser speech service reconnects automatically after ordinary disconnects or transient failures, with a bounded retry policy for repeated errors and a visible retry control. The explanation field grows with content up to a scrollable limit.

Continuous speech no longer resets the analysis deadline. After enough finalized words, analysis is queued independently of further speech, with the existing 20-second request spacing. An AI failure stops automatic repeated requests until Retry analysis succeeds. Provider/network errors appear at the top instead of being mislabeled as bad lesson input.

On this Windows system, OpenRouter initially failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE. The startup scripts now use --use-system-ca, enabling the trusted system certificate store while keeping certificate verification on. No keys or certificate-validation bypasses are committed. A short real OpenRouter request returned a student question and four notes after this change. Use Start-TeachIT.cmd or the updated Node command above.


## Compact teaching workspace

Desktop uses a slim control strip above a viewport-sized board and reference panel. Notes, fact checks and the editable transcript have separate keyboard-accessible tabs. Notes scroll independently, with recent updates first; following pauses when scrolling back, and Latest resumes it. Updated notes receive a restrained highlight. Connection diagnostics are under Status and open automatically on a speech/AI error. The optional camera preview sits over the board. Small screens stack the workspace while keeping the notes panel bounded.
