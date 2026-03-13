"""Local AI task scheduler — controlled async job queue for heavy CPU tasks.

Prevents CPU thrashing by enforcing a maximum number of concurrently running
AI operations (OCR, embedding, ingestion, transcription).

Architecture
────────────
  ``AITaskScheduler`` wraps ``asyncio.Semaphore`` to limit concurrency and
  maintains an ``asyncio.PriorityQueue`` so high-priority tasks (e.g. live
  chat embedding) can preempt background ingestion.

Priority levels (lower number = higher priority)
─────────────────────────────────────────────────
  0 — INTERACTIVE   (live chat, search)
  1 — INGESTION     (document upload pipeline)
  2 — OCR           (scanned PDF processing)
  3 — TRANSCRIPTION (Whisper audio)
  4 — BACKGROUND    (re-indexing, batch embedding)

Usage::

    from app.services.ai_task_scheduler import scheduler, Priority

    # Fire-and-forget background task
    await scheduler.submit(
        coro=ingest_document(doc_id, db),
        name="ingest-{doc_id}",
        priority=Priority.INGESTION,
    )

    # Wait for result
    result = await scheduler.submit_and_wait(
        coro=model_manager.embeddings.encode(texts),
        name="embed-query",
        priority=Priority.INTERACTIVE,
    )
"""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Awaitable, Callable, Coroutine, Dict, List, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class Priority(IntEnum):
    INTERACTIVE = 0
    INGESTION = 1
    OCR = 2
    TRANSCRIPTION = 3
    BACKGROUND = 4


@dataclass(order=True)
class _Task:
    priority: int
    seq: int  # tie-break by submission order
    task_id: str = field(compare=False)
    name: str = field(compare=False)
    coro: Any = field(compare=False)
    future: asyncio.Future = field(compare=False)
    submitted_at: float = field(compare=False, default_factory=time.monotonic)


class AITaskScheduler:
    """Priority-based async task scheduler with concurrency cap."""

    def __init__(self, max_concurrent: int | None = None) -> None:
        self._max = max_concurrent or settings.MAX_INGEST_WORKERS
        self._semaphore = asyncio.Semaphore(self._max)
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._seq = 0
        self._active: Dict[str, _Task] = {}
        self._history: List[dict] = []
        self._worker_task: asyncio.Task | None = None
        self._running = False
        self._paused = False

    async def start(self) -> None:
        """Start the scheduler worker loop."""
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop(), name="ai-scheduler")
        logger.info("AITaskScheduler started", max_concurrent=self._max)

    def stop(self) -> None:
        self._running = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()

    async def submit(
        self,
        coro: Coroutine,
        name: str = "",
        priority: Priority = Priority.INGESTION,
    ) -> str:
        """Enqueue a coroutine.  Returns a task_id string."""
        task_id = str(uuid.uuid4())[:8]
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self._seq += 1
        task = _Task(
            priority=int(priority),
            seq=self._seq,
            task_id=task_id,
            name=name or task_id,
            coro=coro,
            future=future,
        )
        await self._queue.put(task)
        logger.debug("Task enqueued", name=task.name, priority=priority.name, task_id=task_id)
        return task_id

    async def submit_and_wait(
        self,
        coro: Coroutine,
        name: str = "",
        priority: Priority = Priority.INTERACTIVE,
        timeout: float | None = None,
    ) -> Any:
        """Enqueue and await result.  Raises on timeout or task failure."""
        task_id = await self.submit(coro, name=name, priority=priority)
        # Find the future we just registered
        # Poll until the task appears in _active or completes
        deadline = time.monotonic() + (timeout or 300)
        while True:
            if task_id in self._active:
                fut = self._active[task_id].future
                break
            if time.monotonic() > deadline:
                raise TimeoutError(f"Task {task_id} ({name}) did not start within timeout")
            await asyncio.sleep(0.05)
        try:
            return await asyncio.wait_for(asyncio.shield(fut), timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Task {task_id} ({name}) timed out")

    async def _worker_loop(self) -> None:
        """Continuously dequeue and dispatch tasks respecting the semaphore."""
        while self._running:
            if self._paused:
                await asyncio.sleep(0.5)
                continue
            try:
                task: _Task = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            self._active[task.task_id] = task
            asyncio.create_task(self._run_task(task), name=f"ait-{task.name}")

    async def _run_task(self, task: _Task) -> None:
        async with self._semaphore:
            start = time.monotonic()
            try:
                result = await task.coro
                if not task.future.done():
                    task.future.set_result(result)
                elapsed = time.monotonic() - start
                logger.debug("Task done", name=task.name, elapsed_s=round(elapsed, 2))
                self._history.append({
                    "task_id": task.task_id,
                    "name": task.name,
                    "status": "done",
                    "elapsed_s": round(elapsed, 2),
                })
            except Exception as exc:
                if not task.future.done():
                    task.future.set_exception(exc)
                logger.warning("Task failed", name=task.name, error=str(exc))
                self._history.append({
                    "task_id": task.task_id,
                    "name": task.name,
                    "status": "error",
                    "error": str(exc),
                })
            finally:
                self._active.pop(task.task_id, None)
                self._queue.task_done()
                # Keep only last 200 history entries
                if len(self._history) > 200:
                    self._history = self._history[-200:]

    def pause(self) -> None:
        """Pause task processing — queued tasks accumulate but don't execute."""
        self._paused = True
        logger.info("AITaskScheduler paused")

    def resume(self) -> None:
        """Resume task processing after a pause."""
        self._paused = False
        logger.info("AITaskScheduler resumed")

    def status(self) -> dict:
        """Return scheduler state for the health endpoint."""
        return {
            "max_concurrent": self._max,
            "paused": self._paused,
            "queue_depth": self._queue.qsize(),
            "active_tasks": [
                {"task_id": t.task_id, "name": t.name, "priority": t.priority}
                for t in self._active.values()
            ],
            "recent_history": self._history[-10:],
        }


# Global singleton — start via ``await scheduler.start()`` in lifespan
scheduler = AITaskScheduler()
