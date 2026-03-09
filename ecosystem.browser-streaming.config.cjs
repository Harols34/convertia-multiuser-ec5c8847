module.exports = {
  apps: [
    {
      name: "usuarios",
      script: "npm",
      args: "run dev",
      cwd: "/home/devai/usuarios/convertia-multiuser-ec5c8847",
      env: {
        VITE_EMBEDDED_BROWSER_MODE: "streaming",
      },
    },
    {
      name: "usuarios-browser-engine",
      script: "npm",
      args: "run dev:browser-engine",
      cwd: "/home/devai/usuarios/convertia-multiuser-ec5c8847",
      env: {
        BROWSER_ENGINE_PORT: "8787",
        BROWSER_ENGINE_EXECUTABLE_PATH: "/usr/bin/google-chrome",
      },
    },
    {
      name: "usuarios-browser-streaming-engine",
      script: "npm",
      args: "run dev:browser-streaming-engine",
      cwd: "/home/devai/usuarios/convertia-multiuser-ec5c8847",
      env: {
        BROWSER_STREAMING_ENGINE_PORT: "8790",
        BROWSER_ENGINE_EXECUTABLE_PATH: "/usr/bin/google-chrome",
      },
    },
  ],
};
