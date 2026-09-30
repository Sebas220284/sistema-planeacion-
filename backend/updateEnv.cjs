const fs = require('fs');
let env = fs.readFileSync('.env', 'utf8');

env = env.replace(/^DB_HOST=.*$/m, 'DB_HOST=tokaido.proxy.rlwy.net');
env = env.replace(/^DB_PORT=.*$/m, 'DB_PORT=16984');
env = env.replace(/^DB_USER=.*$/m, 'DB_USER=postgres');
env = env.replace(/^DB_PASSWORD=.*$/m, 'DB_PASSWORD=GlVfKkIHfGdrARFOosZeqEubIIRYpNUp');
env = env.replace(/^DB_NAME=.*$/m, 'DB_NAME=railway');

fs.writeFileSync('.env', env, 'utf8');
console.log("Updated .env with Railway DB");
