export async function GET() {
  const info = {
    env: process.env.NODE_ENV,
    cwd: process.cwd(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    NORA_DB_PATH: process.env.NORA_DB_PATH || '(not set)',
  };

  try {
    await import('better-sqlite3');
    info.betterSqlite3Status = 'loaded';

    const dbModule = await import('@/lib/db/db.js');
    info.dbModuleStatus = 'loaded';

    const db = dbModule.default;
    db.prepare('SELECT 1').get();
    info.dbQueryStatus = 'ok';
  } catch (err) {
    info.error = err.message;
    info.stack = err.stack;
  }

  return Response.json(info, { status: 200 });
}
