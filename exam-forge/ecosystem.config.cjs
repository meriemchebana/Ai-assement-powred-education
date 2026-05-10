module.exports = {
  "apps": [
    {
      "name": "exam-forge-backend",
      "cwd": "/home/meriem/llm-project/exam-forge/backend",
      "script": "python3",
      "args": "-m uvicorn app.main:app --host 127.0.0.1 --port 28000",
      "interpreter": "none",
      "exec_mode": "fork",
      "instances": 1,
      "autorestart": true,
      "max_restarts": 10,
      "watch": false,
      "env": {
        "PYTHONUNBUFFERED": "1"
      },
      "out_file": "/home/meriem/llm-project/exam-forge/logs/backend.out.log",
      "error_file": "/home/meriem/llm-project/exam-forge/logs/backend.err.log",
      "merge_logs": true
    },
    {
      "name": "exam-forge-frontend",
      "cwd": "/home/meriem/llm-project/exam-forge/frontend",
      "script": "npm",
      "args": "run dev",
      "interpreter": "none",
      "exec_mode": "fork",
      "instances": 1,
      "autorestart": true,
      "max_restarts": 10,
      "watch": false,
      "out_file": "/home/meriem/llm-project/exam-forge/logs/frontend.out.log",
      "error_file": "/home/meriem/llm-project/exam-forge/logs/frontend.err.log",
      "merge_logs": true
    },
    {
      "name": "exam-forge-tunnel",
      "cwd": "/home/meriem/llm-project/exam-forge",
      "script": "cloudflared",
      "args": "tunnel --url http://127.0.0.1:29000 --no-autoupdate",
      "interpreter": "none",
      "exec_mode": "fork",
      "instances": 1,
      "autorestart": true,
      "max_restarts": 5,
      "out_file": "/home/meriem/llm-project/exam-forge/logs/tunnel.out.log",
      "error_file": "/home/meriem/llm-project/exam-forge/logs/tunnel.err.log",
      "merge_logs": true
    }
  ]
};
