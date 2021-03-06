const jwt = require('jsonwebtoken');
const Bundler = require('parcel-bundler');
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
fs.writeFileSync(`${__dirname}/dist/config.json`, `{ "apiBaseUrl": "http://localhost:3000" }`);

var key = fs.readFileSync(__dirname + '/selfsigned.key');
var cert = fs.readFileSync(__dirname + '/selfsigned.crt');

const signPrivKey = fs.readFileSync(__dirname + '/signPriv.pem', 'utf-8');
var options = {
    key: key,
    cert: cert
};
const bundler = new Bundler(['src/index.html', 'src/login.html'], {
    cache: false,
    https: true,
});

const app = express();
const PORT = process.env.PORT || 1234;
app.use(bundler.middleware());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('loginTries', 0);
app.post("/login", (request, response) => {
    const userId = request.body.id;
    const maxTries = 5;
    const tries = app.get('loginTries');
    if (tries > maxTries) {
        response
            .redirect(302, `/login.html?tries=${tries}`)
        return;
    }
    if (userId === 'anon' && request.body.password === '123') {
        const token = jwt.sign({ userId }, signPrivKey, { algorithm: 'RS256', expiresIn: "1d" });
        response
            .cookie("__Secure-access_token", token, { sameSite: 'strict', maxAge: 60000, secure: true })
            .redirect(302, "/")
        app.set('loginTries', 0);
        return;
    }
    const newTries = tries + 1;
    app.set('loginTries', newTries);

    if (newTries === 5) {
        setInterval(() => {
            app.set('loginTries', 0);
        }, 5 * 60 * 1000);
    }

    response
        .redirect(302, `/login.html?tries=${newTries}`)

});

app.get('*', (req, res, next) => {
    req.url = '/index.html';
    app._router.handle(req, res, next);
});

var server = https.createServer(options, app);

server.listen(PORT, () => {
    console.log(`dev server ready at https://localhost:${PORT}`);
});