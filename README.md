# TeachIT

A local startup prototype: learn by teaching a classroom of AI students.

## Run

Requires Node.js 22+ (tested with Node 24). No dependencies to install.

```powershell
cd C:\Users\kande\Desktop\Pitch2ProtoProjects\TeachIT
node --env-file-if-exists=.env server.mjs
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

Copy `.env.example` to `.env` and supply a provider key locally; never put it in frontend code or commit it. Restart the server after changes. The server uses the Responses API and supports a configurable OpenAI-compatible base URL and model ID.

The example configuration selects the requested OpenCode Go `muse-spark-1.3-contributor` model and enables vision. Meta documents image support for this model. A key and model access are required; the OpenCode route still needs a real-account integration check. Set `OPENCODE_VISION=false` for text-only mode if the chosen route rejects image inputs. Camera frames are never sent. For pay-as-you-go access instead, use `muse-spark-1.3` and base URL `https://opencode.ai/inference/openai/v1`.

OpenCode Go documents `muse-spark-1.3-contributor` at `https://opencode.ai/inference/go/openai/v1/responses`. Its listed token rates are $0.10/M input and $0.20/M output, counted against a paid Go allowance. Contributor allows training on request data, which is accepted for this prototype. Go is documented as intended for coding-agent traffic; classroom app compatibility/access needs verification rather than assuming the subscription is a general-purpose inference license. For an authorized endpoint, set `OPENCODE_MODEL` and `OPENCODE_BASE_URL` accordingly. The app identifies itself honestly as TeachIT.

Official references (checked November 13, 2026):

- https://dev.opencode.ai/docs/console/go/
- https://dev.opencode.ai/docs/console/models/
- https://dev.opencode.ai/docs/console/api/inference/
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
node --test test/session.test.mjs
```

The loopback server blocks cross-origin API requests, limits payload sizes, rate-limits live model requests, and keeps API credentials server-side. There is no remote configured until a repository is provided.
