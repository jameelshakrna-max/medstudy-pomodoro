const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.all('/notion/*', (req, res) => {
  const token      = req.headers['x-notion-token'];
  const notionPath = req.path.replace('/notion/', '');
  const body       = (req.method !== 'GET' && req.body && Object.keys(req.body).length)
                     ? JSON.stringify(req.body) : null;
  if (!token) { res.status(400).json({ error:'No token' }); return; }

  const opts = {
    hostname:'api.notion.com', path:'/v1/' + notionPath, method:req.method,
    headers:{
      'Authorization':'Bearer ' + token,
      'Notion-Version':'2022-06-28',
      'Content-Type':'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
    },
  };
  const pr = https.request(opts, (nr) => {
    res.status(nr.statusCode).set('Content-Type','application/json');
    let d = ''; nr.on('data', c => d += c); nr.on('end', () => res.send(d));
  });
  pr.on('error', e => res.status(500).json({ error:e.message }));
  if (body) pr.write(body);
  pr.end();
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log('🍅 Pomodoro running on port ' + PORT));
