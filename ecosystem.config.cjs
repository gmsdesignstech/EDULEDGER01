/**
 * ecosystem.config.cjs
 * PM2 Process Manager Configuration for EduLedger WhatsApp Background Worker
 * 
 * Commands:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart eduledger-whatsapp-worker
 *   pm2 logs eduledger-whatsapp-worker
 *   pm2 status
 */
module.exports = {
  apps: [
    {
      name: "eduledger-whatsapp-worker",
      script: "scripts/whatsapp-worker.mjs",
      instances: 1, // Single continuous instance per host (concurrency protected via PostgreSQL FOR UPDATE SKIP LOCKED)
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};

