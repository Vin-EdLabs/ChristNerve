/**
 * ChristNerve — PM2
 * pm2 start ecosystem.config.js --env production && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'christnerve-api',
      script: 'dist/index.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
  ],
};
