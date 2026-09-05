import { Request, Response, Router } from 'express';
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport, originValidation } from '@modelcontextprotocol/node';
import { DeviceService } from '../domain/DeviceService';
import { registerMcpHandlers } from './registerMcpHandlers';
import logger from '../logger';

export const MCP_SERVER_NAME = 'control-cove';
export const MCP_SERVER_VERSION = '1.0.0';

/** Builds a fully wired MCP server. One per request — see createMcpRouter. */
export function createMcpServer(deviceService: DeviceService): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });
  registerMcpHandlers(server, deviceService);
  return server;
}

/**
 * index.ts mounts a fully permissive cors(), so without this any page on the LAN
 * could POST to /mcp from a browser and toggle the user's lights. Requests with no
 * Origin header — every real MCP client, the Inspector included — still pass; a
 * cross-origin page gets 403.
 */
const allowedOrigins = (): string[] => {
  const configured = (process.env.MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return ['localhost', '127.0.0.1', '[::1]', ...configured];
};

/**
 * The MCP adapter's HTTP surface, mirroring http/routes.ts's createApiRouter.
 *
 * A router factory rather than a long-lived service class, because the transport is
 * stateless: it and its server live for exactly one request. That is the documented
 * pattern for session-less Streamable HTTP, and it keeps request ids from colliding
 * between concurrent clients.
 */
export function createMcpRouter(deviceService: DeviceService): Router {
  const router = Router();
  const validateOrigin = originValidation(allowedOrigins());

  const handle = async (req: Request, res: Response): Promise<void> => {
    if (!validateOrigin(req, res)) {
      return;
    }

    const server = createMcpServer(deviceService);
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Plain JSON responses instead of SSE: no server-initiated notifications are
      // sent, so the stream buys nothing, and a plain body is far easier to read from
      // curl when debugging. Clients that accept text/event-stream handle it fine.
      enableJsonResponse: true,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      // express.json() has already consumed the stream, so hand over the parsed body.
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(`[MCP] Request failed: ${String(error)}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };

  router.post('/', handle);
  router.get('/', handle);
  router.delete('/', handle);
  return router;
}
