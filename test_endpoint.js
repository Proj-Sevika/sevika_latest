const http = require('http');

http.get('http://127.0.0.1:3000/admin/food-donations', (res) => {
    console.log('STATUS CODE:', res.statusCode);
    res.on('data', (chunk) => {
        console.log('BODY:', chunk.toString());
    });
}).on('error', (e) => {
    console.error('ERROR:', e.message);
});
