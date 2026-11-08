from contextlib import asynccontextmanager
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client


@asynccontextmanager
async def session(url, headers):
    if url.rstrip("/").endswith("/sse"):
        cm = sse_client(url, headers=headers)
    else:
        cm = streamable_http_client(url, http_client=create_mcp_http_client(headers=headers))
    async with cm as streams:
        async with ClientSession(streams[0], streams[1]) as s:
            await s.initialize()
            yield s


async def discover(url, headers):
    async with session(url, headers) as s:
        return [dict(name=t.name, description=t.description or "", schema=t.inputSchema,
                     ro=bool(t.annotations and t.annotations.readOnlyHint)) for t in (await s.list_tools()).tools]


async def call(url, headers, name, args):
    async with session(url, headers) as s:
        r = await s.call_tool(name, args)
        return "\n".join(getattr(c, "text", "") for c in r.content)[:6000]
