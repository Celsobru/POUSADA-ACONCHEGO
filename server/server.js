/* ============================================
   POUSADA ACONCHEGO - Backend
   ============================================ */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// .env
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
    fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m && !line.trim().startsWith('#')) process.env[m[1]] = (m[2] || '').trim();
    });
}

const app = express();
const PORT = process.env.PORT || 3010;

// Aviso amigável se a porta já estiver ocupada (evita "crash" silencioso)
process.on('uncaughtException', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`\n[ERRO] A porta ${PORT} já está em uso. Feche o outro servidor (ou use o INICIAR.bat, que encerra sozinho) e tente novamente.\n`);
    } else {
        console.error('\n[ERRO]', (err && err.message) || err, '\n');
    }
    process.exit(1);
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ---- Segurança: NÃO expor arquivos sensíveis pelo servidor estático ----
// Bloqueia /server (data.json, .env, backups), arquivos ocultos, .bat e scripts de teste/dev.
app.use((req, res, next) => {
    let p;
    try { p = decodeURIComponent(req.path); } catch (e) { p = req.path; }
    p = p.toLowerCase();
    const bloqueado =
        p.startsWith('/server') ||
        p.startsWith('/backups') ||
        p.startsWith('/.git') ||
        p.includes('/.') ||
        p.endsWith('.bat') ||
        /^\/(fix|test|check)[^/]*\.js$/.test(p);
    if (bloqueado) return res.status(404).send('Not found');
    next();
});

// ---------- SEO (robots.txt, sitemap.xml e <head> dinâmico) ----------
const SITE_URL = (process.env.SITE_URL || 'https://pousadaaconchegobauru.com.br').replace(/\/+$/, '');
const INDEX_HTML_PATH = path.join(__dirname, '..', 'index.html');

function escHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Converte "(14) 99831-3110" ou "5514998313110" em "+5514998313110"
function telE164(v) {
    const d = String(v == null ? '' : v).replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('55') && d.length >= 12) return '+' + d;
    if (d.length >= 10) return '+55' + d;
    return '';
}

function fmtPreco(n) {
    return (Math.round(n) === n) ? String(n) : n.toFixed(2).replace('.', ',');
}

// Monta as tags de SEO a partir das configurações salvas no painel
function buildSeoHead(d) {
    const site = (d && d.site) || {};
    const nome = String(site.titulo || 'Pousada Aconchego').trim() || 'Pousada Aconchego';
    const cidade = 'Bauru';
    const uf = 'SP';
    const url = SITE_URL + '/';
    const tel = telE164(site.telefone);
    const email = String(site.email || '');
    const endereco = String(site.endereco || '').trim();

    const quartos = ((d && d.quartos) || []).filter(q => q.ativo);
    const precos = quartos.map(q => Number(q.diaria) || 0).filter(n => n > 0);
    const priceRange = precos.length
        ? 'R$ ' + fmtPreco(Math.min.apply(null, precos)) + ' - R$ ' + fmtPreco(Math.max.apply(null, precos))
        : '';

    const titulo = nome + ' em ' + cidade + '/' + uf + ' | Pousada, Suítes e Reservas';
    const descricao = nome + ' em ' + cidade + '/' + uf + ': suítes confortáveis, café da manhã, Wi-Fi grátis e estacionamento. Reserve pelo WhatsApp.';

    // Imagens para redes sociais / dados estruturados (hero, galeria, quartos, ícone)
    const abs = (f) => /^https?:/i.test(String(f)) ? String(f) : SITE_URL + (String(f).startsWith('/') ? String(f) : '/' + String(f));
    const listaImg = [];
    if (site.heroImg) listaImg.push(site.heroImg);
    if (Array.isArray(site.galeria)) site.galeria.forEach(g => listaImg.push(g && typeof g === 'object' ? (g.url || g.foto) : g));
    quartos.forEach(q => { if (q.foto) listaImg.push(q.foto); });
    const imagens = [];
    listaImg.filter(Boolean).map(abs).forEach(u => { if (imagens.indexOf(u) === -1) imagens.push(u); });
    if (!imagens.length) imagens.push(SITE_URL + '/icons/icon-512.png');
    const ogImage = imagens[0];
    const logoUrl = site.logo ? abs(site.logo) : SITE_URL + '/icons/icon-512.png';

    const addr = { '@type': 'PostalAddress', addressLocality: cidade, addressRegion: uf, addressCountry: 'BR' };
    if (endereco) {
        const mCep = endereco.match(/(\d{5}-?\d{3})/);
        if (mCep) addr.postalCode = mCep[1].replace(/^(\d{5})(\d{3})$/, '$1-$2');
        // streetAddress = endereço sem cidade/UF/CEP
        const rua = endereco
            .replace(/[,\-]?\s*Bauru\s*[-/]?\s*SP.*$/i, '')
            .replace(/[,\-]?\s*CEP\s*\d{5}-?\d{3}.*$/i, '')
            .replace(/\s*[,\-]\s*$/, '').trim();
        if (rua) addr.streetAddress = rua;
    }

    const biz = {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        name: nome,
        url: url,
        description: nome + ' — pousada em ' + cidade + '/' + uf + ' com suítes confortáveis, café da manhã, Wi-Fi grátis e estacionamento.',
        address: addr,
        image: imagens,
        logo: logoUrl,
        currenciesAccepted: 'BRL',
        paymentAccepted: 'Dinheiro, Pix, Cartão'
    };
    if (tel) biz.telephone = tel;
    if (email) biz.email = email;
    if (priceRange) biz.priceRange = priceRange;
    if (Array.isArray(site.diferenciais) && site.diferenciais.length) {
        biz.amenityFeature = site.diferenciais
            .filter(x => x && x.titulo)
            .map(x => ({ '@type': 'LocationFeatureSpecification', name: String(x.titulo), value: true }));
    }

    const L = [];
    L.push('    <title>' + escHtml(titulo) + '</title>');
    L.push('    <meta name="description" content="' + escHtml(descricao) + '">');
    L.push('    <link rel="canonical" href="' + url + '">');
    L.push('    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">');
    L.push('    <meta name="author" content="' + escHtml(nome) + '">');
    L.push('    <meta name="geo.region" content="BR-SP">');
    L.push('    <meta name="geo.placename" content="' + cidade + '">');
    L.push('    <meta property="og:type" content="business.business">');
    L.push('    <meta property="og:site_name" content="' + escHtml(nome) + '">');
    L.push('    <meta property="og:locale" content="pt_BR">');
    L.push('    <meta property="og:title" content="' + escHtml(nome + ' em ' + cidade + '/' + uf) + '">');
    L.push('    <meta property="og:description" content="' + escHtml(descricao) + '">');
    L.push('    <meta property="og:url" content="' + url + '">');
    L.push('    <meta property="og:image" content="' + escHtml(ogImage) + '">');
    L.push('    <meta name="twitter:card" content="summary_large_image">');
    L.push('    <meta name="twitter:title" content="' + escHtml(nome + ' em ' + cidade + '/' + uf) + '">');
    L.push('    <meta name="twitter:description" content="' + escHtml(descricao) + '">');
    L.push('    <meta name="twitter:image" content="' + escHtml(ogImage) + '">');
    L.push('    <link rel="icon" type="image/png" sizes="192x192" href="' + SITE_URL + '/icons/icon-192.png">');
    L.push('    <link rel="apple-touch-icon" href="' + SITE_URL + '/icons/icon-192.png">');
    L.push('    <script type="application/ld+json">' + JSON.stringify(biz) + '</script>');
    return L.join('\n');
}

app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
        'User-agent: *\n' +
        'Allow: /\n' +
        'Disallow: /admin.html\n' +
        'Disallow: /login.html\n' +
        'Disallow: /cliente.html\n' +
        'Disallow: /server/\n' +
        'Disallow: /api/\n\n' +
        'Sitemap: ' + SITE_URL + '/sitemap.xml\n'
    );
});

app.get('/sitemap.xml', (req, res) => {
    const hoje = new Date().toISOString().slice(0, 10);
    res.type('application/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n' +
        '    <loc>' + SITE_URL + '/</loc>\n' +
        '    <lastmod>' + hoje + '</lastmod>\n' +
        '    <changefreq>weekly</changefreq>\n' +
        '    <priority>1.0</priority>\n' +
        '  </url>\n' +
        '</urlset>\n'
    );
});

// Página inicial: injeta o <head> de SEO gerado a partir das configurações do painel
app.get(['/', '/index.html'], (req, res, next) => {
    fs.readFile(INDEX_HTML_PATH, 'utf8', (err, html) => {
        if (err) return next();
        try {
            const head = buildSeoHead(db.load());
            html = html.replace(/<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/,
                '<!--SEO_HEAD_START-->\n' + head + '\n    <!--SEO_HEAD_END-->');
        } catch (e) { /* mantém o HTML estático em caso de erro */ }
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    });
});

app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Multer para upload de arquivos (backup restore)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Criar admin padrão se não existir
(function seedAdmin() {
    const d = db.load();
    if (!d.users.find(u => u.role === 'admin')) {
        d.users.push({ id: db.nextId(d.users), nome: 'Administradora', email: 'admin@aconchego.com', telefone: '', senha: bcrypt.hashSync('***REMOVED***', 10), role: 'admin' });
        db.save(d);
        console.log('Admin criado: admin@aconchego.com / ***REMOVED***');
    }
})();

function auth(req, res, next) {
    const h = req.headers.authorization;
    if (!h) return res.status(401).json({ erro: 'Não autorizado' });
    try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); next(); }
    catch { res.status(401).json({ erro: 'Token inválido' }); }
}
function adminOnly(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ erro: 'Apenas admin' }); next(); }
function funcionarioOuAdmin(req, res, next) { if (!['admin', 'funcionario'].includes(req.user.role)) return res.status(403).json({ erro: 'Acesso negado' }); next(); }

// ---------- AUTH ----------
app.post('/api/auth/register', (req, res) => {
    const { nome, email, senha, telefone } = req.body;
    const d = db.load();
    if (d.users.find(u => u.email === email)) return res.status(400).json({ erro: 'Email já cadastrado' });
    const user = { id: db.nextId(d.users), nome, email, telefone, senha: bcrypt.hashSync(senha, 10), role: 'cliente' };
    d.users.push(user); db.save(d);
    res.json({ ok: true });
});
app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body;
    const d = db.load();
    const u = d.users.find(u => u.email === email);
    if (!u || !bcrypt.compareSync(senha, u.senha)) return res.status(401).json({ erro: 'Login inválido' });
    const token = jwt.sign({ id: u.id, nome: u.nome, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: u.id, nome: u.nome, email: u.email, role: u.role } });
});

// ---------- QUARTOS ----------
app.get('/api/quartos', (req, res) => {
    const d = db.load();
    res.json(d.quartos.filter(q => q.ativo));
});
app.post('/api/quartos', auth, adminOnly, (req, res) => {
    const d = db.load();
    const q = { id: db.nextId(d.quartos), nome: req.body.nome, diaria: parseFloat(req.body.diaria), capacidade: parseInt(req.body.capacidade) || 2, ativo: true };
    d.quartos.push(q); db.save(d); res.json(q);
});
app.put('/api/quartos/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const q = d.quartos.find(q => q.id == req.params.id);
    if (!q) return res.status(404).json({ erro: 'Não encontrado' });
    q.nome = req.body.nome; q.diaria = parseFloat(req.body.diaria); q.capacidade = parseInt(req.body.capacidade) || q.capacidade;
    db.save(d); res.json(q);
});
app.delete('/api/quartos/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const q = d.quartos.find(q => q.id == req.params.id);
    if (q) q.ativo = false; db.save(d); res.json({ ok: true });
});

// ---------- DISPONIBILIDADE ----------
app.get('/api/disponibilidade', (req, res) => {
    const d = db.load();
    const hoje = new Date().toISOString().slice(0, 10);
    const ocupados = d.reservas.filter(r => r.status === 'ativa' && r.saida >= hoje).map(r => r.quartoId);
    res.json(d.quartos.filter(q => q.ativo).map(q => ({ ...q, disponivel: !ocupados.includes(q.id) })));
});

// ---------- RESERVAS ----------
app.post('/api/reservas', auth, (req, res) => {
    const { quartoId, entrada, saida } = req.body;
    const d = db.load();
    const q = d.quartos.find(q => q.id == quartoId);
    if (!q) return res.status(404).json({ erro: 'Quarto não encontrado' });
    const noites = Math.max(1, (new Date(saida) - new Date(entrada)) / 86400000);
    const valor = q.diaria * noites;
    const r = { id: db.nextId(d.reservas), clienteId: req.user.id, clienteNome: req.user.nome, clienteTelefone: req.user.telefone || '', quartoId: q.id, quartoNome: q.nome, entrada, saida, noites, valor, status: 'ativa', adicionais: [], criadoEm: new Date().toISOString() };
    d.reservas.push(r); db.save(d);
    // Mensagem WhatsApp (link pronto para enviar)
    const msg = `Olá ${req.user.nome}! 🏡 Sua reserva na Pousada Aconchego foi confirmada!\nQuarto: ${q.nome}\nEntrada: ${entrada} | Saída: ${saida} (${noites} noites)\nValor da hospedagem: R$ ${valor.toFixed(2)}\n\n🍹 Que tal aproveitar nossos pedidos adicionais? Temos bebidas, lanches e muito mais direto no seu quarto pelo app!`;
    res.json({ ok: true, reserva: r, whatsappLink: `https://wa.me/?text=${encodeURIComponent(msg)}` });
});
app.get('/api/minhas-reservas', auth, (req, res) => {
    const d = db.load();
    res.json(d.reservas.filter(r => r.clienteId === req.user.id));
});
app.get('/api/reservas', auth, funcionarioOuAdmin, (req, res) => res.json(db.load().reservas));
app.get('/api/reservas/:id', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.params.id);
    if (!r) return res.status(404).json({ erro: 'Reserva não encontrada' });
    res.json(r);
});

// EDITAR RESERVA (funcionario ou admin)
app.put('/api/reservas/:id', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.params.id);
    if (!r) return res.status(404).json({ erro: 'Reserva não encontrada' });
    if (r.status !== 'ativa') return res.status(400).json({ erro: 'Só pode editar reservas ativas' });
    const { entrada, saida, quartoId } = req.body;
    if (entrada) r.entrada = entrada;
    if (saida) r.saida = saida;
    if (quartoId) {
        const q = d.quartos.find(q => q.id == quartoId);
        if (q) { r.quartoId = q.id; r.quartoNome = q.nome; }
    }
    if (r.entrada && r.saida) {
        const noites = Math.max(1, (new Date(r.saida) - new Date(r.entrada)) / 86400000);
        r.noites = noites;
        const q = d.quartos.find(q => q.id == r.quartoId);
        if (q) r.valor = q.diaria * noites;
    }
    db.save(d); res.json({ ok: true, reserva: r });
});

// DELETAR RESERVA (apenas finalizadas/canceladas - admin)
app.delete('/api/reservas/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const idx = d.reservas.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ erro: 'Reserva não encontrada' });
    const r = d.reservas[idx];
    if (r.status === 'ativa') return res.status(400).json({ erro: 'Não pode excluir reserva ativa. Finalize ou cancele primeiro.' });
    d.reservas.splice(idx, 1);
    db.save(d); res.json({ ok: true });
});

app.patch('/api/reservas/:id/finalizar', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.params.id);
    if (!r) return res.status(404).json({ erro: 'Não encontrada' });
    if (r.status !== 'ativa') return res.status(400).json({ erro: 'Reserva não está ativa' });
    const forma = req.body.forma || 'dinheiro';
    r.status = 'finalizada';
    const totalAdicionais = (r.adicionais || []).reduce((s, i) => s + i.preco * i.qtd, 0);
    r.totalFinal = r.valor + totalAdicionais;
    r.finalizadaEm = new Date().toISOString();
    r.finalizadaPor = req.user.nome;
    r.formaPagamento = forma;

    // Sempre registra no caixa (mesmo que o caixa esteja fechado ou em outro turno/usuário)
    d.caixa.push({
        id: db.nextId(d.caixa),
        tipo: 'entrada',
        data: new Date().toISOString(),
        valor: r.totalFinal,
        descricao: `Reserva #${r.id} - ${r.clienteNome} (${r.quartoNome}) - ${forma}`,
        responsavel: req.user.nome,
        reservaId: r.id,
        formaPagamento: forma
    });

    d.pagamentos.push({ id: db.nextId(d.pagamentos), reservaId: r.id, valor: r.totalFinal, forma, data: new Date().toISOString() });
    db.save(d);

    // Telefone do cliente (para WhatsApp)
    const cli = d.users.find(u => u.id === r.clienteId);
    const whatsapp = (cli && cli.telefone) ? cli.telefone : (r.clienteTelefone || '');

    res.json({ ok: true, reserva: r, total: r.totalFinal, whatsapp });
});

// ---------- PRODUTOS / COMANDA ----------
app.get('/api/produtos', (req, res) => res.json(db.load().produtos));
app.post('/api/produtos', auth, adminOnly, (req, res) => {
    const d = db.load();
    const p = { id: db.nextId(d.produtos), nome: req.body.nome, preco: parseFloat(req.body.preco) };
    d.produtos.push(p); db.save(d); res.json(p);
});
app.put('/api/produtos/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const p = d.produtos.find(p => p.id == req.params.id);
    if (!p) return res.status(404).json({ erro: 'Não encontrado' });
    p.nome = req.body.nome; p.preco = parseFloat(req.body.preco); db.save(d); res.json(p);
});
app.delete('/api/produtos/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    d.produtos = d.produtos.filter(p => p.id != req.params.id); db.save(d); res.json({ ok: true });
});
app.post('/api/comanda/:reservaId/adicionar', auth, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.params.reservaId && (r.clienteId === req.user.id || ['admin', 'funcionario'].includes(req.user.role)));
    if (!r) return res.status(404).json({ erro: 'Reserva não encontrada' });
    const p = d.produtos.find(p => p.id == req.body.produtoId);
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    const qtd = Math.max(1, parseInt(req.body.qtd) || 1);
    const existente = (r.adicionais || []).find(i => i.produtoId === p.id);
    if (existente) existente.qtd += qtd;
    else r.adicionais.push({ produtoId: p.id, nome: p.nome, preco: p.preco, qtd });
    db.save(d); res.json(r);
});
app.delete('/api/comanda/:reservaId/item/:produtoId', auth, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.params.reservaId && (r.clienteId === req.user.id || ['admin', 'funcionario'].includes(req.user.role)));
    if (!r) return res.status(404).json({ erro: 'Reserva não encontrada' });
    r.adicionais = (r.adicionais || []).filter(i => i.produtoId != req.params.produtoId);
    db.save(d); res.json(r);
});

// ---------- PAGAMENTO ----------
app.get('/api/pagamento/info', (req, res) => {
    res.json({ pixChave: process.env.PIX_CHAVE, pixNome: process.env.PIX_NOME, link: process.env.MERCADOPAGO_LINK });
});
app.post('/api/pagamento/confirmar', auth, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.body.reservaId && r.clienteId === req.user.id);
    if (!r) return res.status(404).json({ erro: 'Reserva não encontrada' });
    const total = r.valor + (r.adicionais || []).reduce((s, i) => s + i.preco * i.qtd, 0);
    r.status = 'finalizada'; r.totalFinal = total;
    d.pagamentos.push({ id: db.nextId(d.pagamentos), reservaId: r.id, valor: total, forma: req.body.forma || 'pix', data: new Date().toISOString() });
    db.save(d); res.json({ ok: true, total });
});

// ---------- CAIXA ----------
app.get('/api/caixa', auth, funcionarioOuAdmin, (req, res) => res.json(db.load().caixa));
app.get('/api/caixa/atual', auth, funcionarioOuAdmin, (req, res) => res.json({ aberto: db.load().caixaAberto }));
app.post('/api/caixa/abrir', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    if (d.caixaAberto) return res.status(400).json({ erro: 'Caixa já está aberto' });
    d.caixaAberto = { data: new Date().toISOString(), valorInicial: parseFloat(req.body.valorInicial || 0), responsavel: req.user.nome };
    d.caixa.push({ id: db.nextId(d.caixa), tipo: 'abertura', ...d.caixaAberto });
    db.save(d); res.json(d.caixaAberto);
});
app.post('/api/caixa/fechar', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    if (!d.caixaAberto) return res.status(400).json({ erro: 'Caixa não está aberto' });
    
    // Calcular totais do período
    const abertura = d.caixaAberto.data;
    const movimentosPeriodo = d.caixa.filter(m => m.data >= abertura && m.tipo !== 'abertura' && m.tipo !== 'fechamento');
    const entradas = movimentosPeriodo.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0);
    const saidas = movimentosPeriodo.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0);

    // Separa entradas por forma de pagamento (só o dinheiro físico fica na gaveta)
    const porForma = { dinheiro: 0, pix: 0, cartao: 0, outros: 0 };
    movimentosPeriodo.filter(m => m.tipo === 'entrada').forEach(m => {
        const f = String(m.formaPagamento || 'dinheiro').toLowerCase();
        if (f.includes('pix')) porForma.pix += m.valor;
        else if (f.includes('cart') || f.includes('cred') || f.includes('deb') || f.includes('boleto')) porForma.cartao += m.valor;
        else if (f.includes('dinheiro') || f.includes('especie')) porForma.dinheiro += m.valor;
        else porForma.outros += m.valor;
    });

    const valorFinal = parseFloat(req.body.valorFinal || 0);
    const saldoTotal = d.caixaAberto.valorInicial + entradas - saidas;                                  // total (dinheiro + PIX/cartão)
    const dinheiroEsperado = d.caixaAberto.valorInicial + porForma.dinheiro + porForma.outros - saidas; // só o que deve estar na gaveta
    const diferenca = valorFinal - dinheiroEsperado;

    // Gerar HTML do PDF
    const site = d.site || {};
    const __baseUrl = req.protocol + '://' + req.get('host');
    const logo = site.logo ? `${__baseUrl}${site.logo}` : '';
    const movimentacoes = movimentosPeriodo.map(m => 
        `<tr><td>${new Date(m.data).toLocaleString('pt-BR')}</td><td>${m.tipo}</td><td>${m.descricao || m.responsavel || '-'}</td><td>${m.tipo === 'entrada' ? 'R$ ' + m.valor.toFixed(2) : '-'}</td><td>${m.tipo === 'saida' ? 'R$ ' + m.valor.toFixed(2) : '-'}</td></tr>`
    ).join('');

    const htmlPDF = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Fechamento de Caixa</title>
<style>body{font-family:Arial;max-width:700px;margin:40px auto;color:#333}h1{color:#1b5e20;text-align:center}.logo{text-align:center;margin-bottom:20px}.logo img{max-height:80px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#1b5e20;color:#fff}.total{font-size:1.2rem;font-weight:bold;text-align:right;padding:10px;background:#f0f8f0}.diferenca{color:${diferenca >= 0 ? '#1b5e20' : '#c62828'}.resumo{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee}.footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #ddd;color:#666;font-size:.9rem}@media print{.no-print{display:none}}</style></head><body>
${logo ? '<div class="logo"><img src="' + logo + '" alt="Logo"></div>' : ''}
<h1>🏡 Pousada Aconchego</h1>
<h2 style="text-align:center">Fechamento de Caixa</h2>
<p style="text-align:center"><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')} | <strong>Responsável:</strong> ${req.user.nome}</p>

<h3>Resumo Financeiro</h3>
<div class="resumo"><span>Valor Inicial (fundo de troco)</span><strong>R$ ${d.caixaAberto.valorInicial.toFixed(2)}</strong></div>
<div class="resumo"><span>Entradas - Dinheiro</span><strong>R$ ${porForma.dinheiro.toFixed(2)}</strong></div>
<div class="resumo"><span>Entradas - PIX</span><strong>R$ ${porForma.pix.toFixed(2)}</strong></div>
<div class="resumo"><span>Entradas - Cartão/Boleto</span><strong>R$ ${porForma.cartao.toFixed(2)}</strong></div>
<div class="resumo"><span>Entradas - Outros</span><strong>R$ ${porForma.outros.toFixed(2)}</strong></div>
<div class="resumo"><span>Saídas</span><strong>R$ ${saidas.toFixed(2)}</strong></div>
<div class="resumo"><span>💵 Dinheiro Esperado na Gaveta</span><strong>R$ ${dinheiroEsperado.toFixed(2)}</strong></div>
<div class="resumo"><span>Saldo Total (inclui PIX/Cartão)</span><strong>R$ ${saldoTotal.toFixed(2)}</strong></div>
<div class="resumo"><span>Dinheiro Contado na Gaveta</span><strong>R$ ${valorFinal.toFixed(2)}</strong></div>
<div class="resumo diferenca"><span>Diferença</span><strong>R$ ${diferenca.toFixed(2)}</strong></div>

<h3>Movimentações do Período</h3>
<table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th>Entrada</th><th>Saída</th></thead><tbody>${movimentacoes}</tbody></table>

<div class="total">💵 DINHEIRO NA GAVETA: R$ ${valorFinal.toFixed(2)}</div>

<div class="footer">
<p>🏡 Pousada Aconchego - Bauru/SP</p>
<p>WhatsApp: (14) 99831-3110</p>
<p>💚 Obrigado pela preferência! Volte sempre!</p>
</div>
<button class="no-print" onclick="window.print()" style="background:#1b5e20;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin-top:20px">🖨️ Salvar/Imprimir PDF</button>
<button class="no-print" onclick="window.location.href='https://wa.me/?text=${encodeURIComponent('Fechamento de caixa da Pousada Aconchego - ' + new Date().toLocaleDateString('pt-BR') + '. Total: R$ ' + valorFinal.toFixed(2))}' style="background:#25d366;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin:20px 10px 0 0">📲 Enviar via WhatsApp</button>
</body></html>`;

    const fec = { tipo: 'fechamento', data: new Date().toISOString(), valorFinal: parseFloat(req.body.valorFinal || 0), responsavel: req.user.nome, pdfHTML: htmlPDF };
    d.caixa.push({ id: db.nextId(d.caixa), ...fec });
    d.caixaAberto = null; db.save(d); res.json({ ok: true, fechamento: fec, pdfHTML: htmlPDF });
});

// ---------- FINANCEIRO ----------
app.get('/api/financeiro', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    const porMes = {};
    d.pagamentos.forEach(p => {
        const m = p.data.slice(0, 7);
        porMes[m] = (porMes[m] || 0) + p.valor;
    });
    const total = d.pagamentos.reduce((s, p) => s + p.valor, 0);
    res.json({ total, porMes, pagamentos: d.pagamentos });
});

// ---------- CLIENTES ----------
app.get('/api/clientes', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    res.json(d.users.filter(u => u.role === 'cliente').map(u => ({ id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, criadoEm: u.criadoEm })));
});

app.post('/api/clientes', auth, funcionarioOuAdmin, (req, res) => {
    const { nome, email, senha, telefone } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Informe nome, email e senha' });
    const d = db.load();
    if (d.users.find(u => u.email === email)) return res.status(400).json({ erro: 'Email já cadastrado' });
    const user = { id: db.nextId(d.users), nome, email, telefone: telefone || '', senha: bcrypt.hashSync(senha, 10), role: 'cliente', criadoEm: new Date().toISOString() };
    d.users.push(user); db.save(d);
    res.json({ ok: true, cliente: { id: user.id, nome: user.nome, email: user.email, telefone: user.telefone } });
});

app.put('/api/clientes/:id', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    const c = d.users.find(u => u.id == req.params.id && u.role === 'cliente');
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    if (req.body.email && req.body.email !== c.email && d.users.find(u => u.email === req.body.email)) {
        return res.status(400).json({ erro: 'Email já cadastrado' });
    }
    c.nome = req.body.nome || c.nome;
    c.email = req.body.email || c.email;
    if (req.body.telefone !== undefined) c.telefone = req.body.telefone;
    if (req.body.senha) c.senha = bcrypt.hashSync(req.body.senha, 10);
    db.save(d);
    res.json({ ok: true, cliente: { id: c.id, nome: c.nome, email: c.email, telefone: c.telefone } });
});

app.delete('/api/clientes/:id', auth, funcionarioOuAdmin, (req, res) => {
    const d = db.load();
    const idx = d.users.findIndex(u => u.id == req.params.id && u.role === 'cliente');
    if (idx === -1) return res.status(404).json({ erro: 'Cliente não encontrado' });
    d.users.splice(idx, 1);
    db.save(d); res.json({ ok: true });
});

// ---------- USUÁRIOS DO SISTEMA (Admin) ----------
app.get('/api/usuarios', auth, adminOnly, (req, res) => {
    const d = db.load();
    res.json(d.users.filter(u => u.role !== 'cliente').map(u => ({ id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, role: u.role, criadoEm: u.criadoEm })));
});

app.post('/api/usuarios', auth, adminOnly, (req, res) => {
    const { nome, email, senha, telefone, role } = req.body;
    if (!nome || !email || !senha || !role) return res.status(400).json({ erro: 'Preencha todos os campos' });
    if (!['admin', 'funcionario'].includes(role)) return res.status(400).json({ erro: 'Role inválido. Use admin ou funcionario' });
    const d = db.load();
    if (d.users.find(u => u.email === email)) return res.status(400).json({ erro: 'Email já cadastrado' });
    const user = { id: db.nextId(d.users), nome, email, telefone: telefone || '', senha: bcrypt.hashSync(senha, 10), role, criadoEm: new Date().toISOString() };
    d.users.push(user); db.save(d);
    res.json({ ok: true, user: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
});

app.put('/api/usuarios/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const u = d.users.find(u => u.id == req.params.id);
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (u.role === 'cliente') return res.status(400).json({ erro: 'Não pode editar clientes aqui' });
    u.nome = req.body.nome || u.nome;
    u.email = req.body.email || u.email;
    u.telefone = req.body.telefone || u.telefone;
    if (req.body.senha) u.senha = bcrypt.hashSync(req.body.senha, 10);
    if (req.body.role && ['admin', 'funcionario'].includes(req.body.role)) u.role = req.body.role;
    db.save(d); res.json({ ok: true, user: { id: u.id, nome: u.nome, email: u.email, role: u.role } });
});

app.delete('/api/usuarios/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const idx = d.users.findIndex(u => u.id == req.params.id);
    if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (d.users[idx].role === 'cliente') return res.status(400).json({ erro: 'Não pode excluir clientes aqui' });
    if (d.users[idx].id === req.user.id) return res.status(400).json({ erro: 'Não pode excluir a si mesmo' });
    d.users.splice(idx, 1);
    db.save(d); res.json({ ok: true });
});

// Admin/Funcionário abre reserva para um cliente
app.post('/api/admin/reservas', auth, funcionarioOuAdmin, (req, res) => {
    const { clienteId, quartoId, entrada, saida } = req.body;
    const d = db.load();
    const c = d.users.find(u => u.id == clienteId);
    const q = d.quartos.find(q => q.id == quartoId);
    if (!c || !q) return res.status(404).json({ erro: 'Cliente ou quarto não encontrado' });
    const noites = Math.max(1, (new Date(saida) - new Date(entrada)) / 86400000);
    const valor = q.diaria * noites;
    const r = { id: db.nextId(d.reservas), clienteId: c.id, clienteNome: c.nome, clienteTelefone: c.telefone || '', quartoId: q.id, quartoNome: q.nome, entrada, saida, noites, valor, status: 'ativa', adicionais: [], criadoEm: new Date().toISOString() };
    d.reservas.push(r); db.save(d);
    res.json({ ok: true, reserva: r });
});

// ---------- COMPROVANTE ----------
app.get('/api/comprovante/:reservaId', auth, (req, res) => {
    const d = db.load();
    const r = d.reservas.find(r => r.id == req.params.reservaId && (r.clienteId === req.user.id || ['admin', 'funcionario'].includes(req.user.role)));
    if (!r) return res.status(404).json({ erro: 'Não encontrada' });
    const adicionais = (r.adicionais || []).map(i => `<tr><td>${i.nome}</td><td>${i.qtd}x</td><td>R$ ${(i.preco * i.qtd).toFixed(2)}</td></tr>`).join('');
    const total = r.totalFinal || (r.valor + (r.adicionais || []).reduce((s, i) => s + i.preco * i.qtd, 0));
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante</title>
    <style>body{font-family:Arial;max-width:600px;margin:40px auto;color:#333}h1{color:#1b5e20}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.total{font-size:1.4rem;font-weight:bold;color:#1b5e20}</style>
    </head><body>
    <h1>🏡 Pousada Aconchego</h1><hr>
    <p><b>Hóspede:</b> ${r.clienteNome}<br><b>Quarto:</b> ${r.quartoNome}<br><b>Entrada:</b> ${r.entrada} | <b>Saída:</b> ${r.saida} (${r.noites} noites)</p>
    <h3>Hospedagem</h3><p>R$ ${r.valor.toFixed(2)}</p>
    <h3>Consumo adicional</h3><table><tr><th>Item</th><th>Qtd</th><th>Valor</th></tr>${adicionais || '<tr><td colspan=3>Nenhum</td></tr>'}</table>
    <p class="total">TOTAL: R$ ${total.toFixed(2)}</p>
    ${r.formaPagamento ? `<p><b>Forma de pagamento:</b> ${r.formaPagamento}</p>` : ''}
    ${r.finalizadaEm ? `<p><b>Data:</b> ${new Date(r.finalizadaEm).toLocaleString('pt-BR')}</p>` : ''}
    ${r.finalizadaPor ? `<p><b>Atendido por:</b> ${r.finalizadaPor}</p>` : ''}
    <hr><p>💚 Obrigado pela preferência! <b>Volte sempre!</b></p>
    <button onclick="window.print()" style="background:#1b5e20;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer">🖨️ Salvar em PDF</button>
    <button onclick="window.close()" style="background:#666;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin-left:8px">Fechar</button>
    </body></html>`);
});

// ---------- BACKUP ----------
app.get('/api/admin/backups', auth, adminOnly, (req, res) => {
    const dir = path.join(__dirname, 'backups');
    if (!fs.existsSync(dir)) return res.json([]);
    res.json(fs.readdirSync(dir).filter(f => f.startsWith('backup-')).sort().reverse());
});
app.post('/api/admin/restaurar', auth, adminOnly, (req, res) => {
    const dir = path.join(__dirname, 'backups');
    const f = path.join(dir, path.basename(req.body.arquivo || ''));
    if (!fs.existsSync(f)) return res.status(404).json({ erro: 'Backup não encontrado' });
    fs.copyFileSync(f, path.join(__dirname, 'data.json'));
    res.json({ ok: true });
});
app.post('/api/admin/backup-agora', auth, adminOnly, (req, res) => {
    require('child_process').exec('node scripts/backup.js', { cwd: __dirname }, (e) => res.json({ ok: !e }));
});

// NOVO: Download do backup
app.get('/api/admin/backup-download', auth, adminOnly, (req, res) => {
    const d = db.load();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-pousada-${timestamp}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(d, null, 2));
});

// NOVO: Restaurar via upload de arquivo
app.post('/api/admin/restaurar-upload', auth, adminOnly, upload.single('arquivo'), (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    try {
        const data = JSON.parse(req.file.buffer.toString('utf8'));
        // Validação básica
        if (!data.users || !data.quartos || !data.reservas) {
            return res.status(400).json({ erro: 'Arquivo de backup inválido' });
        }
        fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(data, null, 2));
        res.json({ ok: true, msg: 'Backup restaurado com sucesso' });
    } catch (e) {
        res.status(400).json({ erro: 'Arquivo inválido: ' + e.message });
    }
});

// NOVO: Limpar todos os dados (reset total)
app.post('/api/admin/limpar-dados', auth, adminOnly, (req, res) => {
    if (!req.body.confirmar) return res.status(400).json({ erro: 'Confirmação necessária' });
    const initial = {
        users: [],
        quartos: [
            { id: 1, nome: 'Suíte Standard', diaria: 180, capacidade: 2, ativo: true },
            { id: 2, nome: 'Suíte Luxo', diaria: 260, capacidade: 2, ativo: true },
            { id: 3, nome: 'Suíte Família', diaria: 320, capacidade: 4, ativo: true }
        ],
        reservas: [],
        caixa: [],
        produtos: [
            { id: 1, nome: 'Cerveja lata', preco: 9.00 },
            { id: 2, nome: 'Refrigerante', preco: 6.00 },
            { id: 3, nome: 'Água mineral', preco: 4.00 },
            { id: 4, nome: 'Sanduíche', preco: 18.00 },
            { id: 5, nome: 'Café da manhã extra', preco: 25.00 }
        ],
        comandas: [],
        pagamentos: [],
        caixaAberto: null,
        site: {
            titulo: 'Pousada Aconchego',
            subtitulo: 'Seu refúgio em Bauru',
            descricao: 'Conforto, tranquilidade e hospitalidade de verdade no coração do interior paulista.',
            telefone: '(14) 99831-3110',
            whatsapp: '5514998313110',
            heroImg: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600',
            logo: '',
            sobre: 'Uma pousada aconchegante no coração de Bauru.',
            quartosTitulo: 'Nossos Quartos',
            quartosSubtitulo: 'Ambientes pensados para você descansar de verdade',
            diferenciaisTitulo: 'Por que nos escolher?',
            diferenciais: [
                { icone: '☕', titulo: 'Café da manhã', descricao: 'Colonial e caseiro, incluso' },
                { icone: '📶', titulo: 'Wi-Fi grátis', descricao: 'Em todos os ambientes' },
                { icone: '🍳', titulo: 'Cozinha', descricao: 'À disposição dos hóspedes' },
                { icone: '🅿️', titulo: 'Estacionamento', descricao: 'Privativo e seguro' },
                { icone: '🧹', titulo: 'Limpeza diária', descricao: 'Quarto sempre impecável' },
                { icone: '🍹', titulo: 'Pedidos no quarto', descricao: 'Pelo nosso app de hóspedes' }
            ],
            galeria: [],
            secoesExtras: []
        }
    }
    fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(initial, null, 2));
    // Limpar uploads
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
        fs.readdirSync(uploadsDir).forEach(f => fs.unlinkSync(path.join(uploadsDir, f)));
    }
    res.json({ ok: true, msg: 'Sistema resetado com sucesso. Dados de exemplo restaurados.' });
});

// Reset OPERACIONAL: apaga reservas/hospedagens, comandas, caixa e financeiro
// MANTÉM: quartos, fotos/galeria, logo, site, clientes (users) e produtos
app.post('/api/admin/reset-operacional', auth, adminOnly, (req, res) => {
    if (!req.body.confirmar) return res.status(400).json({ erro: 'Confirmação necessária' });
    const d = db.load();
    if (!Array.isArray(d.reservas)) d.reservas = [];
    d.reservas = [];
    d.comandas = [];
    d.pagamentos = [];
    d.caixa = [];
    d.caixaAberto = null;
    db.save(d);
    res.json({ ok: true, msg: 'Histórico zerado: reservas/hospedagens, comandas, caixa e financeiro. Quartos, fotos, clientes e produtos foram mantidos.' });
});

// ---------- UPLOAD DE MÍDIA (fotos/vídeos do PC) ----------
const UPLOADS = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);
app.post('/api/upload', auth, adminOnly, (req, res) => {
    const { nome, base64 } = req.body;
    if (!base64) return res.status(400).json({ erro: 'Arquivo vazio' });
    const ext = path.extname(nome || '') || '.png';
    const file = `media-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOADS, file), Buffer.from(base64.split(',')[1] || base64, 'base64'));
    res.json({ url: '/uploads/' + file });
});

// ---------- SITE PÚBLICO (dados para o site) ----------
app.get('/api/site/public', (req, res) => {
    const d = db.load();
    if (!d.site) { d.site = SITE_PADRAO; db.save(d); }
    res.json({
        titulo: d.site.titulo,
        subtitulo: d.site.subtitulo,
        descricao: d.site.descricao,
        telefone: d.site.telefone,
        email: d.site.email,
        whatsapp: d.site.whatsapp,
        heroImg: d.site.heroImg,
        logo: d.site.logo,
        sobre: d.site.sobre,
        quartos: d.quartos.filter(q => q.ativo).map(q => ({
            id: q.id,
            nome: q.nome,
            diaria: q.diaria,
            capacidade: q.capacidade,
            descricao: q.descricao,
            foto: q.foto
        })),
        quartosTitulo: d.site.quartosTitulo,
        quartosSubtitulo: d.site.quartosSubtitulo,
        diferenciaisTitulo: d.site.diferenciaisTitulo,
        diferenciais: d.site.diferenciais,
        galeria: d.site.galeria,
        secoesExtras: d.site.secoesExtras,
        contato: {
            telefone: d.site.telefone,
            email: d.site.email,
            whatsapp: d.site.whatsapp,
            endereco: d.site.endereco || 'Bauru - SP'
        }
    });
});

// ---------- SITE - QUARTOS (CRUD) ----------
app.get('/api/site/quartos', auth, adminOnly, (req, res) => {
    const d = db.load();
    res.json(d.quartos);
});
app.post('/api/site/quartos', auth, adminOnly, (req, res) => {
    const d = db.load();
    const q = { id: db.nextId(d.quartos), nome: req.body.nome, diaria: parseFloat(req.body.diaria) || 0, capacidade: parseInt(req.body.capacidade) || 2, ativo: true, descricao: req.body.descricao || '', foto: req.body.foto || '' };
    d.quartos.push(q); db.save(d); res.json(q);
});
app.put('/api/site/quartos/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const q = d.quartos.find(q => q.id == req.params.id);
    if (!q) return res.status(404).json({ erro: 'Quarto não encontrado' });
    q.nome = req.body.nome || q.nome;
    q.diaria = parseFloat(req.body.diaria) || q.diaria;
    q.capacidade = parseInt(req.body.capacidade) || q.capacidade;
    q.descricao = req.body.descricao || q.descricao;
    q.foto = req.body.foto || q.foto;
    q.ativo = req.body.ativo !== undefined ? req.body.ativo : q.ativo;
    db.save(d); res.json({ ok: true, quarto: q });
});
app.delete('/api/site/quartos/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const idx = d.quartos.findIndex(q => q.id == req.params.id);
    if (idx === -1) return res.status(404).json({ erro: 'Quarto não encontrado' });
    d.quartos.splice(idx, 1);
    db.save(d); res.json({ ok: true });
});

// ---------- SITE - TEXTOS ----------
app.put('/api/site/textos', auth, adminOnly, (req, res) => {
    const d = db.load();
    const campos = ['titulo', 'subtitulo', 'descricao', 'telefone', 'email', 'whatsapp', 'heroImg', 'logo', 'sobre', 'quartosTitulo', 'quartosSubtitulo', 'diferenciaisTitulo', 'endereco'];
    campos.forEach(c => { if (req.body[c] !== undefined) d.site[c] = req.body[c]; });
    db.save(d); res.json({ ok: true, site: d.site });
});

// ---------- SITE - DIFERENCIAIS ----------
app.get('/api/site/diferenciais', auth, adminOnly, (req, res) => {
    const d = db.load();
    res.json(d.site.diferenciais || []);
});
app.post('/api/site/diferenciais', auth, adminOnly, (req, res) => {
    const d = db.load();
    const dif = { id: db.nextId(d.site.diferenciais || []), icone: req.body.icone || '✨', titulo: req.body.titulo || '', descricao: req.body.descricao || '' };
    if (!d.site.diferenciais) d.site.diferenciais = [];
    d.site.diferenciais.push(dif); db.save(d); res.json(dif);
});
app.put('/api/site/diferenciais/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const dif = (d.site.diferenciais || []).find(d => d.id == req.params.id);
    if (!dif) return res.status(404).json({ erro: 'Diferencial não encontrado' });
    dif.icone = req.body.icone || dif.icone;
    dif.titulo = req.body.titulo || dif.titulo;
    dif.descricao = req.body.descricao || dif.descricao;
    db.save(d); res.json({ ok: true, diferencial: dif });
});
app.delete('/api/site/diferenciais/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    d.site.diferenciais = (d.site.diferenciais || []).filter(d => d.id != req.params.id);
    db.save(d); res.json({ ok: true });
});

// ---------- SITE - GALERIA ----------
app.post('/api/site/galeria', auth, adminOnly, (req, res) => {
    const d = db.load();
    if (!d.site.galeria) d.site.galeria = [];
    const item = { id: db.nextId(d.site.galeria), url: req.body.url, tipo: req.body.tipo || 'foto', legenda: req.body.legenda || '' };
    d.site.galeria.push(item); db.save(d); res.json(item);
});
app.delete('/api/site/galeria/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    d.site.galeria = (d.site.galeria || []).filter(g => g.id != req.params.id);
    db.save(d); res.json({ ok: true });
});

// ---------- SITE - SEÇÕES EXTRAS (campos customizados) ----------
app.get('/api/site/secoes', auth, adminOnly, (req, res) => {
    const d = db.load();
    res.json(d.site.secoesExtras || []);
});
app.post('/api/site/secoes', auth, adminOnly, (req, res) => {
    const d = db.load();
    if (!d.site.secoesExtras) d.site.secoesExtras = [];
    const secao = { id: db.nextId(d.site.secoesExtras), titulo: req.body.titulo || '', conteudo: req.body.conteudo || '', tipo: req.body.tipo || 'texto', ordem: (d.site.secoesExtras.length || 0) + 1 };
    d.site.secoesExtras.push(secao); db.save(d); res.json(secao);
});
app.put('/api/site/secoes/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    const s = (d.site.secoesExtras || []).find(s => s.id == req.params.id);
    if (!s) return res.status(404).json({ erro: 'Seção não encontrada' });
    s.titulo = req.body.titulo || s.titulo;
    s.conteudo = req.body.conteudo || s.conteudo;
    s.tipo = req.body.tipo || s.tipo;
    s.ordem = req.body.ordem || s.ordem;
    db.save(d); res.json({ ok: true, secao: s });
});
app.delete('/api/site/secoes/:id', auth, adminOnly, (req, res) => {
    const d = db.load();
    d.site.secoesExtras = (d.site.secoesExtras || []).filter(s => s.id != req.params.id);
    db.save(d); res.json({ ok: true });
});

// ---------- SITE (config da dona) ----------
const SITE_PADRAO = {
    titulo: 'Pousada Aconchego', subtitulo: 'Seu refúgio em Bauru',
    descricao: 'Conforto, tranquilidade e hospitalidade de verdade no coração do interior paulista.',
    telefone: '(14) 99831-3110', whatsapp: '5514998313110',
    heroImg: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600',
    sobre: 'Uma pousada aconchegante no coração de Bauru.',
    galeria: []
};
app.get('/api/site', (req, res) => {
    const d = db.load();
    if (!d.site) { d.site = SITE_PADRAO; db.save(d); }
    if (!Array.isArray(d.site.galeria)) d.site.galeria = [];
    res.json(d.site);
});
app.put('/api/site', auth, adminOnly, (req, res) => {
    const d = db.load();
    d.site = { ...d.site, ...req.body };
    db.save(d); res.json(d.site);
});

// ---------- STATUS ----------
app.get('/api/status', (req, res) => res.json({ status: 'online' }));

app.listen(PORT, () => console.log(`\n  🏡 Pousada Aconchego API rodando em http://localhost:${PORT}\n`));
