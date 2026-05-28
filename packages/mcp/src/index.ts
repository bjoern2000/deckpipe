/**
 * deckpipe-mcp — standalone MCP server.
 *
 * Two transports:
 *   - stdio (default): `npx deckpipe-mcp` — for Claude Desktop / Code / local agents.
 *   - HTTP (when PORT is set): bind to a port and serve Streamable HTTP MCP.
 *
 * All tool definitions live in @deckpipe/mcp-core; this file is just the
 * transport plumbing.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { INSTRUCTIONS, registerTools } from '@deckpipe/mcp-core';
import { config } from './config.js';

const NAME = 'deckpipe';
const VERSION = '0.3.9';

async function main() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

  if (port) {
    // HTTP mode — for remote MCP clients (Claude.ai etc).
    const transports = new Map<string, StreamableHTTPServerTransport>();

    const httpServer = createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
      res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url !== '/mcp') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      if (req.method === 'GET' || req.method === 'DELETE') {
        if (sessionId) {
          res.writeHead(404);
          res.end('Session not found');
        } else {
          res.writeHead(400);
          res.end('Session ID required');
        }
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      const mcpServer = new McpServer({ name: NAME, version: VERSION }, { instructions: INSTRUCTIONS });
      // HTTP mode is remote — never read the server's local filesystem.
      registerTools(mcpServer, { apiUrl: config.apiUrl, allowLocalFiles: false });
      await mcpServer.connect(transport);

      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }

      await transport.handleRequest(req, res);
    });

    httpServer.listen(port, () => {
      console.error(`deckpipe MCP server running on http://0.0.0.0:${port}/mcp`);
    });
  } else {
    // Stdio mode — for CLI (npx deckpipe-mcp). Runs on the user's machine, so
    // local-file image uploads are safe here.
    const server = new McpServer({ name: NAME, version: VERSION }, { instructions: INSTRUCTIONS });
    registerTools(server, { apiUrl: config.apiUrl, allowLocalFiles: true });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('deckpipe MCP server running on stdio');
  }
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
