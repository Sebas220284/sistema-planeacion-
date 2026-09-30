const http = require('http');

setTimeout(() => {
    http.get('http://localhost:3100/api/reportes/cip/reporte2?user_id=2905483f-7598-45e1-a5fa-b40c4254de7b', (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            console.log("Status:", res.statusCode);
            console.log("Response:", data);
        });
    }).on('error', (e) => {
        console.error("HTTP GET Error:", e);
    });
}, 2000);
