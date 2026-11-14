import { preview } from 'vite';
import type { TestProject } from 'vitest/node';

export async function setup(project: TestProject) {
  const server = await preview({
    configFile: false,
    preview: { host: '127.0.0.1', port: 0 },
  });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Preview server has no URL');
  project.provide('productionURL', new URL(url).origin);
  return () =>
    new Promise<void>((resolve, reject) => {
      server.httpServer.close((error?: Error) => (error ? reject(error) : resolve()));
    });
}
