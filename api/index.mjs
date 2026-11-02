import { createApp } from '../apps/api/src/app.mjs';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}


