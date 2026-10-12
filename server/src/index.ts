import main from './app.js';

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
