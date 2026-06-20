import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const API_TARGET = 'http://127.0.0.1:1880';
const WEB_PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

app.use('/api/parking', async (req, res) => {
  try {
    const url = new URL(`${API_TARGET}${req.originalUrl}`);
    const init = {
      method: req.method,
      headers: { ...req.headers, host: url.host },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    };
    const response = await fetch(url, init);

    const buffer = await response.arrayBuffer();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    res.status(response.status).send(Buffer.from(buffer));
  } catch (error) {
    res.status(502).json({ ok: false, error: 'Unable to reach Node-RED backend', details: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(WEB_PORT, () => {
  console.log(`Smart Parking Web UI available at http://localhost:${WEB_PORT}`);
  console.log('Node-RED must be running separately on http://127.0.0.1:1880');
});
