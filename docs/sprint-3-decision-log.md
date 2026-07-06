# Sprint 3 Decision Log — Designing an AI co-pilot for pen-and-paper classrooms

> Narrative notes on the thinking, trade-offs, and engineering choices behind PersonaLearn's Sprint 3 replan. Written to be reused as source material for a LinkedIn post — feel free to lift sections wholesale.

## TL;DR

We shipped a Sprint 3 build that technically "worked" but missed the point. Instead of patching it, we stopped, deleted it, and rebuilt the requirements from the product vision down. The biggest lesson wasn't technical — it was that **an over-specified plan can be just as damaging as no plan**, because it locks you into complexity before you've understood the problem. The rebuild replaced eight competing features with three simple surfaces and one idea: an agent that does the work and always asks before it commits.

---

## 1. The context

PersonaLearn is an AI co-pilot for Kenyan CBC (Competency-Based Curriculum) educators. The mission: make the teaching lifecycle **efficient and inclusive** by weaving AI (retrieval-augmented generation + agents) into the everyday tools teachers use — planning, resources, and assessment.

One constraint shapes everything: **Kenyan schools are pen-and-paper**. Students hand-write answers; teachers grade physical scripts by the hundred. Any "AI grading" feature that assumes typed input is solving the wrong problem.

## 2. What went wrong the first time

The original Sprint 3 tried to ship the entire v1.0 in one go — lesson generation, a resource library, multimodal feedback, competency dashboards, PDF exports, a PWA, and a production launch — all bundled onto a single branch, none of it merged, with the README already declaring victory.

Two root causes:

- **Process:** everything on one branch, no incremental review, "done" declared before anything integrated. When the whole sprint is one blob, you can't tell what's finished and what's theater.
- **Thin specs breeding complexity:** the requirements were a page of bullet points, so every ambiguity got resolved *by the implementation* — and always toward more surface area. Eight features that each half-existed and fought each other for the teacher's attention.

The counter-intuitive part: this happened *despite* having a detailed plan. The plan optimized the wrong thing. It specified **what to build** in exhaustive detail without pressure-testing **whether that shape was the simplest thing that could work**.

## 3. The pivot: from feature list to product shape

The turning point was a deliberately blunt question from the product owner: *"We have the big picture right, but the implementation is complex. Can we keep this simple?"*

That reframed the exercise. Instead of asking "how do we build these eight features well," we asked "what is the smallest set of surfaces a teacher actually needs?" The answer collapsed to **three**:

1. **AI Hub** — a normal chat experience (main thread + conversation history sidebar), class-scoped, where a single assistant can *query, generate, and act*.
2. **Class page** — one plain resources section per class (upload anything + AI-generated content in the same list) alongside the roster.
3. **Bulk evaluation** — the pen-and-paper grading workflow, start to sign-off.

Everything from the old plan either folded into one of these or was cut. A standalone "generate notes" page became "ask the agent to generate anything." A global resource library became "resources live on their class." A single-photo feedback card became "bulk evaluation."

**Lesson:** the number of surfaces in your product is a proxy for how well you understand it. When the surface count drops and coverage stays the same, you've found real simplicity — not lost capability.

## 4. Key design decisions (and the reasoning)

### 4.1 Agents over pages

The old design multiplied pages: one to generate, one to save, one to export, buttons everywhere to pick "what type is this." The insight: a teacher doesn't want a UI for every verb. They want to *ask*.

So the AI Hub centers on **one class assistant agent** with a small tool belt — search class resources (RAG), generate a learning resource, save it, read the roster. The teacher talks naturally ("make a Term 1 fractions assignment"); the agent picks the tools. No page per feature.

We deliberately chose **one assistant with tools** over a multi-agent orchestration. Multi-agent is fashionable, but for MVP it adds opacity and failure modes teachers can't reason about. One agent, clear tools, is simpler to build *and* to trust.

### 4.2 Human-in-the-loop by default: the agent always asks before it writes

The single most important trust decision: **the agent never writes silently.** It generates drafts freely, but saving a resource, finalizing marks, or deleting anything requires explicit confirmation in the chat ("Save this as an assignment to Grade 7 Math?").

This turns "AI automation" from something teachers fear into something they direct. Autonomy where it's safe (reading, drafting), confirmation where it counts (writing, finalizing). It's the difference between a co-pilot and an autopilot — and in a classroom, you want a co-pilot.

### 4.3 The evaluation problem: two problems wearing one coat

Bulk-grading scanned scripts looks like one problem but is two:

- **Identity** — whose script is this?
- **Ordering** — what order do this student's pages go in, and where does one script end and the next begin?

These need *different signals*, and conflating them is where naive designs break — but the *best* answer turned out to hinge on one deceptively simple change.

Our first instinct was to solve **ordering** with question numbers (a page whose numbers reset toward 1 marks a new script) and **identity** by reading a name off page 1. Workable, but the segmentation-by-reset logic was fragile: interleaved stacks, shuffled pages, and near-identical patterns across students all threatened it.

Then the product owner reframed it: *make the students write their admission number on **every** page.* One trivial classroom habit collapses the hard part. Now the admission number is the **primary key** for the entire flow:

- **Grouping is trivial and order-proof.** Don't segment by physical stack order at all — group every page by the admission number printed on it. A shuffled 30-student stack self-sorts. If one student's page is buried in another's script, the ID reconciles it back automatically. Stack order stops mattering.
- **Identity is the same key.** The number *is* the student, validated against the class roster allowlist — stronger than names (structured, boxed) and than filenames (nobody names 30 phone photos consistently).

Question numbers don't disappear — they're **demoted to a secondary signal**: order pages *within* a student and tell the agent which question it's grading (which it must read anyway). Identity and grouping ride on one variable; ordering rides on a signal we get for free.

**The reading tech matters too.** We'd tried this before: traditional **OCR failed on handwritten scripts**, but a **multimodal LLM (Grok) read the same handwriting reliably**. So every handwriting read — admission numbers, question numbers, answers — goes through the vision model, not an OCR engine. The graceful-degradation path stays: a missing or unreadable ID drops to amber, the agent guesses, and the teacher confirms against the image.

**Lesson:** the sharpest simplifications often come from changing the *input*, not the algorithm. A one-line ask of students ("put your admission number on every page") dissolved a whole class of segmentation edge cases that no amount of clever heuristics would have fully tamed.

### 4.4 Granularity enables control: per-question evaluation

A teacher asked, "what if I want just one question re-evaluated?" That question forced a data-model decision: store evaluations **per question**, not as one blob per script.

With per-question records, a single question becomes independently addressable. The teacher can either **edit it manually** (fastest when they know the mark) or hit **re-evaluate** with an optional instruction ("valid alternative method, award method marks"). The agent re-scores *only that question* — using the page image, the marking scheme, and the hint — while every other reviewed answer stays frozen. The total recomputes automatically.

**Lesson:** the granularity at which you store data determines the granularity at which users can act. Choosing "per question" up front is what makes the elegant review UX possible later.

### 4.5 Marking schemes: reuse, don't reinvent

Fair grading needs a rubric. Rather than build a bespoke rubric editor, we realized a **marking scheme is just another resource** the agent can generate and the teacher can approve — same generate → confirm → save path as any other content. It gets a `resource_type: marking_scheme` and nothing else is special.

And when a teacher has no scheme? **Graceful degradation over hard blocking.** They're informed ("the AI will use its own judgment, which is less reliable"), can proceed, and every resulting mark is flagged amber as an *AI estimate* so the review queue nudges closer scrutiny. Inclusive by default — a teacher without a prepared scheme still gets value — without pretending the output is authoritative.

**Lesson:** before building a new subsystem, check whether an existing primitive already covers it. A rubric was just a resource wearing a different hat.

### 4.6 Trust through flags, not perfection

Vision models won't read messy handwriting perfectly. We designed for that instead of against it. Every uncertain decision — a low-confidence student match, a possible missing page, a mark graded without a scheme — surfaces as an **amber flag** in the review queue. Green means the AI is confident; amber means "check me." The teacher fixes the amber cases and signs off. Model errors degrade to a few manual corrections, never to wrong marks silently saved.

**Lesson:** for AI in high-stakes workflows, the review experience *is* the product. Design the failure path first; the happy path takes care of itself.

## 5. Process changes we're enforcing

Getting burned by the bundled branch produced concrete rules for the rebuild:

- **Spec before branch.** No feature branch opens until its acceptance criteria are written as Given/When/Then and signed off.
- **One ticket → one branch → one PR.** Reviewable increments, merged in order.
- **Tests ship with the feature**, in the same PR. No "we'll add tests later."
- **Review-and-approve gate between every task.** The build proceeds one unit at a time, with a human checkpoint before the next.
- **"Done" means merged and QA-passed** — never "the code exists somewhere."

## 6. The re-sliced plan

Four focused sprints replaced the one-sprint everything-bundle:

| Sprint | Capability | Outcome |
|--------|------------|---------|
| 3 | AI Hub v2 | Class-scoped chat + history + assistant that queries, generates, and saves on confirm |
| 4 | Class resources | One resources section per class; upload any type |
| 5 | Bulk evaluation | Stack upload → segment → identify → per-question drafts → review → sign-off |
| 6 | Polish + production | Dashboard summary, export, optional PWA, production launch + v1.0.0 |

Each sprint is a single coherent capability a teacher can actually feel — not a layer of a feature that only makes sense once four other layers exist.

## 7. Engineering choices worth noting

- **Reuse the RAG engine, rewrap the UX.** Sprint 2's retrieval, embedding, and ingest pipeline was solid. The rebuild reuses it wholesale and only changes how teachers reach it. Don't rewrite what works.
- **Vercel AI SDK with tools + streaming** for the agent — same `getChatModel()` abstraction already in the codebase, tools backed by existing RAG functions.
- **Text chat vs vision** split by provider per ADR-003: DeepSeek for text reasoning, a vision-capable model for reading scripts. One abstraction, right model per job.
- **Batch job + review queue over chat-driven grading.** For bulk evaluation, a background pass that populates a review table is simpler and more reliable than a conversational back-and-forth. Chat *triggers* the job; a table *reviews* it. Use the right interaction model for the task.
- **Small, additive schema.** Two tables for conversations, three for evaluation, one column on resources. Everything else reuses what exists.

## 8. The meta-lesson

The most valuable move of the whole sprint was **deleting working code**. It's psychologically hard — sunk cost screams to salvage it. But the build embodied the wrong shape, and salvaging would have meant carrying that complexity forward forever. Throwing it away and re-deriving the requirements from the vision cost days and saved months.

Simplicity wasn't a constraint we accepted reluctantly. It turned out to be the *design* — three surfaces, one agent, and a rule that it always asks first.

---

*Source notes for a LinkedIn post. Structure suggestion: open with the "we deleted working code" hook (§8), tell the pivot story (§2–3), then pull two or three concrete design insights (§4.1, §4.3, §4.4), and close on the meta-lesson.*
