module.exports = {
  apps: [
    {
      name: 'extension',
      script: 'dist/main.js',
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
