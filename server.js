require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  const startTime = Date.now();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(url, { waitUntil: 'load' });
  const loadTime = Date.now() - startTime;
  const title = await page.title();

  const links = await page.$$eval('a', anchors => anchors.map(a => a.href));
  const uniqueLinks = [...new Set(links)].filter(l => l.startsWith('http'));

  const brokenLinks = [];
  for (const link of uniqueLinks.slice(0, 20)) {
    try {
      const response = await page.request.get(link, { timeout: 5000 });
      if (response.status() >= 400) brokenLinks.push({ link, status: response.status() });
    } catch (e) {
      brokenLinks.push({ link, status: 'error de conexión' });
    }
  }

  await browser.close();

  const rawData = { url, title, loadTimeMs: loadTime, totalLinksFound: uniqueLinks.length, brokenLinks, consoleErrors: errors };

  // Interpretación con IA
  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Eres un auditor de QA. Con estos datos crudos de una auditoría web, genera un reporte breve en español con: 1) resumen general, 2) hallazgos críticos, 3) sugerencias. Datos: ${JSON.stringify(rawData)}`
    }]
  });

  const reportText = aiResponse.content[0].text;

  res.json({ rawData, aiReport: reportText });
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));