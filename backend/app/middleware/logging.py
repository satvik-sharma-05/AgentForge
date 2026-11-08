import time, uuid, logging
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger("agentforge")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Adds X-Request-ID + X-Process-Time headers and logs each request."""

    async def dispatch(self, request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        t0 = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - t0) * 1000
        response.headers["X-Request-ID"] = rid
        response.headers["X-Process-Time"] = f"{ms:.1f}ms"
        log.info("%s %s %s %.1fms rid=%s", request.method, request.url.path, response.status_code, ms, rid)
        return response
