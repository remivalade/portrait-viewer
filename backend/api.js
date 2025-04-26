import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/api/portraits', (req, res) => {
  const page  = Number(req.query.page  || 1);
  const limit = Number(req.query.limit || 50);

  // read the latest cache
  const data = JSON.parse(
    fs.readFileSync(path.resolve('./backend/cache.json'))
  );

  const start = (page - 1) * limit;
  res.json({
    page,
    total: data.length,
    portraits: data.slice(start, start + limit)
  });
});

app.listen(3001, () =>
  console.log('🖥️  API → http://localhost:3001/api/portraits?page=1&limit=3')
);
