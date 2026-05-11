import esbuild from 'esbuild';
import { chmod } from 'node:fs/promises';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  // Keep runtime deps external; bundle the workspace-local mcp-core inline
  // so the published npm package has no unresolvable workspace specifier.
  external: [
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/*',
    'zod',
  ],
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
  minify: false,
});

await chmod('dist/index.js', 0o755);
