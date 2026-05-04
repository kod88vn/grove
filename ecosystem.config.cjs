module.exports = {
  apps: [
    {
      name: 'nora',
      cwd: './apps/nora',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
}
