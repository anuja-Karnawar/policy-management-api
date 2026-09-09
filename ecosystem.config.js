module.exports = {
  apps: [
    {
      name: 'policy-api',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 50,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
