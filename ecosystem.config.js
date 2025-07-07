module.exports = {
  apps: [
    {
      name: 'realtime-yjs-server-dev',
      script: 'src/index.js',
      watch: true,
      ignore_watch: ['node_modules', 'logs', 'tests', '.git'],
      watch_options: {
        followSymlinks: false,
        usePolling: false,
        interval: 1000,
        binaryInterval: 3000
      },
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    },
    {
      name: 'realtime-yjs-server-prod',
      script: 'src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
