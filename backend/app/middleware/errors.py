import logging
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("agentforge")


def register_error_handlers(app):
    @app.exception_handler(RequestValidationError)
    async def validation(_: Request, e: RequestValidationError):
        msg = "; ".join(f"{'.'.join(str(x) for x in err['loc'][1:])}: {err['msg']}" for err in e.errors())
        return JSONResponse({"detail": msg}, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled(r: Request, e: Exception):
        log.exception("Unhandled error on %s", r.url.path)
        return JSONResponse({"detail": "Internal server error"}, status_code=500)
