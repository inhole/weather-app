// PM2 설정 파일
module.exports = {
  apps: [{
    name: 'weather-app',
    script: './server.js',
    exec_mode: 'fork',  // cluster 대신 fork 모드 사용
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',  // 메모리 제한 조정
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};

