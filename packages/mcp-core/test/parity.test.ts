/**
 * Drift guard for the deckpipe MCP surface.
 *
 * Both MCP servers — the remote Streamable-HTTP transport mounted at /mcp by
 * packages/api, and the standalone `deckpipe-mcp` npm package — build their
 * tool list by calling `registerTools()` from this package. These tests boot a
 * real McpServer over an in-memory transport and assert, against the actual
 * `tools/list` response, that:
 *
 *   1. Both configurations expose exactly TOOL_NAMES.
 *   2. Every tool carries a human-readable `annotations.title`.
 *   3. The two configurations are byte-identical except for `upload_image`,
 *      which legitimately gains a local-file `path` param under stdio.
 *   4. The version constant matches every package.json that ships it.
 *   5. Every doc that enumerates tools lists all of them.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { INSTRUCTIONS, MCP_SERVER_VERSION, TOOL_NAMES, registerTools } from '../src/index.js';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

type ListedTool = {
  name: string;
  description?: string;
  annotations?: { title?: string };
  inputSchema: unknown;
};

/**
 * Boot a server exactly the way a transport does, then read its tools back
 * through a real client. `allowLocalFiles: true` mirrors stdio mode
 * (deckpipe-mcp on the user's machine); false mirrors both remote transports.
 */
async function listTools(allowLocalFiles: boolean): Promise<ListedTool[]> {
  const server = new McpServer(
    { name: 'deckpipe', version: MCP_SERVER_VERSION },
    { instructions: INSTRUCTIONS }
  );
  registerTools(server, { apiUrl: 'https://example.invalid', allowLocalFiles });

  const client = new Client({ name: 'parity-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  await client.close();
  await server.close();
  return tools as ListedTool[];
}

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

test('remote and local transports expose exactly the canonical tool list', async () => {
  const remote = await listTools(false);
  const local = await listTools(true);

  assert.deepEqual(
    remote.map((t) => t.name).sort(),
    [...TOOL_NAMES].sort(),
    'remote (/mcp) tool list drifted from TOOL_NAMES'
  );
  assert.deepEqual(
    local.map((t) => t.name).sort(),
    [...TOOL_NAMES].sort(),
    'local (stdio) tool list drifted from TOOL_NAMES'
  );
  assert.equal(TOOL_NAMES.length, 13, 'tool count changed — update the directory submission and docs');
});

test('every tool has a title annotation', async () => {
  for (const tool of await listTools(false)) {
    const title = tool.annotations?.title;
    assert.ok(
      typeof title === 'string' && title.trim().length > 0,
      `${tool.name} is missing annotations.title (required by the MCP directory)`
    );
    assert.notEqual(title, tool.name, `${tool.name}'s title should be human-readable, not the tool name`);
  }
});

test('remote and local tool definitions are identical except upload_image', async () => {
  const remote = new Map((await listTools(false)).map((t) => [t.name, t]));
  const local = new Map((await listTools(true)).map((t) => [t.name, t]));

  for (const name of TOOL_NAMES) {
    const a = remote.get(name)!;
    const b = local.get(name)!;
    assert.deepEqual(a.annotations, b.annotations, `${name}: annotations differ between transports`);

    if (name === 'upload_image') {
      // Only stdio may read the caller's filesystem — that's the one sanctioned
      // difference, and it must go in exactly one direction.
      const remoteProps = Object.keys(((a.inputSchema as any).properties) ?? {});
      const localProps = Object.keys(((b.inputSchema as any).properties) ?? {});
      assert.ok(!remoteProps.includes('path'), 'remote upload_image must NOT accept a local file path');
      assert.ok(localProps.includes('path'), 'stdio upload_image should accept a local file path');
      assert.deepEqual(
        localProps.filter((p) => p !== 'path').sort(),
        remoteProps.sort(),
        'upload_image differs beyond the sanctioned `path` param'
      );
      continue;
    }

    assert.equal(a.description, b.description, `${name}: description differs between transports`);
    assert.deepEqual(a.inputSchema, b.inputSchema, `${name}: input schema differs between transports`);
  }
});

test('MCP_SERVER_VERSION matches the published package versions', () => {
  for (const pkg of ['packages/mcp-core/package.json', 'packages/mcp/package.json']) {
    assert.equal(readJson(pkg).version, MCP_SERVER_VERSION, `${pkg} version drifted from MCP_SERVER_VERSION`);
  }
});

test('docs that enumerate tools list every tool', () => {
  const docs = [
    'README.md',
    'docs/mcp-agent-instructions.md',
    'packages/mcp/README.md',
    'packages/viewer/public/llms.txt',
    'packages/viewer/public/landing.html',
  ];
  for (const doc of docs) {
    const text = fs.readFileSync(path.join(repoRoot, doc), 'utf8');
    const missing = TOOL_NAMES.filter((name) => !text.includes(name));
    assert.deepEqual(missing, [], `${doc} does not mention: ${missing.join(', ')}`);
  }
});
