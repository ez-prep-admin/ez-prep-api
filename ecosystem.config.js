module.exports = {
  apps: [
    {
      name: 'ez-prep-api',

      script: 'dist/main.js',

      cwd: '/var/www/ez-prep-api',

      instances: 1,

      exec_mode: 'fork',

      autorestart: true,

      watch: false,

      max_memory_restart: '700M',

      kill_timeout: 5000,

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
