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
const JWT_SECRET = process.env.JWT_SECRET || 'tarnov-platform-secret-2024';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@tarnov.uz';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'superadmin2024';

// ═══ PAPKALAR ═══
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'public', 'uploads');
[dataDir, uploadDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ═══ MULTER ═══
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? cb(null, true) : cb(new Error('Faqat rasm'));
  }
});

// ═══ DATA FUNCTIONS ═══
const platformFile = path.join(dataDir, 'platform.json');

function loadPlatform() {
  if (!fs.existsSync(platformFile)) {
    const d = {
      superAdminHash: bcrypt.hashSync(SUPER_ADMIN_PASSWORD, 10),
      restaurants: [
        {
          id: 'tarnov',
          name: 'Tarnov Oilaviy Restoran',
          slug: 'tarnov',
          logo: null,
          adminEmail: 'tarnov@admin.uz',
          adminPasswordHash: bcrypt.hashSync('tarnov2024', 10),
          plan: 'pro',
          active: true,
          createdAt: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(platformFile, JSON.stringify(d, null, 2));
    return d;
  }
  return JSON.parse(fs.readFileSync(platformFile, 'utf8'));
}

function savePlatform(d) { fs.writeFileSync(platformFile, JSON.stringify(d, null, 2)); }

function getRestaurantFile(slug) { return path.join(dataDir, `${slug}.json`); }

function loadRestaurant(slug) {
  const file = getRestaurantFile(slug);
  if (!fs.existsSync(file)) {
    const d = {
      foods: [],
      officers: [],
      testDays: [],
      results: [],
      announcements: []
    };
    // Tarnov uchun default ma'lumotlar
    if (slug === 'tarnov') {
      d.foods = [
        { id: '1', name: "Toshkent oshi", cat: "Asosiy taomlar", price: 45000, portion: "350 gr", time: "25-30 daqiqa", emoji: "🍛", img: null, ingredients: "Guruch, sabzi, qizil piyoz, mol go'shti, mosh, o'simlik moyi, zira", allergens: "Yong'oq yo'q, glutensiz", drinks: "Ko'k choy, ayron", phrase: "Bizning eng mashhur taomimiz", questions: [{ id: 'q1', text: "Toshkent oshi tarkibida nima bor?", level: "easy" }, { id: 'q2', text: "Tayyorlanish vaqti?", level: "easy" }, { id: 'q3', text: "Qaysi ichimlik mos?", level: "medium" }] },
        { id: '2', name: "Mastava", cat: "Sho'rvalar", price: 32000, portion: "400 ml", time: "20-25 daqiqa", emoji: "🍲", img: null, ingredients: "Go'sht, kartoshka, sabzi, piyoz, pomidor, sholi", allergens: "Yo'q", drinks: "Non, choy", phrase: "Issiq va to'yimli", questions: [{ id: 'q4', text: "Mastava tarkibi?", level: "easy" }, { id: 'q5', text: "Necha ml?", level: "medium" }] },
        { id: '3', name: "Tandir kabob", cat: "Asosiy taomlar", price: 68000, portion: "250 gr", time: "35-40 daqiqa", emoji: "🍖", img: null, ingredients: "Qo'y go'shti, piyoz, zira, qalampir", allergens: "Yo'q", drinks: "Qovoq sharbati", phrase: "Tandirda yetilgan", questions: [{ id: 'q6', text: "Necha daqiqada tayyorlanadi?", level: "hard" }, { id: 'q7', text: "Qaysi go'shtdan?", level: "medium" }] }
      ];
    }
    fs.writeFileSync(file, JSON.stringify(d, null, 2));
    return d;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveRestaurant(slug, d) { fs.writeFileSync(getRestaurantFile(slug), JSON.stringify(d, null, 2)); }

// ═══ MIDDLEWARE ═══
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ═══ AUTH MIDDLEWARE ═══
function authSuper(req, res, next) {
  const token = req.cookies.superToken || req.headers['x-super-token'];
  if (!token) return res.status(401).json({ error: 'Kirish taqiqlangan' });
  try { const d = jwt.verify(token, JWT_SECRET); if (d.role !== 'super') throw new Error(); next(); }
  catch { res.status(401).json({ error: 'Token yaroqsiz' }); }
}

function authAdmin(req, res, next) {
  const token = req.cookies.adminToken || req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Kirish taqiqlangan' });
  try { const d = jwt.verify(token, JWT_SECRET); if (d.role !== 'admin') throw new Error(); req.restaurantSlug = d.slug; req.restaurantName = d.name; next(); }
  catch { res.status(401).json({ error: 'Token yaroqsiz' }); }
}

function authOfficer(req, res, next) {
  const token = req.cookies.officerToken || req.headers['x-officer-token'];
  if (!token) return res.status(401).json({ error: 'Kirish taqiqlangan' });
  try { const d = jwt.verify(token, JWT_SECRET); if (d.role !== 'officer') throw new Error(); req.officer = d; req.restaurantSlug = d.slug; next(); }
  catch { res.status(401).json({ error: 'Token yaroqsiz' }); }
}

// ═══ AUTH ROUTES ═══
app.get('/api/auth/check', (req, res) => {
  const tokens = [
    { key: 'superToken', role: 'super' },
    { key: 'adminToken', role: 'admin' },
    { key: 'officerToken', role: 'officer' }
  ];
  for (const t of tokens) {
    const token = req.cookies[t.key];
    if (token) {
      try {
        const d = jwt.verify(token, JWT_SECRET);
        return res.json(d);
      } catch {}
    }
  }
  res.json({ role: 'guest' });
});

// Super Admin login
app.post('/api/super/login', (req, res) => {
  const { email, password } = req.body;
  const platform = loadPlatform();
  if (email !== SUPER_ADMIN_EMAIL || !bcrypt.compareSync(password, platform.superAdminHash))
    return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
  const token = jwt.sign({ role: 'super', email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('superToken', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, token });
});

// Restaurant Admin login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const platform = loadPlatform();
  const restaurant = platform.restaurants.find(r => r.adminEmail === email && r.active);
  if (!restaurant || !bcrypt.compareSync(password, restaurant.adminPasswordHash))
    return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri' });
  const token = jwt.sign({ role: 'admin', slug: restaurant.slug, name: restaurant.name, id: restaurant.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('adminToken', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, token, restaurant: { slug: restaurant.slug, name: restaurant.name } });
});

// Officer login
app.post('/api/officer/login', (req, res) => {
  const { slug, pin } = req.body;
  const platform = loadPlatform();
  const restaurant = platform.restaurants.find(r => r.slug === slug && r.active);
  if (!restaurant) return res.status(404).json({ error: 'Restoran topilmadi' });
  const data = loadRestaurant(slug);
  const officer = data.officers.find(o => o.pin === pin && o.active);
  if (!officer) return res.status(401).json({ error: 'PIN noto\'g\'ri' });
  const token = jwt.sign({ role: 'officer', id: officer.id, name: officer.name, slug }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('officerToken', token, { httpOnly: true, maxAge: 12 * 60 * 60 * 1000 });
  res.json({ success: true, token, officer: { id: officer.id, name: officer.name, slug }, restaurant: { name: restaurant.name } });
});

app.post('/api/logout', (req, res) => {
  ['superToken', 'adminToken', 'officerToken'].forEach(c => res.clearCookie(c));
  res.json({ success: true });
});

// ═══ SUPER ADMIN ROUTES ═══
app.get('/api/super/stats', authSuper, (req, res) => {
  const platform = loadPlatform();
  const stats = platform.restaurants.map(r => {
    const data = loadRestaurant(r.slug);
    return {
      ...r,
      adminPasswordHash: undefined,
      foodsCount: data.foods.length,
      officersCount: data.officers.length,
      resultsCount: data.results.length,
      lastActivity: data.results.length ? data.results[data.results.length - 1].createdAt : null
    };
  });
  res.json(stats);
});

app.get('/api/super/restaurants', authSuper, (req, res) => {
  const platform = loadPlatform();
  res.json(platform.restaurants.map(r => ({ ...r, adminPasswordHash: undefined })));
});

app.post('/api/super/restaurants', authSuper, (req, res) => {
  const { name, slug, adminEmail, adminPassword, plan } = req.body;
  if (!name || !slug || !adminEmail || !adminPassword) return res.status(400).json({ error: 'Barcha maydonlar kerak' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Slug faqat kichik harf, raqam va - bo\'lishi mumkin' });
  const platform = loadPlatform();
  if (platform.restaurants.find(r => r.slug === slug)) return res.status(400).json({ error: 'Bu slug band' });
  if (platform.restaurants.find(r => r.adminEmail === adminEmail)) return res.status(400).json({ error: 'Bu email band' });
  const restaurant = {
    id: uuidv4(), name, slug, logo: null, adminEmail,
    adminPasswordHash: bcrypt.hashSync(adminPassword, 10),
    plan: plan || 'starter', active: true, createdAt: new Date().toISOString()
  };
  platform.restaurants.push(restaurant);
  savePlatform(platform);
  loadRestaurant(slug); // Default fayl yaratish
  res.json({ success: true, restaurant: { ...restaurant, adminPasswordHash: undefined } });
});

app.put('/api/super/restaurants/:slug', authSuper, (req, res) => {
  const platform = loadPlatform();
  const idx = platform.restaurants.findIndex(r => r.slug === req.params.slug);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
  const { name, adminPassword, plan, active } = req.body;
  if (name) platform.restaurants[idx].name = name;
  if (adminPassword) platform.restaurants[idx].adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
  if (plan) platform.restaurants[idx].plan = plan;
  if (active !== undefined) platform.restaurants[idx].active = active;
  savePlatform(platform);
  res.json({ success: true });
});

app.delete('/api/super/restaurants/:slug', authSuper, (req, res) => {
  const platform = loadPlatform();
  platform.restaurants = platform.restaurants.filter(r => r.slug !== req.params.slug);
  savePlatform(platform);
  res.json({ success: true });
});

// ═══ ADMIN: FOODS ═══
app.get('/api/foods', (req, res) => {
  const token = req.cookies.officerToken || req.cookies.adminToken;
  let slug = req.query.slug;
  if (!slug && token) {
    try { const d = jwt.verify(token, JWT_SECRET); slug = d.slug; } catch {}
  }
  if (!slug) return res.status(400).json({ error: 'Slug kerak' });
  const data = loadRestaurant(slug);
  const today = new Date().toISOString().split('T')[0];
  const isTestDay = (data.testDays || []).includes(today);
  if (isTestDay && req.cookies.officerToken) return res.json({ testDay: true, foods: [] });
  res.json({ testDay: false, foods: data.foods });
});

app.post('/api/foods', authAdmin, upload.single('img'), (req, res) => {
  try {
    const data = loadRestaurant(req.restaurantSlug);
    const body = req.body;
    const food = {
      id: uuidv4(), name: body.name, cat: body.cat,
      price: parseInt(body.price) || 0, portion: body.portion || '',
      time: body.time || '', emoji: body.emoji || '🍽',
      img: req.file ? '/uploads/' + req.file.filename : null,
      ingredients: body.ingredients || '', allergens: body.allergens || '',
      drinks: body.drinks || '', phrase: body.phrase || '',
      questions: (body.questions ? JSON.parse(body.questions) : []).map(q => ({ id: uuidv4(), text: q.text, level: q.level || 'easy' }))
    };
    data.foods.push(food);
    saveRestaurant(req.restaurantSlug, data);
    res.json({ success: true, food });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/foods/:id', authAdmin, upload.single('img'), (req, res) => {
  try {
    const data = loadRestaurant(req.restaurantSlug);
    const idx = data.foods.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
    const body = req.body;
    const existing = data.foods[idx];
    if (req.file && existing.img) {
      const old = path.join(__dirname, 'public', existing.img);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    data.foods[idx] = {
      ...existing, name: body.name || existing.name, cat: body.cat || existing.cat,
      price: parseInt(body.price) || existing.price, portion: body.portion || existing.portion,
      time: body.time || existing.time, emoji: body.emoji || existing.emoji,
      img: req.file ? '/uploads/' + req.file.filename : (body.removeImg === 'true' ? null : existing.img),
      ingredients: body.ingredients !== undefined ? body.ingredients : existing.ingredients,
      allergens: body.allergens !== undefined ? body.allergens : existing.allergens,
      drinks: body.drinks !== undefined ? body.drinks : existing.drinks,
      phrase: body.phrase !== undefined ? body.phrase : existing.phrase,
      questions: body.questions ? JSON.parse(body.questions).map(q => ({ id: q.id || uuidv4(), text: q.text, level: q.level || 'easy' })) : existing.questions
    };
    saveRestaurant(req.restaurantSlug, data);
    res.json({ success: true, food: data.foods[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/foods/:id', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  const food = data.foods.find(f => f.id === req.params.id);
  if (!food) return res.status(404).json({ error: 'Topilmadi' });
  if (food.img) { const p = path.join(__dirname, 'public', food.img); if (fs.existsSync(p)) fs.unlinkSync(p); }
  data.foods = data.foods.filter(f => f.id !== req.params.id);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

// ═══ ADMIN: OFFICERS ═══
app.get('/api/officers', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  res.json(data.officers.map(o => ({ ...o, pin: '****' })));
});

app.post('/api/officers', authAdmin, (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin || pin.length !== 4 || !/^\d+$/.test(pin)) return res.status(400).json({ error: 'Ism va 4 raqamli PIN kerak' });
  const data = loadRestaurant(req.restaurantSlug);
  if (data.officers.find(o => o.pin === pin)) return res.status(400).json({ error: 'Bu PIN band' });
  const officer = { id: uuidv4(), name, pin, active: true, createdAt: new Date().toISOString() };
  data.officers.push(officer);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true, officer: { ...officer, pin: '****' } });
});

app.put('/api/officers/:id', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  const idx = data.officers.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
  const { name, pin, active } = req.body;
  if (pin && data.officers.find(o => o.pin === pin && o.id !== req.params.id)) return res.status(400).json({ error: 'Bu PIN band' });
  data.officers[idx] = { ...data.officers[idx], ...(name && { name }), ...(pin && { pin }), ...(active !== undefined && { active }) };
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

app.delete('/api/officers/:id', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  data.officers = data.officers.filter(o => o.id !== req.params.id);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

// ═══ TEST DAYS ═══
app.get('/api/testdays', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  res.json(data.testDays || []);
});

app.post('/api/testdays', authAdmin, (req, res) => {
  const { date } = req.body;
  const data = loadRestaurant(req.restaurantSlug);
  if (!data.testDays.includes(date)) data.testDays.push(date);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

app.delete('/api/testdays/:date', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  data.testDays = data.testDays.filter(d => d !== req.params.date);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

app.get('/api/testdays/today', (req, res) => {
  const token = req.cookies.officerToken || req.cookies.adminToken;
  let slug = req.query.slug;
  if (!slug && token) { try { const d = jwt.verify(token, JWT_SECRET); slug = d.slug; } catch {} }
  if (!slug) return res.json({ isTestDay: false });
  const data = loadRestaurant(slug);
  const today = new Date().toISOString().split('T')[0];
  res.json({ isTestDay: (data.testDays || []).includes(today), date: today });
});

// ═══ TEST QUESTIONS ═══
app.get('/api/test/questions', authOfficer, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
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
  const pick = (arr, n) => arr.sort(() => Math.random() - .5).slice(0, Math.min(n, arr.length));
  const questions = [...pick(easy, 10), ...pick(medium, 5), ...pick(hard, 5)].sort(() => Math.random() - .5);
  res.json({ questions, counts: { easy: easy.length, medium: medium.length, hard: hard.length } });
});

// ═══ RESULTS ═══
app.post('/api/results', authOfficer, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  const { score, total, pct, details, duration } = req.body;
  const result = {
    id: uuidv4(), officerId: req.officer.id, officerName: req.officer.name,
    score, total, pct, details: details || [], duration: duration || 0,
    date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString()
  };
  if (!data.results) data.results = [];
  data.results.push(result);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true, result });
});

app.get('/api/results', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  res.json(data.results || []);
});

app.get('/api/results/my', authOfficer, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  res.json((data.results || []).filter(r => r.officerId === req.officer.id));
});

app.get('/api/leaderboard', (req, res) => {
  const token = req.cookies.officerToken || req.cookies.adminToken;
  let slug = req.query.slug;
  if (!slug && token) { try { const d = jwt.verify(token, JWT_SECRET); slug = d.slug; } catch {} }
  if (!slug) return res.json([]);
  const data = loadRestaurant(slug);
  const lb = {};
  (data.results || []).forEach(r => {
    if (!lb[r.officerId]) lb[r.officerId] = { name: r.officerName, pct: 0, tests: 0 };
    if (r.pct > lb[r.officerId].pct) lb[r.officerId].pct = r.pct;
    lb[r.officerId].tests++;
  });
  res.json(Object.values(lb).sort((a, b) => b.pct - a.pct));
});

// ═══ ANNOUNCEMENTS ═══
app.get('/api/announcements', (req, res) => {
  const token = req.cookies.officerToken || req.cookies.adminToken;
  let slug = req.query.slug;
  if (!slug && token) { try { const d = jwt.verify(token, JWT_SECRET); slug = d.slug; } catch {} }
  if (!slug) return res.json([]);
  const data = loadRestaurant(slug);
  res.json((data.announcements || []).slice(-5).reverse());
});

app.post('/api/announcements', authAdmin, (req, res) => {
  const { text, important } = req.body;
  if (!text) return res.status(400).json({ error: 'Matn kerak' });
  const data = loadRestaurant(req.restaurantSlug);
  if (!data.announcements) data.announcements = [];
  data.announcements.push({ id: uuidv4(), text, important: !!important, createdAt: new Date().toISOString() });
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

app.delete('/api/announcements/:id', authAdmin, (req, res) => {
  const data = loadRestaurant(req.restaurantSlug);
  data.announcements = (data.announcements || []).filter(a => a.id !== req.params.id);
  saveRestaurant(req.restaurantSlug, data);
  res.json({ success: true });
});

// ═══ RESTAURANTS LIST (for officer login) ═══
app.get('/api/restaurants', (req, res) => {
  const platform = loadPlatform();
  res.json(platform.restaurants.filter(r => r.active).map(r => ({ slug: r.slug, name: r.name, logo: r.logo })));
});

// SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Tarnov Platform 3.0 ishga tushdi: http://localhost:${PORT}`));
