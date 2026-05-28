/**
 * Remote MCP server, mounted at /mcp (Streamable HTTP transport).
 *
 * Tool definitions live in @deckpipe/mcp-core so this file and the
 * standalone `deckpipe-mcp` npm package share one source of truth.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { INSTRUCTIONS, registerTools } from '@deckpipe/mcp-core';
import { config } from '../config.js';

const MCP_VERSION = '0.3.9';

const transports = new Map<string, StreamableHTTPServerTransport>();

export const mcpRouter = Router();

mcpRouter.post('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`[mcp] POST session=${sessionId || 'new'}, active sessions: ${transports.size}`);

    if (sessionId && transports.has(sessionId)) {
      console.log(`[mcp] reusing existing session ${sessionId}`);
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (sessionId) {
      console.log(`[mcp] stale session ${sessionId}, asking client to reconnect`);
      res.status(404).json({ error: 'Session not found. Please reconnect.' });
      return;
    }

    console.log(`[mcp] creating new session`);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      console.log(`[mcp] session ${transport.sessionId} closed`);
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    const mcpServer = new McpServer({ name: 'deckpipe', version: MCP_VERSION }, { instructions: INSTRUCTIONS });
    registerTools(mcpServer, { apiUrl: config.apiUrl || `http://localhost:${config.port}` });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);

    if (transport.sessionId) {
      console.log(`[mcp] new session ${transport.sessionId}`);
      transports.set(transport.sessionId, transport);
    }
    console.log(`[mcp] POST handled, response sent: ${res.headersSent}`);
  } catch (err) {
    console.error(`[mcp] POST error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

mcpRouter.get('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`[mcp] GET session=${sessionId || 'none'}`);
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(404).json({ error: 'Session not found' });
  } catch (err) {
    console.error(`[mcp] GET error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

mcpRouter.delete('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`[mcp] DELETE session=${sessionId || 'none'}`);
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(404).json({ error: 'Session not found' });
  } catch (err) {
    console.error(`[mcp] DELETE error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});
