const http = require('http');

setTimeout(() => {
    http.get('http://localhost:3100/api/cip/reporte2?user_id=954bee42-8636-4001-901a-9ca09f48707c', (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            console.log("Status:", res.statusCode);
            console.log("Response:", data);
        });
    }).on('error', (e) => {
        console.error(e);
    });
}, 2000);
