require('dotenv').config();
const { reporte2 } = require('./src/interfaces/http/controllers/reportesCIPController');

const req = {
    query: {
        user_id: '2905483f-7598-45e1-a5fa-b40c4254de7b'
    }
};

const res = {
    status: function(code) {
        this.statusCode = code;
        return this;
    },
    json: function(data) {
        console.log("Response Status:", this.statusCode || 200);
        if (data.error) {
            console.error("Error from controller:", data.error);
        } else {
            console.log("Success! Returned data items:", data.proyectos ? data.proyectos.length : 0);
        }
    }
};

async function run() {
    await reporte2(req, res);
    process.exit(0);
}
run();
