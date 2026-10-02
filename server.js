require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

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

  // Reporte automático sin IA
const checkedLinks = uniqueLinks.slice(0, 20).length;

const httpErrors = brokenLinks.filter(
  item => typeof item.status === 'number'
);

const connectionErrors = brokenLinks.filter(
  item => typeof item.status !== 'number'
);

const reportText = [
  'REPORTE DE AUDITORÍA WEB',
  'Generado mediante reglas automáticas, sin IA.',
  '',
  `Página: ${url}`,
  `Título: ${title || 'Sin título'}`,
  `Tiempo de apertura y navegación: ${(loadTime / 1000).toFixed(2)} segundos`,
  '',
  'ENLACES',
  `Enlaces encontrados: ${uniqueLinks.length}`,
  `Enlaces revisados: ${checkedLinks} (máximo 20)`,
  `Respuestas HTTP de error: ${httpErrors.length}`,
  `Enlaces sin comprobar: ${connectionErrors.length}`,
  '',
  'RESPUESTAS HTTP DE ERROR',
  ...(httpErrors.length
    ? httpErrors.map(item => `• HTTP ${item.status}: ${item.link}`)
    : ['No se detectaron respuestas HTTP de error en los enlaces revisados.']),
  '',
  'ENLACES SIN COMPROBAR',
  ...(connectionErrors.length
    ? connectionErrors.map(item => `• ${item.link}: ${item.status}`)
    : ['No hubo errores de conexión al comprobar los enlaces.']),
  '',
  'ERRORES DE CONSOLA',
  ...(errors.length
    ? errors.map(message => `• ${message}`)
    : ['No se registraron errores de consola durante la navegación.']),
  '',
  'SUGERENCIAS',
  ...(!title
    ? ['• Agrega un título descriptivo a la página.']
    : []),
  ...(httpErrors.length
    ? ['• Revisa las respuestas HTTP indicadas. Un 403 puede ser una restricción de acceso y un 429 un límite de solicitudes; no necesariamente son enlaces rotos.']
    : []),
  ...(connectionErrors.length
    ? ['• Comprueba manualmente los enlaces sin respuesta: podrían tener problemas temporales o bloquear las consultas automáticas.']
    : []),
  ...(errors.length
    ? ['• Revisa los errores de consola para identificar recursos o scripts que fallan.']
    : []),
  '• Complementa esta revisión con pruebas manuales de formularios, botones y navegación en celular.',
  '',
  'ALCANCE',
  'Se revisó una página y hasta 20 de sus enlaces.',
  'El tiempo mostrado incluye el arranque del navegador; no es una medición de Core Web Vitals.',
  'La ausencia de hallazgos no garantiza que el sitio esté libre de errores.'
].join('\n');

res.json({
  rawData: { ...rawData, checkedLinks },
  reportType: 'rules',
  aiReport: reportText
});
  });

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));

