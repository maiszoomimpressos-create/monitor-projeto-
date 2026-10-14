// pm2 (máquina própria / Windows): pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "supabase-uptime-worker",
      script: "node",
      args: "--env-file=.env.local --import tsx src/worker/index.ts",
      autorestart: true,
      kill_timeout: 65000,
      max_restarts: 50,
      restart_delay: 5000,
    },
  ],
};
