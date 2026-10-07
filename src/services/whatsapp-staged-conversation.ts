import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import {
  saveConversationState,
  clearConversationState,
  stageIdempotencyKey,
  type ConversationState,
} from "./whatsapp-conversation-state.js";
import {
  STAGE_MESSAGES,
  isStageId,
} from "./whatsapp-stages.js";
import {
  sendJobCarousel,
  sendJobText,
  sendStageMessage,
} from "./whatsapp-stage-messages.js";
import { parseFindJobSearchResponse } from "./stages/find-job/flow.js";
import {
  getJobById,
  listJobs,
  searchJobs,
} from "./jobs/job-repository.js";
import {
  APPLY_BUTTON_TITLE,
  DETAIL_BUTTON_TITLE,
  EMPTY_MIXED_BODY,
  JOB_CARD_IMAGE_URL,
  MORE_BATCH_HEADING,
  MIXED_HEADING,
  applyConfirmationBody,
  applyPayload,
  buildJobListView,
  detailPayload,
  emptySearchBody,
  fullDetailBody,
  parseJobPayload,
  fitTitle,
  parseMorePayload,
  searchHeading,
  type ListOrigin,
} from "./jobs/job-carousel.js";
import type { JobPage } from "./jobs/job-types.js";

export type StagedConversationContext = {
  job: WhatsappIncomingMessageJob;
  redis: Redis;
  apiKey: string;
  logger: FastifyBaseLogger;
  signal: AbortSignal;
  key: string;
  state: ConversationState;
};

function responseLabel(stage: ConversationState["stage"]): string {
  const definition = STAGE_MESSAGES[stage];
  const button = definition.buttons.find((item) => item.payload === stage);
  if (button) return button.title;
  if (stage === "get_started") return "Get started";
  if (stage === "tafuta_kazi") return "Tafuta kazi";
  if (stage === "tafuta_kazi_search") return "Andika jina la kazi";
  if (stage === "tafuta_kazi_mixed") return "Kazi mpya mchanganyiko";
  if (stage === "tangaza_kazi") return "Tangaza kazi";
  if (stage === "job_detail") return "Soma zaidi";
  if (stage === "job_apply") return "Omba";
  return "Taarifa zaidi";
}

function now(): string {
  return new Date().toISOString();
}

async function pushResponse(
  redis: Redis,
  key: string,
  state: ConversationState,
  entry: { stage: ConversationState["stage"]; response: string; eventId: string },
): Promise<void> {
  state.responses.push({ ...entry, receivedAt: now() });
  await saveConversationState(redis, key, state);
}

async function sendJobPage(
  page: JobPage,
  origin: ListOrigin,
  offset: number,
  heading: string,
  emptyBody: string,
  ctx: StagedConversationContext,
  eventId: string,
): Promise<void> {
  const { job, apiKey, logger, signal } = ctx;
  const view = buildJobListView(page, origin, offset, heading);
  if (view.kind === "empty") {
    await sendJobText(
      emptyBody,
      [{ title: "Rudi nyuma", payload: "get_started" }],
      job,
      apiKey,
      stageIdempotencyKey(ctx.state.stage, `${eventId}:empty`),
      signal,
    );
    logger.info({ eventId, origin }, "Sent empty job list message");
    return;
  }
  if (view.kind === "single") {
    // One job can't form a carousel (Meta requires 2-10 cards), so it goes
    // out as a reply-buttons message with the same image header the cards
    // carry, keeping the look consistent across result counts.
    await sendJobText(
      fullDetailBody(view.job),
      [
        { title: APPLY_BUTTON_TITLE, payload: applyPayload(view.job.id) },
        { title: "Rudi nyuma", payload: "get_started" },
      ],
      job,
      apiKey,
      stageIdempotencyKey(ctx.state.stage, `${eventId}:single:${view.job.id}`),
      signal,
      { imageUrl: JOB_CARD_IMAGE_URL },
    );
    ctx.state.selectedJobId = view.job.id;
    logger.info({ eventId, jobId: view.job.id }, "Sent single job message");
    return;
  }
  await sendJobCarousel(
    view.heading,
    view.cards,
    job,
    apiKey,
    stageIdempotencyKey(ctx.state.stage, `${eventId}:page:${offset}`),
    signal,
  );
  logger.info(
    { eventId, cards: view.cards.length, offset },
    "Sent job carousel",
  );
}

export async function handleStagedConversation({
  job,
  redis,
  apiKey,
  logger,
  signal,
  key,
  state,
}: StagedConversationContext): Promise<void> {
  const ctx: StagedConversationContext = {
    job,
    redis,
    apiKey,
    logger,
    signal,
    key,
    state,
  };

  // No prompt sent yet (new conversation race or migrated state): send current stage.
  if (!state.promptSent) {
    await sendStageMessage(
      state.stage,
      { ...job, eventId: state.promptEventId },
      apiKey,
      stageIdempotencyKey(state.stage, state.promptEventId),
      signal,
    );
    signal.throwIfAborted();
    state.promptSent = true;
    await saveConversationState(redis, key, state);
    logger.info(
      { eventId: state.promptEventId, stage: state.stage },
      "Sent WhatsApp stage message",
    );
    return;
  }

  // Flow submission (nfm_reply): search jobs by keyword, send carousel.
  if (job.interactiveType === "nfm_reply") {
    const parsed = parseFindJobSearchResponse(
      job.flowResponseData ?? job.flowResponseJson,
    );
    const keyword =
      typeof parsed.keyword === "string" ? parsed.keyword.trim() : "";
    logger.info(
      {
        eventId: job.eventId,
        stage: state.stage,
        keyword,
        flowResponse: job.flowResponseData ?? job.flowResponseJson,
      },
      "Received WhatsApp Flow response",
    );
    if (!keyword) {
      await sendJobText(
        emptySearchBody(keyword),
        [{ title: "Rudi nyuma", payload: "get_started" }],
        job,
        apiKey,
        stageIdempotencyKey(state.stage, `${job.eventId}:empty`),
        signal,
      );
      signal.throwIfAborted();
      await saveConversationState(redis, key, state);
      return;
    }
    try {
      const page = await searchJobs(keyword, 0);
      signal.throwIfAborted();
      state.listKeyword = keyword;
      state.listOffset = 0;
      await sendJobPage(
        page,
        { kind: "search", keyword },
        0,
        searchHeading(keyword),
        emptySearchBody(keyword),
        ctx,
        job.eventId,
      );
      signal.throwIfAborted();
      state.stage = "tafuta_kazi_search";
      state.promptSent = true;
      await pushResponse(redis, key, state, {
        stage: "tafuta_kazi_search",
        response: keyword,
        eventId: job.eventId,
      });
      logger.info(
        { eventId: job.eventId, keyword, results: page.jobs.length },
        "Sent job search results",
      );
    } catch (error) {
      logger.error(
        { err: error, eventId: job.eventId, keyword },
        "Job search failed",
      );
      await sendJobText(
        "Samahani, imeshindikana kupakia kazi. Jaribu tena.",
        [{ title: "Rudi nyuma", payload: "get_started" }],
        job,
        apiKey,
        stageIdempotencyKey(state.stage, `${job.eventId}:error`),
        signal,
      );
      signal.throwIfAborted();
      await saveConversationState(redis, key, state);
    }
    return;
  }

  // Dynamic job payloads: Soma zaidi / Omba per job card.
  const jobRoute = parseJobPayload(job.interactiveId);
  if (jobRoute) {
    try {
      const listing = await getJobById(jobRoute.jobId);
      signal.throwIfAborted();
      if (!listing) {
        await sendJobText(
          "Samahani, kazi hiyo haikupatikana.",
          [{ title: "Rudi nyuma", payload: "get_started" }],
          job,
          apiKey,
          stageIdempotencyKey(state.stage, `${job.eventId}:missing`),
          signal,
        );
        signal.throwIfAborted();
        await saveConversationState(redis, key, state);
        return;
      }
      if (jobRoute.stage === "detail") {
        await sendJobText(
          fullDetailBody(listing),
          [
            { title: APPLY_BUTTON_TITLE, payload: applyPayload(listing.id) },
            { title: "Rudi nyuma", payload: "get_started" },
          ],
          job,
          apiKey,
          stageIdempotencyKey("job_detail", `${job.eventId}:${listing.id}`),
          signal,
        );
        signal.throwIfAborted();
        state.stage = "job_detail";
        state.promptSent = true;
        state.selectedJobId = listing.id;
        await pushResponse(redis, key, state, {
          stage: "job_detail",
          response: `${DETAIL_BUTTON_TITLE}: ${listing.title ?? listing.id}`,
          eventId: job.eventId,
        });
        logger.info(
          { eventId: job.eventId, jobId: listing.id },
          "Sent job detail",
        );
        return;
      }
      // Omba ends the stage: share the poster's contact, then clear state so
      // the next free-text message starts a fresh get-started menu. No
      // buttons: with state gone a tap would have nowhere to resume to.
      // Old card buttons keep working statelessly through their payload ids.
      await sendJobText(
        applyConfirmationBody(listing.posterPhone ?? ""),
        [],
        job,
        apiKey,
        stageIdempotencyKey("job_apply", `${job.eventId}:${listing.id}`),
        signal,
      );
      signal.throwIfAborted();
      logger.info(
        { eventId: job.eventId, jobId: listing.id, personKey: job.personKey },
        "Logged job application",
      );
      await clearConversationState(redis, key);
      logger.info(
        { eventId: job.eventId, jobId: listing.id },
        "Cleared conversation state after job application",
      );
    } catch (error) {
      logger.error(
        { err: error, eventId: job.eventId },
        "Job detail/apply handling failed",
      );
      throw error;
    }
    return;
  }

  // Pagination: Tizama kazi zaidi loads the next batch.
  const more = parseMorePayload(job.interactiveId);
  if (more) {
    const origin: ListOrigin = more.origin;
    try {
      const page =
        origin.kind === "search"
          ? await searchJobs(origin.keyword, more.offset)
          : await listJobs(more.offset);
      signal.throwIfAborted();
      state.listOffset = more.offset;
      if (origin.kind === "search") state.listKeyword = origin.keyword;
      await sendJobPage(
        page,
        origin,
        more.offset,
        MORE_BATCH_HEADING,
        origin.kind === "search"
          ? emptySearchBody(origin.keyword)
          : EMPTY_MIXED_BODY,
        ctx,
        job.eventId,
      );
      signal.throwIfAborted();
      state.promptSent = true;
      await pushResponse(redis, key, state, {
        stage: state.stage,
        response: `Tizama kazi zaidi (offset ${more.offset})`,
        eventId: job.eventId,
      });
      logger.info(
        { eventId: job.eventId, offset: more.offset },
        "Sent next job batch",
      );
    } catch (error) {
      logger.error(
        { err: error, eventId: job.eventId },
        "Job pagination failed",
      );
      throw error;
    }
    return;
  }

  // Last tap wins: any recognized Stage payload moves to that Stage.
  if (isStageId(job.interactiveId)) {
    const target = job.interactiveId;
    // Kazi mchanganyiko entry renders the live job list carousel.
    if (target === "tafuta_kazi_mixed") {
      try {
        const page = await listJobs(0);
        signal.throwIfAborted();
        state.stage = target;
        state.promptSent = true;
        state.listOffset = 0;
        state.listKeyword = undefined;
        await sendJobPage(
          page,
          { kind: "mixed" },
          0,
          MIXED_HEADING,
          EMPTY_MIXED_BODY,
          ctx,
          job.eventId,
        );
        signal.throwIfAborted();
        await pushResponse(redis, key, state, {
          stage: target,
          response: responseLabel(target),
          eventId: job.eventId,
        });
        logger.info(
          { eventId: job.eventId, stage: target, results: page.jobs.length },
          "Sent mixed job list",
        );
      } catch (error) {
        logger.error(
          { err: error, eventId: job.eventId },
          "Mixed job list failed",
        );
        await sendJobText(
          "Samahani, imeshindikana kupakia kazi. Jaribu tena.",
          [{ title: "Rudi nyuma", payload: "get_started" }],
          job,
          apiKey,
          stageIdempotencyKey(target, `${job.eventId}:error`),
          signal,
        );
        signal.throwIfAborted();
        state.stage = target;
        state.promptSent = true;
        await saveConversationState(redis, key, state);
      }
      return;
    }
    await sendStageMessage(
      target,
      job,
      apiKey,
      stageIdempotencyKey(target, job.eventId),
      signal,
    );
    signal.throwIfAborted();
    state.stage = target;
    state.promptSent = true;
    state.responses.push({
      stage: target,
      response: responseLabel(target),
      eventId: job.eventId,
      receivedAt: new Date().toISOString(),
    });
    await saveConversationState(redis, key, state);
    logger.info(
      { eventId: job.eventId, stage: target },
      "Received WhatsApp stage selection",
    );
    return;
  }

  // Free text or unknown payload: replay current Stage (7-day resume included).
  // Dynamic job stages re-render from the stored selection.
  if ((state.stage === "job_detail" || state.stage === "job_apply") && state.selectedJobId) {
    try {
      const listing = await getJobById(state.selectedJobId);
      signal.throwIfAborted();
      if (listing) {
        await sendJobText(
          state.stage === "job_detail"
            ? fullDetailBody(listing)
            : `Omba limepokelewa kwa *${fitTitle(listing.title, 80)}*. Tutakujulisha hatua zinazofuata.`,
          state.stage === "job_detail"
            ? [
                { title: APPLY_BUTTON_TITLE, payload: applyPayload(listing.id) },
                { title: "Rudi nyuma", payload: "get_started" },
              ]
            : [{ title: "Rudi nyuma", payload: "get_started" }],
          job,
          apiKey,
          stageIdempotencyKey(state.stage, job.eventId),
          signal,
        );
        signal.throwIfAborted();
        await saveConversationState(redis, key, state);
        logger.info(
          { eventId: job.eventId, stage: state.stage },
          "Replayed job stage message",
        );
        return;
      }
    } catch (error) {
      logger.error({ err: error, eventId: job.eventId }, "Job replay failed");
    }
  }
  // All outbound is through defined interactive messages.
  await sendStageMessage(
    state.stage,
    job,
    apiKey,
    stageIdempotencyKey(state.stage, job.eventId),
    signal,
  );
  signal.throwIfAborted();
  await saveConversationState(redis, key, state);
  logger.info(
    { eventId: job.eventId, stage: state.stage },
    "Replayed current WhatsApp stage message",
  );
}
