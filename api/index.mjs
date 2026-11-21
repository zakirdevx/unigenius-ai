// Vercel entry point. If the server fails to start, show the real reason instead of a blank crash page.
let handler;
try {
  const { createApp } = await import('../server/app.js');
  handler = createApp();
} catch (err) {
  console.error('Startup failed:', err);
  handler = (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server failed to start', reason: String(err && err.message ? err.message : err).slice(0, 500) }));
  };
}
export default handler;
