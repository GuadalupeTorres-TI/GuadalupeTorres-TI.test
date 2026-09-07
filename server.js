const express = require('express');
const { chromium } = require('playwright');
const app = express();
app.use(express.json());

app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(url, { waitUntil: 'load' });
  const title = await page.title();
  const brokenLinksCount = 0; // lo ampliamos después

  await browser.close();
  res.json({ url, title, consoleErrors: errors });
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));