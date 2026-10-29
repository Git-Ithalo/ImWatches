const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const WATCHES_FILE = path.join(DATA_DIR, 'watches.json');
const BRANDS_FILE = path.join(DATA_DIR, 'brands.json');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');
const STORES_FILE = path.join(DATA_DIR, 'stores.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch (e) { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
if (!fs.existsSync(STORES_FILE)) writeJSON(STORES_FILE, []);

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return check === hash;
}
function slugify(str) {
  return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'imwatches-demo-secret-troque-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// makes the logged-in store available to every view
app.use((req, res, next) => {
  res.locals.currentStore = null;
  if (req.session.storeId) {
    const stores = readJSON(STORES_FILE, []);
    res.locals.currentStore = stores.find(s => s.id === req.session.storeId) || null;
  }
  res.locals.path = req.path;
  next();
});

// ---------- Institutional catalog (IM Watches curated) ----------

app.get('/', (req, res) => {
  const watches = readJSON(WATCHES_FILE, []);
  const brands = readJSON(BRANDS_FILE, []);
  const novidades = watches.filter(w => w.tag === 'novidade').slice(0, 3);
  res.render('index', { novidades, brands });
});

app.get('/pronta-entrega', (req, res) => {
  const watches = readJSON(WATCHES_FILE, []).filter(w => w.category === 'pronta-entrega');
  const brands = [...new Set(watches.map(w => w.brand))];
  let filtered = watches;
  const { marca, ordenar } = req.query;
  if (marca) filtered = filtered.filter(w => w.brand === marca);
  if (ordenar === 'menor-preco') filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (ordenar === 'maior-preco') filtered = [...filtered].sort((a, b) => b.price - a.price);
  res.render('catalogo', {
    title: 'Pronta Entrega',
    subtitle: 'Relógios revisados, prontos para envio imediato para todo o Brasil.',
    watches: filtered, brands, activeMarca: marca || '', activeOrdenar: ordenar || '', basePath: '/pronta-entrega'
  });
});

app.get('/sob-encomenda', (req, res) => {
  const watches = readJSON(WATCHES_FILE, []).filter(w => w.category === 'sob-encomenda');
  const brands = [...new Set(watches.map(w => w.brand))];
  res.render('catalogo', {
    title: 'Sob Encomenda',
    subtitle: 'Peças de alta relojoaria, localizadas sob consulta através da nossa rede de curadoria.',
    watches, brands, activeMarca: '', activeOrdenar: '', basePath: '/sob-encomenda'
  });
});

app.get('/marcas', (req, res) => {
  const brands = readJSON(BRANDS_FILE, []);
  res.render('marcas', { brands });
});

app.get('/marcas/:slug', (req, res) => {
  const brands = readJSON(BRANDS_FILE, []);
  const brand = brands.find(b => b.slug === req.params.slug);
  if (!brand) return res.status(404).render('404');
  const watches = readJSON(WATCHES_FILE, []).filter(w => w.brandSlug === brand.slug);
  res.render('marca', { brand, watches });
});

app.get('/relogio/:id', (req, res) => {
  const watch = readJSON(WATCHES_FILE, []).find(w => w.id === req.params.id);
  if (!watch) return res.status(404).render('404');
  res.render('produto', { watch });
});

app.get('/sobre', (req, res) => res.render('sobre'));
app.get('/contato', (req, res) => res.render('contato'));

// ---------- SaaS: plans, signup, dashboard, public storefronts ----------

app.get('/planos', (req, res) => {
  const plans = readJSON(PLANS_FILE, []);
  res.render('planos', { plans });
});

app.get('/cadastro', (req, res) => {
  const plans = readJSON(PLANS_FILE, []);
  res.render('cadastro', { plans, error: null, selectedPlan: req.query.plano || 'essencial' });
});

app.post('/cadastro', (req, res) => {
  const { storeName, ownerName, email, whatsapp, password, plan } = req.body;
  const stores = readJSON(STORES_FILE, []);
  const plans = readJSON(PLANS_FILE, []);

  if (!storeName || !ownerName || !email || !password) {
    return res.render('cadastro', { plans, error: 'Preencha todos os campos obrigatórios.', selectedPlan: plan || 'essencial' });
  }
  if (stores.find(s => s.email.toLowerCase() === email.toLowerCase())) {
    return res.render('cadastro', { plans, error: 'Já existe uma loja cadastrada com esse e-mail.', selectedPlan: plan || 'essencial' });
  }
  let slug = slugify(storeName);
  let unique = slug, n = 1;
  while (stores.find(s => s.slug === unique)) { unique = `${slug}-${n++}`; }

  const { salt, hash } = hashPassword(password);
  const newStore = {
    id: crypto.randomUUID(),
    slug: unique,
    storeName, ownerName, email, whatsapp: whatsapp || '',
    plan: plan || 'essencial',
    salt, hash,
    description: '',
    createdAt: new Date().toISOString(),
    watches: []
  };
  stores.push(newStore);
  writeJSON(STORES_FILE, stores);
  req.session.storeId = newStore.id;
  res.redirect('/painel');
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const stores = readJSON(STORES_FILE, []);
  const store = stores.find(s => s.email.toLowerCase() === (email || '').toLowerCase());
  if (!store || !verifyPassword(password || '', store.salt, store.hash)) {
    return res.render('login', { error: 'E-mail ou senha incorretos.' });
  }
  req.session.storeId = store.id;
  res.redirect('/painel');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

function requireStore(req, res, next) {
  if (!req.session.storeId) return res.redirect('/login');
  next();
}

app.get('/painel', requireStore, (req, res) => {
  const stores = readJSON(STORES_FILE, []);
  const store = stores.find(s => s.id === req.session.storeId);
  const plans = readJSON(PLANS_FILE, []);
  const planInfo = plans.find(p => p.slug === store.plan) || plans[0];
  res.render('painel', { store, planInfo, saved: req.query.saved || null });
});

app.post('/painel/perfil', requireStore, (req, res) => {
  const { storeName, description, whatsapp } = req.body;
  const stores = readJSON(STORES_FILE, []);
  const store = stores.find(s => s.id === req.session.storeId);
  if (store) {
    store.storeName = storeName || store.storeName;
    store.description = description || '';
    store.whatsapp = whatsapp || '';
    writeJSON(STORES_FILE, stores);
  }
  res.redirect('/painel?saved=perfil');
});

app.post('/painel/relogios', requireStore, (req, res) => {
  const { brand, model, ref, price, condition, description } = req.body;
  const stores = readJSON(STORES_FILE, []);
  const store = stores.find(s => s.id === req.session.storeId);
  const plans = readJSON(PLANS_FILE, []);
  const planInfo = plans.find(p => p.slug === store.plan) || plans[0];
  const limitMatch = /Até (\d+) relógios/.exec((planInfo.features || []).join(' '));
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : Infinity;

  if (store.watches.length >= limit) {
    return res.redirect('/painel?saved=limite');
  }
  store.watches.push({
    id: crypto.randomUUID(),
    brand, model, ref: ref || '', price: parseFloat(price) || 0,
    condition: condition || 'Seminovo', description: description || '',
    createdAt: new Date().toISOString()
  });
  writeJSON(STORES_FILE, stores);
  res.redirect('/painel?saved=relogio');
});

app.post('/painel/relogios/:watchId/excluir', requireStore, (req, res) => {
  const stores = readJSON(STORES_FILE, []);
  const store = stores.find(s => s.id === req.session.storeId);
  if (store) {
    store.watches = store.watches.filter(w => w.id !== req.params.watchId);
    writeJSON(STORES_FILE, stores);
  }
  res.redirect('/painel?saved=exclusao');
});

app.get('/loja/:slug', (req, res) => {
  const stores = readJSON(STORES_FILE, []);
  const store = stores.find(s => s.slug === req.params.slug);
  if (!store) return res.status(404).render('404');
  res.render('loja', { store });
});

app.use((req, res) => res.status(404).render('404'));

app.listen(PORT, () => {
  console.log(`IM Watches rodando em http://localhost:${PORT}`);
});
