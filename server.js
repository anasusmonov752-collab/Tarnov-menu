const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tarnov-secret-2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tarnov2024';

// Papkalar
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ['image/jpeg','image/png','image/webp'].includes(file.mimetype) ? cb(null,true) : cb(new Error('Faqat rasm'));
  }
});

// Data
const dataFile = path.join(__dirname, 'data.json');
function loadData() {
  if (!fs.existsSync(dataFile)) {
    const d = {
      adminPasswordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      officers: [],
      foods: [
        { id:'1', name:'Toshkent oshi', cat:'Asosiy taomlar', price:45000, portion:'350 gr', time:'25-30 daqiqa', emoji:'🍛', img:null,
          ingredients:'Guruch, sabzi, qizil piyoz, mol go\'shti, mosh, o\'simlik moyi, zira',
          allergens:'Yong\'oq yo\'q, glutensiz', drinks:'Ko\'k choy, ayron',
          phrase:'Bizning eng mashhur taomimiz — ko\'pchilik qaytib kelganida aynan shu taomni buyurtma qiladi',
          questions:[
            { id:'q1', text:'Toshkent oshi tarkibida nima bor?', level:'easy' },
            { id:'q2', text:'Toshkent oshi tayyorlanish vaqti qancha?', level:'easy' },
            { id:'q3', text:'Toshkent oshi qaysi ichimlik bilan tavsiya qilinadi?', level:'medium' }
          ]
        },
        { id:'2', name:'Mastava', cat:"Sho'rvalar", price:32000, portion:'400 ml', time:'20-25 daqiqa', emoji:'🍲', img:null,
          ingredients:'Go\'sht, kartoshka, sabzi, piyoz, pomidor, sholi, ziravorlar',
          allergens:'Yo\'q', drinks:'Non, achiq ko\'k choy',
          phrase:'Issiq va to\'yimli — ayniqsa kuzda va qishda mehmonlar ko\'p buyurtma qiladi',
          questions:[
            { id:'q4', text:'Mastava tarkibida nima bor?', level:'easy' },
            { id:'q5', text:'Mastava necha ml beriladi?', level:'medium' }
          ]
        },
        { id:'3', name:'Tandir kabob', cat:'Asosiy taomlar', price:68000, portion:'250 gr', time:'35-40 daqiqa', emoji:'🍖', img:null,
          ingredients:'Qo\'y go\'shti, piyoz, zira, qalampir, tuz',
          allergens:'Yo\'q', drinks:'Qovoq sharbati, limonli suv',
          phrase:'Bizning tandirda yetilgan kabobimiz — boshqa joyda bunday ta\'mni topolmaysiz',
          questions:[
            { id:'q6', text:'Tandir kabob necha daqiqada tayyorlanadi?', level:'hard' },
            { id:'q7', text:'Tandir kabob qaysi go\'shtdan tayyorlanadi?', level:'medium' }
          ]
        }
      ],
      testDays: [],
      results: []
    };
    fs.writeFileSync(dataFile, JSON.stringify(d, null, 2));
    return d;
  }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}
function saveData(d) { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)); }

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function authAdmin(req, res, next) {
  const token = req.cookies.adminToken || req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Kirish taqiqlangan' });
  try { jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Token yaroqsiz' }); }
}
function authOfficer(req, res, next) {
  const token = req.cookies.officerToken || req.headers['x-officer-token'];
  if (!token) return res.status(401).json({ error: 'Kirish taqiqlangan' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.officer = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token yaroqsiz' }); }
}

// ═══ AUTH ═══
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const data = loadData();
  if (!bcrypt.compareSync(password, data.adminPasswordHash))
    return res.status(401).json({ error: 'Parol noto\'g\'ri' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('adminToken', token, { httpOnly: true, maxAge: 7*24*60*60*1000 });
  res.json({ success: true, token });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

app.post('/api/admin/change-password', authAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Parol kamida 4 ta belgi' });
  const data = loadData();
  data.adminPasswordHash = bcrypt.hashSync(newPassword, 10);
  saveData(data);
  res.json({ success: true });
});

app.post('/api/officer/login', (req, res) => {
  const { pin } = req.body;
  const data = loadData();
  const officer = data.officers.find(o => o.pin === pin && o.active);
  if (!officer) return res.status(401).json({ error: 'PIN noto\'g\'ri yoki faol emas' });
  const token = jwt.sign({ id: officer.id, name: officer.name, role: 'officer' }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('officerToken', token, { httpOnly: true, maxAge: 12*60*60*1000 });
  res.json({ success: true, token, officer: { id: officer.id, name: officer.name } });
});

app.post('/api/officer/logout', (req, res) => {
  res.clearCookie('officerToken');
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  const adminToken = req.cookies.adminToken;
  const officerToken = req.cookies.officerToken;
  if (adminToken) {
    try { jwt.verify(adminToken, JWT_SECRET); return res.json({ role: 'admin' }); } catch {}
  }
  if (officerToken) {
    try {
      const d = jwt.verify(officerToken, JWT_SECRET);
      return res.json({ role: 'officer', id: d.id, name: d.name });
    } catch {}
  }
  res.json({ role: 'guest' });
});

// ═══ OFFICERS ═══
app.get('/api/officers', authAdmin, (req, res) => {
  const data = loadData();
  res.json(data.officers.map(o => ({ ...o, pin: '****' })));
});

app.post('/api/officers', authAdmin, (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin || pin.length < 4) return res.status(400).json({ error: 'Ism va 4 xonali PIN kerak' });
  const data = loadData();
  if (data.officers.find(o => o.pin === pin)) return res.status(400).json({ error: 'Bu PIN band' });
  const officer = { id: uuidv4(), name, pin, active: true, createdAt: new Date().toISOString() };
  data.officers.push(officer);
  saveData(data);
  res.json({ success: true, officer: { ...officer, pin: '****' } });
});

app.put('/api/officers/:id', authAdmin, (req, res) => {
  const data = loadData();
  const idx = data.officers.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
  const { name, pin, active } = req.body;
  if (pin && data.officers.find(o => o.pin === pin && o.id !== req.params.id))
    return res.status(400).json({ error: 'Bu PIN band' });
  data.officers[idx] = { ...data.officers[idx], ...(name && { name }), ...(pin && { pin }), ...(active !== undefined && { active }) };
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/officers/:id', authAdmin, (req, res) => {
  const data = loadData();
  data.officers = data.officers.filter(o => o.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

// ═══ FOODS ═══
app.get('/api/foods', (req, res) => {
  const data = loadData();
  // Test kunida ofitsiantlarga menyu ko'rsatilmaydi
  const token = req.cookies.officerToken;
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      const today = new Date().toISOString().split('T')[0];
      if (data.testDays.includes(today)) return res.json({ testDay: true, foods: [] });
    } catch {}
  }
  res.json({ testDay: false, foods: data.foods });
});

app.post('/api/foods', authAdmin, upload.single('img'), (req, res) => {
  try {
    const data = loadData();
    const body = req.body;
    const questions = body.questions ? JSON.parse(body.questions) : [];
    const food = {
      id: uuidv4(), name: body.name, cat: body.cat,
      price: parseInt(body.price) || 0, portion: body.portion || '',
      time: body.time || '', emoji: body.emoji || '🍽',
      img: req.file ? '/uploads/' + req.file.filename : null,
      ingredients: body.ingredients || '', allergens: body.allergens || '',
      drinks: body.drinks || '', phrase: body.phrase || '',
      questions: questions.map(q => ({ id: uuidv4(), text: q.text, level: q.level || 'easy' }))
    };
    data.foods.push(food);
    saveData(data);
    res.json({ success: true, food });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/foods/:id', authAdmin, upload.single('img'), (req, res) => {
  try {
    const data = loadData();
    const idx = data.foods.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
    const body = req.body;
    const existing = data.foods[idx];
    if (req.file && existing.img) {
      const old = path.join(__dirname, 'public', existing.img);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const questions = body.questions ? JSON.parse(body.questions) : existing.questions;
    data.foods[idx] = {
      ...existing, name: body.name || existing.name, cat: body.cat || existing.cat,
      price: parseInt(body.price) || existing.price, portion: body.portion || existing.portion,
      time: body.time || existing.time, emoji: body.emoji || existing.emoji,
      img: req.file ? '/uploads/' + req.file.filename : (body.removeImg === 'true' ? null : existing.img),
      ingredients: body.ingredients !== undefined ? body.ingredients : existing.ingredients,
      allergens: body.allergens !== undefined ? body.allergens : existing.allergens,
      drinks: body.drinks !== undefined ? body.drinks : existing.drinks,
      phrase: body.phrase !== undefined ? body.phrase : existing.phrase,
      questions: questions.map(q => ({ id: q.id || uuidv4(), text: q.text, level: q.level || 'easy' }))
    };
    saveData(data);
    res.json({ success: true, food: data.foods[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/foods/:id', authAdmin, (req, res) => {
  try {
    const data = loadData();
    const food = data.foods.find(f => f.id === req.params.id);
    if (!food) return res.status(404).json({ error: 'Topilmadi' });
    if (food.img) { const p = path.join(__dirname, 'public', food.img); if (fs.existsSync(p)) fs.unlinkSync(p); }
    data.foods = data.foods.filter(f => f.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══ TEST DAYS ═══
app.get('/api/testdays', authAdmin, (req, res) => {
  const data = loadData();
  res.json(data.testDays || []);
});

app.post('/api/testdays', authAdmin, (req, res) => {
  const { date } = req.body;
  const data = loadData();
  if (!data.testDays.includes(date)) data.testDays.push(date);
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/testdays/:date', authAdmin, (req, res) => {
  const data = loadData();
  data.testDays = data.testDays.filter(d => d !== req.params.date);
  saveData(data);
  res.json({ success: true });
});

app.get('/api/testdays/today', (req, res) => {
  const data = loadData();
  const today = new Date().toISOString().split('T')[0];
  res.json({ isTestDay: data.testDays.includes(today), date: today });
});

// ═══ TEST QUESTIONS (officer uchun) ═══
app.get('/api/test/questions', authOfficer, (req, res) => {
  const data = loadData();
  const easy = [], medium = [], hard = [];
  data.foods.forEach(f => {
    (f.questions || []).forEach(q => {
      const wrongs = data.foods.filter(x => x.id !== f.id).map(x => x.name).sort(() => Math.random() - .5).slice(0, 3);
      const opts = [f.name, ...wrongs].sort(() => Math.random() - .5);
      const item = { id: q.id, question: q.text, level: q.level, correct: f.name, options: opts, foodName: f.name };
      if (q.level === 'easy') easy.push(item);
      else if (q.level === 'medium') medium.push(item);
      else hard.push(item);
    });
  });
  // 10 oson + 5 o'rta + 5 qiyin (yetarli bo'lmasa bor narsadan oladi)
  const pick = (arr, n) => arr.sort(() => Math.random() - .5).slice(0, Math.min(n, arr.length));
  const questions = [...pick(easy, 10), ...pick(medium, 5), ...pick(hard, 5)].sort(() => Math.random() - .5);
  res.json({ questions, counts: { easy: easy.length, medium: medium.length, hard: hard.length } });
});

// ═══ RESULTS ═══
app.post('/api/results', authOfficer, (req, res) => {
  try {
    const data = loadData();
    const { score, total, pct, details, duration } = req.body;
    const result = {
      id: uuidv4(), officerId: req.officer.id, officerName: req.officer.name,
      score, total, pct, details: details || [], duration: duration || 0,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    if (!data.results) data.results = [];
    data.results.push(result);
    saveData(data);
    res.json({ success: true, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/results', authAdmin, (req, res) => {
  const data = loadData();
  res.json(data.results || []);
});

app.get('/api/results/my', authOfficer, (req, res) => {
  const data = loadData();
  const mine = (data.results || []).filter(r => r.officerId === req.officer.id);
  res.json(mine);
});

app.get('/api/leaderboard', (req, res) => {
  const data = loadData();
  const lb = {};
  (data.results || []).forEach(r => {
    if (!lb[r.officerId] || lb[r.officerId].pct < r.pct) {
      lb[r.officerId] = { name: r.officerName, pct: r.pct, tests: 0 };
    }
    if (!lb[r.officerId].tests) lb[r.officerId].tests = 0;
    lb[r.officerId].tests++;
  });
  const list = Object.values(lb).sort((a, b) => b.pct - a.pct);
  res.json(list);
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Tarnov 2.0 ishga tushdi: http://localhost:${PORT}`));
