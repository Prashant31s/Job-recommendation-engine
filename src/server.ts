import app from './app';
import prisma from './prisma/client';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function main() {
  await prisma.$connect();
  console.log('Database connected');

  app.listen(PORT, () => {
    console.log(`Job Match API running on http://localhost:${PORT}`);
    console.log(` Health: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
