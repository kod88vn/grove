module.exports = {
  apps: [
    {
      name: 'nora',
      cwd: './apps/nora',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 80 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: '80',
        HOSTNAME: '0.0.0.0',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
}
