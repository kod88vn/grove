module.exports = {
  apps: [
    {
      name: 'grove',
      cwd: '.',
      script: './node_modules/.bin/platformatic',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
}
