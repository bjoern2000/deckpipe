import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  if (!config.adminUsername || !config.adminPassword) {
    res.status(503).send('Admin not configured');
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="deckpipe admin"');
    res.status(401).send('Authentication required');
    return;
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const colonIdx = decoded.indexOf(':');
  const user = colonIdx < 0 ? decoded : decoded.slice(0, colonIdx);
  const pass = colonIdx < 0 ? '' : decoded.slice(colonIdx + 1);

  const userBuf = Buffer.from(user);
  const passBuf = Buffer.from(pass);
  const expectedUser = Buffer.from(config.adminUsername);
  const expectedPass = Buffer.from(config.adminPassword);

  const userOk = userBuf.length === expectedUser.length && timingSafeEqual(userBuf, expectedUser);
  const passOk = passBuf.length === expectedPass.length && timingSafeEqual(passBuf, expectedPass);

  if (userOk && passOk) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="deckpipe admin"');
    res.status(401).send('Invalid credentials');
  }
}
