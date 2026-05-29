const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Upload papkasini yaratish
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer - rasm yuklash sozlamasi
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Faqat JPG, PNG, WEBP formatlar qabul qilinadi'));
  }
});

// Ma'lumotlar (JSON fayl sifatida saqlanadi)
const dataFile = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(dataFile)) {
    const defaultData = {
      foods: [
        {
          id: "1",
          name: "Toshkent oshi",
          cat: "Asosiy taomlar",
          price: 45000,
          portion: "350 gr",
          time: "25-30 daqiqa",
          emoji: "🍛",
          img: null,
          ingredients: "Guruch, sabzi, qizil piyoz, mol go'shti, mosh, o'simlik moyi, zira",
          allergens: "Yong'oq yo'q, glutensiz",
          drinks: "Ko'k choy, ayron",
          phrase: "Bizning eng mashhur taomimiz — ko'pchilik qaytib kelganida aynan shu taomni buyurtma qiladi",
          questions: ["Toshkent oshi tarkibida nima bor?", "Tayyorlanish vaqti qancha?", "Qaysi ichimlik mos keladi?"]
        },
        {
          id: "2",
          name: "Mastava",
          cat: "Sho'rvalar",
          price: 32000,
          portion: "400 ml",
          time: "20-25 daqiqa",
          emoji: "🍲",
          img: null,
          ingredients: "Go'sht, kartoshka, sabzi, piyoz, pomidor, sholi, ziravorlar",
          allergens: "Yo'q",
          drinks: "Non, achiq ko'k choy",
          phrase: "Issiq va to'yimli — ayniqsa kuzda va qishda mehmonlar ko'p buyurtma qiladi",
          questions: ["Mastava tarkibida nima bor?", "Mastava necha ml beriladi?"]
        },
        {
          id: "3",
          name: "Tandir kabob",
          cat: "Asosiy taomlar",
          price: 68000,
          portion: "250 gr",
          time: "35-40 daqiqa",
          emoji: "🍖",
          img: null,
          ingredients: "Qo'y go'shti, piyoz, zira, qalampir, tuz",
          allergens: "Yo'q",
          drinks: "Qovoq sharbati, limonli suv",
          phrase: "Bizning tandirda yetilgan kabobimiz — boshqa joyda bunday ta'mni topolmaysiz",
          questions: ["Tandir kabob necha daqiqada tayyorlanadi?", "Qaysi go'shtdan tayyorlanadi?"]
        }
      ],
      leaderboard: [
        { name: "Dilnoza S.", score: 92, tests: 5 },
        { name: "Jasur T.", score: 85, tests: 4 },
        { name: "Malika R.", score: 78, tests: 6 }
      ]
    };
    fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════
// API ROUTES
// ═══════════════════════════

// Barcha taomlarni olish
app.get('/api/foods', (req, res) => {
  const data = loadData();
  res.json(data.foods);
});

// Taom qo'shish
app.post('/api/foods', upload.single('img'), (req, res) => {
  try {
    const data = loadData();
    const body = req.body;
    const food = {
      id: uuidv4(),
      name: body.name,
      cat: body.cat,
      price: parseInt(body.price) || 0,
      portion: body.portion || '',
      time: body.time || '',
      emoji: body.emoji || '🍽',
      img: req.file ? '/uploads/' + req.file.filename : null,
      ingredients: body.ingredients || '',
      allergens: body.allergens || '',
      drinks: body.drinks || '',
      phrase: body.phrase || '',
      questions: body.questions ? JSON.parse(body.questions) : []
    };
    data.foods.push(food);
    saveData(data);
    res.json({ success: true, food });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Taomni yangilash
app.put('/api/foods/:id', upload.single('img'), (req, res) => {
  try {
    const data = loadData();
    const idx = data.foods.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });

    const body = req.body;
    const existing = data.foods[idx];

    // Eski rasmni o'chirish (yangi yuklansa)
    if (req.file && existing.img) {
      const oldPath = path.join(__dirname, 'public', existing.img);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    data.foods[idx] = {
      ...existing,
      name: body.name || existing.name,
      cat: body.cat || existing.cat,
      price: parseInt(body.price) || existing.price,
      portion: body.portion || existing.portion,
      time: body.time || existing.time,
      emoji: body.emoji || existing.emoji,
      img: req.file ? '/uploads/' + req.file.filename : (body.removeImg === 'true' ? null : existing.img),
      ingredients: body.ingredients !== undefined ? body.ingredients : existing.ingredients,
      allergens: body.allergens !== undefined ? body.allergens : existing.allergens,
      drinks: body.drinks !== undefined ? body.drinks : existing.drinks,
      phrase: body.phrase !== undefined ? body.phrase : existing.phrase,
      questions: body.questions ? JSON.parse(body.questions) : existing.questions
    };
    saveData(data);
    res.json({ success: true, food: data.foods[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Taomni o'chirish
app.delete('/api/foods/:id', (req, res) => {
  try {
    const data = loadData();
    const food = data.foods.find(f => f.id === req.params.id);
    if (!food) return res.status(404).json({ error: 'Topilmadi' });

    // Rasmni o'chirish
    if (food.img) {
      const imgPath = path.join(__dirname, 'public', food.img);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    data.foods = data.foods.filter(f => f.id !== req.params.id);
    saveData(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reyting olish
app.get('/api/leaderboard', (req, res) => {
  const data = loadData();
  res.json(data.leaderboard);
});

// Reyting qo'shish
app.post('/api/leaderboard', (req, res) => {
  try {
    const data = loadData();
    const { name, score } = req.body;
    const existing = data.leaderboard.findIndex(l => l.name === name);
    if (existing >= 0) {
      data.leaderboard[existing].score = Math.max(data.leaderboard[existing].score, score);
      data.leaderboard[existing].tests = (data.leaderboard[existing].tests || 0) + 1;
    } else {
      data.leaderboard.push({ name, score, tests: 1 });
    }
    data.leaderboard.sort((a, b) => b.score - a.score);
    data.leaderboard = data.leaderboard.slice(0, 20);
    saveData(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Barcha so'rovlar uchun index.html qaytarish
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Tarnov tizimi ishga tushdi: http://localhost:${PORT}`);
});
