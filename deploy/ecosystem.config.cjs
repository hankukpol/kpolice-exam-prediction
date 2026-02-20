module.exports = {
  apps: [
    {
      name: "police-exam",
      cwd: "/opt/exam-police",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
