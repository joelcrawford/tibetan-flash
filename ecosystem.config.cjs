module.exports = {
  apps: [
    {
      name: "tibetan-node",
      script: "server/index.js",
      cwd: "/opt/tibetan-flash",
      env: {
        PORT: 7860,
        TTS_URL: "http://127.0.0.1:7861",
        NODE_ENV: "production",
      },
    },
    {
      name: "tibetan-python",
      script: "src/python/tts_server.py",
      cwd: "/opt/tibetan-flash",
      interpreter: "/opt/tibetan-flash/.venv/bin/python3",
    },
  ],
};
