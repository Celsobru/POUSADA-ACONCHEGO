/* ============================================
   ADMIN JS - Pousada Aconchego
   Complete Admin Panel Functionality
   ============================================ */

const API = (location.origin && location.origin.startsWith('http') ? location.origin : 'http://localhost:3010') + '/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
if (!token || !['admin', 'funcionario'].includes(user.role)) location.href = 'login.html';
const H = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

let currentReservationId = null;
let currentSection = 'dashboard';
let currentReservaData = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminName').textContent = user.nome || 'Admin';
    setupSidebar();
    const isAdmin = user.role === 'admin';
    const secaoInicial = isAdmin ? 'dashboard' : 'caixa';
    // Funcionário não acessa seções exclusivas do administrador
    if (!isAdmin) {
        document.querySelectorAll('[data-section="dashboard"],[data-section="clientes"],[data-section="usuarios"],[data-section="financeiro"],[data-section="config"],[data-section="backup"],[data-section="site-quartos"],[data-section="site-textos"],[data-section="site-diferenciais"],[data-section="site-galeria"],[data-section="site-secoes"]').forEach(el => el.style.display = 'none');
        // Funcionário não gerencia o cardápio: apenas lança itens na comanda
        const produtoAdminBox = document.getElementById('produtoAdminBox');
        if (produtoAdminBox) produtoAdminBox.style.display = 'none';
    }
    setupEventListeners();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navInicial = document.querySelector('[data-section="' + secaoInicial + '"]');
    if (navInicial) navInicial.classList.add('active');
    showSection(secaoInicial);
});

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const navItems = document.querySelectorAll('.nav-item');

    menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            showSection(section);
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (window.innerWidth <= 1024) sidebar.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById('sec-' + sectionId);
    if (section) section.classList.add('active');
    currentSection = sectionId;

    switch (sectionId) {
        case 'dashboard': carregarDashboard(); break;
        case 'reservas': carregarReservas(); break;
        case 'nova-reserva': carregarNovaReservaForm(); break;
        case 'caixa': carregarCaixa(); break;
        case 'produtos': carregarProdutos(); carregarComandas(); break;
        case 'quartos': carregarQuartos(); break;
        case 'clientes': carregarClientes(); break;
        case 'financeiro': carregarFinanceiro(); break;
        case 'config': carregarConfig(); break;
        case 'backup': carregarBackups(); break;
        case 'usuarios': carregarUsuarios(); break;
        case 'site-quartos': carregarSiteQuartos(); break;
        case 'site-textos': carregarTextosSite(); break;
        case 'site-diferenciais': carregarDiferenciais(); break;
        case 'site-galeria': carregarGaleriaSite(); break;
        case 'site-secoes': carregarSecoesExtras(); break;
    }
}

function logout() { localStorage.clear(); location.href = 'login.html'; }

function fmtMoeda(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
function fmtData(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'; }
function fmtDataHora(d) { return d ? new Date(d).toLocaleString('pt-BR') : '-'; }
function hoje() { return new Date().toISOString().slice(0, 10); }

function showMsg(elId, msg, isError = false) { const el = document.getElementById(elId); if (el) { el.textContent = msg; el.className = 'msg ' + (isError ? 'error' : 'success'); } }
function showLoading(containerId, msg = 'Carregando...') { const el = document.getElementById(containerId); if (el) el.innerHTML = '<div class="loading">' + msg + '</div>'; }
function showError(containerId, msg) { const el = document.getElementById(containerId); if (el) el.innerHTML = '<div class="error-msg">' + msg + '</div>'; }

// ============================================
// DASHBOARD
// ============================================
async function carregarDashboard() {
    try {
        const [reservas, caixa, financeiro] = await Promise.all([
            fetch(API + '/reservas', { headers: H }).then(r => r.json()),
            fetch(API + '/caixa/atual', { headers: H }).then(r => r.json()),
            fetch(API + '/financeiro', { headers: H }).then(r => r.json())
        ]);

        const hojeStr = hoje();
        const reservasAtivas = reservas.filter(r => r.status === 'ativa');
        const checkinsHoje = reservas.filter(r => r.entrada === hojeStr && r.status === 'ativa');
        const checkoutsHoje = reservas.filter(r => r.saida === hojeStr && r.status === 'ativa');

        document.getElementById('statReservasAtivas').textContent = reservasAtivas.length;
        document.getElementById('statFaturamentoHoje').textContent = fmtMoeda(financeiro.total);
        document.getElementById('statQuartosOcupados').textContent = reservasAtivas.length + ' / 3';
        document.getElementById('statCheckinsHoje').textContent = checkinsHoje.length;

        const caixaStatusTop = document.getElementById('caixaStatusTop');
        if (caixaStatusTop) {
            if (caixa.aberto) { caixaStatusTop.textContent = 'Caixa Aberto'; caixaStatusTop.className = 'caixa-status-top aberto'; }
            else { caixaStatusTop.textContent = 'Caixa Fechado'; caixaStatusTop.className = 'caixa-status-top fechado'; }
        }

        const reservasHojeEl = document.getElementById('reservasHoje');
        if (reservasHojeEl) {
            if (checkinsHoje.length || checkoutsHoje.length) {
                reservasHojeEl.innerHTML = [...checkinsHoje.map(r => '<div class="reserva-linha"><span>Check-in</span><strong>' + r.clienteNome + '</strong> - ' + r.quartoNome + '</div>'), ...checkoutsHoje.map(r => '<div class="reserva-linha"><span>Check-out</span><strong>' + r.clienteNome + '</strong> - ' + r.quartoNome + '</div>')].join('');
            } else { reservasHojeEl.innerHTML = '<p class="small">Nenhum check-in/out hoje</p>'; }
        }

        const proximos = reservas.filter(r => r.status === 'ativa' && r.saida > hojeStr).sort((a, b) => a.saida.localeCompare(b.saida)).slice(0, 5);
        const proximosEl = document.getElementById('proximosCheckouts');
        if (proximosEl) { proximosEl.innerHTML = proximos.length ? proximos.map(r => '<div class="reserva-linha"><span>' + fmtData(r.saida) + '</span><strong>' + r.clienteNome + '</strong> - ' + r.quartoNome + '</div>').join('') : '<p class="small">Nenhum check-out agendado</p>'; }
    } catch (e) { console.error('Erro dashboard:', e); }
}

function fmtMoeda(v) { return 'R$ ' + (v || 0).toFixed(2).replace('.', ','); }
function fmtData(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'; }
function fmtDataHora(d) { return d ? new Date(d).toLocaleString('pt-BR') : '-'; }
function hoje() { return new Date().toISOString().slice(0, 10); }

function showMsg(elId, msg, isError = false) { const el = document.getElementById(elId); if (el) { el.textContent = msg; el.className = 'msg ' + (isError ? 'error' : 'success'); } }
function showLoading(containerId, msg = 'Carregando...') { const el = document.getElementById(containerId); if (el) el.innerHTML = '<div class="loading">' + msg + '</div>'; }
function showError(containerId, msg) { const el = document.getElementById(containerId); if (el) el.innerHTML = '<div class="error-msg">' + msg + '</div>'; }

// ============================================
// RESERVAS
// ============================================
async function carregarReservas() {
    const status = document.getElementById('filtroStatus').value;
    const data = document.getElementById('filtroData').value;
    let url = API + '/reservas';
    const params = [];
    if (status) params.push('status=' + status);
    if (data) params.push('data=' + data);
    if (params.length) url += '?' + params.join('&');

    try {
        const reservas = await (await fetch(url, { headers: H })).json();
        const tbody = document.querySelector('#tabelaReservas tbody');
        tbody.innerHTML = reservas.map(r => {
            const adicionaisTotal = (r.adicionais || []).reduce((s, i) => s + i.preco * i.qtd, 0);
            const total = r.totalFinal || r.valor + adicionaisTotal;
            let botoes = '';
            if (r.status === 'ativa') {
                botoes = '<button class="btn btn-sm btn-primary" onclick="abrirModalReserva(' + r.id + ')">Comanda</button><button class="btn btn-sm btn-outline" onclick="editarReserva(' + r.id + ')">Editar</button><button class="btn btn-sm btn-primary" onclick="finalizarReservaDireta(' + r.id + ')">Finalizar</button>';
            } else {
                botoes = '<button class="btn btn-sm btn-outline" onclick="verReserva(' + r.id + ')">Ver</button>';
                if (r.status === 'finalizada' || r.status === 'cancelada') {
                    botoes += '<button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirReserva(' + r.id + ')">Excluir</button>';
                }
            }
            return '<tr><td>#' + r.id + '</td><td>' + r.clienteNome + '</td><td>' + r.quartoNome + '</td><td>' + fmtData(r.entrada) + '</td><td>' + fmtData(r.saida) + '</td><td>' + r.noites + '</td><td>' + fmtMoeda(r.valor) + '</td><td>' + fmtMoeda(adicionaisTotal) + '</td><td><strong>' + fmtMoeda(total) + '</strong></td><td><span class="badge badge-' + r.status + '">' + r.status + '</span></td><td><div class="btn-group">' + botoes + '</div></td></tr>';
        }).join('') || '<tr><td colspan="11" style="text-align:center">Nenhuma reserva</td></tr>';
    } catch (e) { console.error('Erro reservas:', e); }
}

async function excluirReserva(id) {
    if (!confirm('Excluir esta reserva finalizada/cancelada?')) return;
    try {
        const r = await fetch(API + '/reservas/' + id, { method: 'DELETE', headers: H });
        if (r.ok) { alert('Reserva excluída!'); carregarReservas(); carregarDashboard(); }
        else { const j = await r.json(); alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

async function carregarNovaReservaForm() {
    try {
        const [clientes, quartos, caixa] = await Promise.all([
            fetch(API + '/clientes', { headers: H }).then(r => r.json()),
            fetch(API + '/quartos', { headers: H }).then(r => r.json()),
            fetch(API + '/caixa/atual', { headers: H }).then(r => r.json())
        ]);

        const nrCliente = document.getElementById('nrCliente');
        const nrQuarto = document.getElementById('nrQuarto');
        const btn = document.getElementById('btnNovaReserva');
        const msg = document.getElementById('nrMsg');

        nrCliente.innerHTML = '<option value="">Selecione o cliente...</option>' + clientes.map(c => '<option value="' + c.id + '">' + c.nome + '</option>').join('');
        nrQuarto.innerHTML = '<option value="">Selecione o quarto...</option>' + quartos.filter(q => q.ativo).map(q => '<option value="' + q.id + '">' + q.nome + ' - ' + fmtMoeda(q.diaria) + '/noite</option>').join('');

        if (caixa.aberto) { btn.disabled = false; msg.textContent = ''; msg.className = 'msg'; }
        else { btn.disabled = true; msg.textContent = 'Caixa fechado. Abra o caixa antes de criar reservas.'; msg.className = 'msg error'; }

        document.getElementById('nrEntrada').value = hoje();
        document.getElementById('nrSaida').value = hoje();
    } catch (e) { console.error('Erro form nova reserva:', e); }
}

async function abrirNovaReserva() {
    const clienteId = document.getElementById('nrCliente').value;
    const quartoId = document.getElementById('nrQuarto').value;
    const entrada = document.getElementById('nrEntrada').value;
    const saida = document.getElementById('nrSaida').value;
    const msg = document.getElementById('nrMsg');

    if (!clienteId || !quartoId || !entrada || !saida) { showMsg('nrMsg', 'Preencha todos os campos', true); return; }
    if (new Date(saida) <= new Date(entrada)) { showMsg('nrMsg', 'Check-out deve ser apos check-in', true); return; }

    try {
        const r = await fetch(API + '/admin/reservas', { method: 'POST', headers: H, body: JSON.stringify({ clienteId, quartoId, entrada, saida }) });
        const j = await r.json();
        if (r.ok) { showMsg('nrMsg', 'Reserva criada! Envie WhatsApp ao cliente.', false); document.getElementById('nrEntrada').value = hoje(); document.getElementById('nrSaida').value = hoje(); carregarNovaReservaForm(); carregarDashboard(); }
        else { showMsg('nrMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('nrMsg', 'Erro de conexao', true); }
}



async function abrirModalReserva(id) {
    currentReservationId = id;
    const modal = document.getElementById('modalReserva');
    const titulo = document.getElementById('modalTitulo');

    try {
        const [reserva, produtos] = await Promise.all([
            fetch(API + '/reservas/' + id, { headers: H }).then(r => r.json()),
            fetch(API + '/produtos').then(r => r.json())
        ]);

        if (!reserva) throw new Error('Reserva nao encontrada');

        titulo.textContent = 'Reserva #' + reserva.id;
        document.getElementById('reservaInfo').innerHTML = '<div class="reserva-info-item"><span class="reserva-info-label">Cliente</span><span class="reserva-info-value">' + reserva.clienteNome + '</span></div><div class="reserva-info-item"><span class="reserva-info-label">Quarto</span><span class="reserva-info-value">' + reserva.quartoNome + '</span></div><div class="reserva-info-item"><span class="reserva-info-label">Check-in</span><span class="reserva-info-value">' + fmtData(reserva.entrada) + '</span></div><div class="reserva-info-item"><span class="reserva-info-label">Check-out</span><span class="reserva-info-value">' + fmtData(reserva.saida) + '</span></div><div class="reserva-info-item"><span class="reserva-info-label">Status</span><span class="reserva-info-value badge badge-' + reserva.status + '">' + reserva.status + '</span></div>';

        document.getElementById('reservaHospedagem').innerHTML = '<p><strong>Diaria:</strong> ' + fmtMoeda(reserva.valor / reserva.noites) + ' x ' + reserva.noites + ' noites = ' + fmtMoeda(reserva.valor) + '</p>';

        const comandaProduto = document.getElementById('comandaProduto');
        comandaProduto.innerHTML = '<option value="">Selecione o produto...</option>' + produtos.filter(p => p.nome && p.preco != null).map(p => '<option value="' + p.id + '" data-preco="' + p.preco + '">' + p.nome + ' - ' + fmtMoeda(p.preco) + '</option>').join('');

        renderComandaItens(reserva.adicionais || []);
        currentReservaData = reserva;
        modal.style.display = 'flex';
    } catch (e) { console.error('Erro ao abrir modal:', e); alert('Erro ao carregar reserva'); }
}

function fecharModal() {
    document.getElementById('modalReserva').style.display = 'none';
    currentReservationId = null;
}

function renderComandaItens(itens) {
    const container = document.getElementById('comandaItens');
    const subtotalEl = document.getElementById('comandaSubtotal');
    if (!itens.length) { container.innerHTML = '<p class="small">Nenhum item na comanda</p>'; subtotalEl.textContent = 'R$ 0,00'; return; }
    let subtotal = 0;
    container.innerHTML = itens.map(item => { const total = item.preco * item.qtd; subtotal += total; return '<div class="comanda-item"><div class="comanda-item-info"><span class="comanda-item-nome">' + item.nome + '</span><span class="comanda-item-detalhe">' + item.qtd + 'x ' + fmtMoeda(item.preco) + '</span></div><span class="comanda-item-total">' + fmtMoeda(total) + '</span><button class="comanda-item-btn" onclick="removerItemComanda(' + item.produtoId + ')">Remover</button></div>'; }).join('');
    subtotalEl.textContent = fmtMoeda(subtotal);
}

async function addItemComanda() {
    const produtoId = document.getElementById('comandaProduto').value;
    const qtd = parseInt(document.getElementById('comandaQtd').value) || 1;
    if (!produtoId) return alert('Selecione um produto');

    try {
        const r = await fetch(API + '/comanda/' + currentReservationId + '/adicionar', { method: 'POST', headers: H, body: JSON.stringify({ produtoId, qtd }) });
        const j = await r.json();
        if (r.ok) { renderComandaItens(j.adicionais || []); document.getElementById('comandaProduto').value = ''; document.getElementById('comandaQtd').value = 1; }
        else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

async function removerItemComanda(produtoId) {
    if (!currentReservationId) return;
    if (!confirm('Remover este item da comanda?')) return;
    try {
        const r = await fetch(API + '/comanda/' + currentReservationId + '/item/' + produtoId, { method: 'DELETE', headers: H });
        const j = await r.json();
        if (r.ok) { renderComandaItens(j.adicionais || []); currentReservaData = j; }
        else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

async function finalizarReserva() {
    if (!currentReservationId) return;
    const forma = document.getElementById('finalForma').value;
    const btn = (typeof event !== 'undefined' && event && event.target) ? event.target : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

    // Abre a janela do WhatsApp já (evita o bloqueador de pop-up)
    const waWin = window.open('', '_blank');

    try {
        const r = await fetch(API + '/reservas/' + currentReservationId + '/finalizar', { method: 'PATCH', headers: H, body: JSON.stringify({ forma }) });
        const j = await r.json();
        if (r.ok) {
            const reserva = j.reserva;
            const whats = j.whatsapp || '';
            fecharModal();
            carregarReservas();
            carregarCaixa();
            carregarDashboard();
            // 1) Gera o recibo em PDF (vai para a pasta Downloads)
            gerarReciboPDF(reserva);
            // 2) Abre o WhatsApp do cliente com mensagem de agradecimento
            const url = montarWhatsAppURL(reserva, whats);
            if (waWin) waWin.location.href = url; else window.open(url, '_blank');
        } else {
            if (waWin) waWin.close();
            alert('Erro: ' + (j.erro || r.status));
        }
    } catch (e) {
        if (waWin) waWin.close();
        alert('Erro de conexao');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Finalizar e Receber'; }
    }
}

async function finalizarReservaDireta(id) { if (confirm('Finalizar esta reserva e lancar no caixa?')) { currentReservationId = id; document.getElementById('finalForma').value = 'dinheiro'; await finalizarReserva(); } }
async function verReserva(id) { currentReservationId = id; await abrirModalReserva(id); }

async function editarReserva(id) {
    currentReservationId = id;
    try {
        const [reserva, quartos, clientes] = await Promise.all([
            fetch(API + '/reservas/' + id, { headers: H }).then(r => r.json()),
            fetch(API + '/quartos', { headers: H }).then(r => r.json()),
            fetch(API + '/clientes', { headers: H }).then(r => r.json())
        ]);
        if (!reserva) return alert('Reserva não encontrada');
        if (reserva.status !== 'ativa') return alert('Só pode editar reservas ativas');

        document.getElementById('erEntrada').value = reserva.entrada;
        document.getElementById('erSaida').value = reserva.saida;
        document.getElementById('erQuarto').innerHTML = '<option value="">Selecione o quarto...</option>' + quartos.filter(q => q.ativo).map(q => '<option value="' + q.id + '"' + (q.id == reserva.quartoId ? ' selected' : '') + '>' + q.nome + ' - ' + fmtMoeda(q.diaria) + '/noite</option>').join('');
        document.getElementById('erCliente').innerHTML = '<option value="">Selecione o cliente...</option>' + clientes.map(c => '<option value="' + c.id + '"' + (c.id == reserva.clienteId ? ' selected' : '') + '>' + c.nome + '</option>').join('');
        document.getElementById('erReservaId').value = id;

        document.getElementById('modalEditarReserva').style.display = 'flex';
    } catch (e) { console.error('Erro ao abrir edição:', e); alert('Erro ao carregar reserva para edição'); }
}
async function salvarEdicaoReserva() {
    const id = document.getElementById('erReservaId').value;
    const entrada = document.getElementById('erEntrada').value;
    const saida = document.getElementById('erSaida').value;
    const quartoId = document.getElementById('erQuarto').value;
    if (!entrada || !saida || !quartoId) return alert('Preencha todos os campos');
    if (new Date(saida) <= new Date(entrada)) return alert('Check-out deve ser após check-in');
    try {
        const r = await fetch(API + '/reservas/' + currentReservationId, { method: 'PUT', headers: H, body: JSON.stringify({ entrada, saida, quartoId }) });
        const j = await r.json();
        if (r.ok) { alert('Reserva atualizada!'); fecharModalEditar(); carregarReservas(); carregarDashboard(); }
        else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}
function fecharModalEditar() { document.getElementById('modalEditarReserva').style.display = 'none'; currentReservationId = null; }
function fecharModal() { document.getElementById('modalReserva').style.display = 'none'; currentReservationId = null; }
function imprimirComprovante() {
    if (!currentReservationId) return;
    // Tenta gerar o PDF direto; se a biblioteca não estiver disponível, abre o comprovante para impressão
    if (window.jspdf && currentReservaData) { gerarReciboPDF(currentReservaData); return; }
    fetch(API + '/comprovante/' + currentReservationId, { headers: H })
        .then(r => r.text())
        .then(html => { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } })
        .catch(() => alert('Erro ao abrir comprovante'));
}

// Monta a URL do WhatsApp do cliente com mensagem de agradecimento
function montarWhatsAppURL(r, whatsapp) {
    let num = String(whatsapp || r.clienteTelefone || '').replace(/\D/g, '');
    if (num && num.length <= 11) num = '55' + num; // adiciona DDI Brasil se faltar
    const msg = 'Olá ' + r.clienteNome + '! 🏡 Foi um prazer receber você na Pousada Aconchego. ' +
        'Agradecemos pela sua hospedagem! Segue o comprovante da sua estadia. Volte sempre! 💚';
    return (num ? 'https://wa.me/' + num : 'https://wa.me/') + '?text=' + encodeURIComponent(msg);
}

// Gera o recibo em PDF e baixa na pasta Downloads do computador
function gerarReciboPDF(r) {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            if (currentReservationId) {
                fetch(API + '/comprovante/' + currentReservationId, { headers: H })
                    .then(x => x.text()).then(html => { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } });
            }
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const VERDE = [27, 94, 32];
        const adicionais = r.adicionais || [];
        const consumo = adicionais.reduce((s, i) => s + i.preco * i.qtd, 0);
        const total = (r.totalFinal != null) ? r.totalFinal : (r.valor + consumo);
        const money = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

        doc.setFontSize(20); doc.setTextColor(...VERDE);
        doc.text('Pousada Aconchego', 105, 22, { align: 'center' });
        doc.setFontSize(11); doc.setTextColor(90, 90, 90);
        doc.text('Recibo de Hospedagem', 105, 30, { align: 'center' });
        doc.setDrawColor(...VERDE); doc.setLineWidth(0.8); doc.line(20, 36, 190, 36);

        let y = 48;
        doc.setFontSize(11); doc.setTextColor(0, 0, 0);
        doc.text('Recibo Nº: ' + r.id, 20, y); y += 8;
        doc.text('Hóspede: ' + r.clienteNome, 20, y); y += 7;
        doc.text('Quarto: ' + r.quartoNome, 20, y); y += 7;
        doc.text('Check-in: ' + fmtData(r.entrada) + '    Check-out: ' + fmtData(r.saida) + '    (' + r.noites + ' noites)', 20, y); y += 11;
        doc.text('Hospedagem: ' + money(r.valor), 20, y); y += 8;

        if (adicionais.length) {
            doc.text('Consumo adicional:', 20, y); y += 7;
            adicionais.forEach(i => {
                doc.text('   - ' + i.qtd + 'x ' + i.nome + ' .................. ' + money(i.preco * i.qtd), 22, y);
                y += 6;
            });
            y += 2;
        }

        doc.setDrawColor(200, 200, 200); doc.line(20, y, 190, y); y += 10;
        doc.setFontSize(15); doc.setTextColor(...VERDE);
        doc.text('TOTAL: ' + money(total), 20, y); y += 12;
        doc.setFontSize(11); doc.setTextColor(0, 0, 0);
        doc.text('Forma de pagamento: ' + (r.formaPagamento || '-'), 20, y); y += 7;
        doc.text('Data: ' + new Date(r.finalizadaEm || Date.now()).toLocaleString('pt-BR'), 20, y); y += 7;
        if (r.finalizadaPor) { doc.text('Atendido por: ' + r.finalizadaPor, 20, y); y += 7; }

        doc.setFontSize(10); doc.setTextColor(120, 120, 120);
        doc.text('Obrigado pela preferência! Volte sempre!', 105, y + 10, { align: 'center' });
        doc.text('Pousada Aconchego - Bauru/SP - WhatsApp (14) 99831-3110', 105, y + 16, { align: 'center' });

        doc.save('recibo-reserva-' + r.id + '.pdf');
    } catch (e) {
        console.error('Erro ao gerar PDF:', e);
        alert('Não foi possível gerar o PDF. Use o botão Comprovante para impressão.');
    }
}

// ============================================
// CAIXA
// ============================================
async function carregarCaixa() {
    try {
        const [caixa, movimentos] = await Promise.all([
            fetch(API + '/caixa/atual', { headers: H }).then(r => r.json()),
            fetch(API + '/caixa', { headers: H }).then(r => r.json())
        ]);

        const caixaStatusTop = document.getElementById('caixaStatusTop');
        if (caixaStatusTop) {
            if (caixa.aberto) { caixaStatusTop.textContent = 'Caixa Aberto'; caixaStatusTop.className = 'caixa-status-top aberto'; }
            else { caixaStatusTop.textContent = 'Caixa Fechado'; caixaStatusTop.className = 'caixa-status-top fechado'; }
        }

        const badge = document.getElementById('caixaBadge');
        const titulo = document.getElementById('caixaTitulo');
        const infoFechado = document.getElementById('caixaInfoFechado');
        const infoAberto = document.getElementById('caixaInfoAberto');

        if (caixa.aberto) {
            const info = caixa.aberto; // { data, valorInicial, responsavel }
            const valorInicial = Number(info.valorInicial) || 0;

            badge.textContent = 'ABERTO'; badge.className = 'caixa-badge aberto'; titulo.textContent = 'Caixa Aberto';
            infoFechado.style.display = 'none'; infoAberto.style.display = 'block';
            document.getElementById('caixaValorInicialDisplay').textContent = fmtMoeda(valorInicial);

            const abertura = new Date(info.data);
            const movimentosAbertos = movimentos.filter(m => m.tipo !== 'abertura' && m.tipo !== 'fechamento' && new Date(m.data) >= abertura);
            const entradas = movimentosAbertos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor || 0), 0);
            const saidas = movimentosAbertos.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor || 0), 0);

            // Separa as entradas por forma de pagamento (só o dinheiro físico entra na gaveta)
            const porForma = { dinheiro: 0, pix: 0, cartao: 0, outros: 0 };
            movimentosAbertos.filter(m => m.tipo === 'entrada').forEach(m => {
                const f = String(m.formaPagamento || 'dinheiro').toLowerCase();
                if (f.includes('pix')) porForma.pix += Number(m.valor || 0);
                else if (f.includes('cart') || f.includes('cred') || f.includes('deb') || f.includes('boleto')) porForma.cartao += Number(m.valor || 0);
                else if (f.includes('dinheiro') || f.includes('especie')) porForma.dinheiro += Number(m.valor || 0);
                else porForma.outros += Number(m.valor || 0);
            });
            const dinheiroGaveta = valorInicial + porForma.dinheiro + porForma.outros - saidas;

            document.getElementById('caixaEntradas').textContent = fmtMoeda(entradas);
            document.getElementById('caixaSaidas').textContent = fmtMoeda(saidas);
            document.getElementById('caixaSaldo').textContent = fmtMoeda(valorInicial + entradas - saidas);
            document.getElementById('caixaDinheiroGaveta').textContent = fmtMoeda(dinheiroGaveta);
            document.getElementById('caixaBreakdown').innerHTML =
                '💵 Dinheiro: <strong>' + fmtMoeda(porForma.dinheiro) + '</strong> &nbsp;|&nbsp; ' +
                '📲 PIX: <strong>' + fmtMoeda(porForma.pix) + '</strong> &nbsp;|&nbsp; ' +
                '💳 Cartão/Boleto: <strong>' + fmtMoeda(porForma.cartao) + '</strong>' +
                (porForma.outros ? ' &nbsp;|&nbsp; Outros: <strong>' + fmtMoeda(porForma.outros) + '</strong>' : '');
        } else {
            badge.textContent = 'FECHADO'; badge.className = 'caixa-badge fechado'; titulo.textContent = 'Caixa Fechado';
            infoFechado.style.display = 'block'; infoAberto.style.display = 'none';
        }

        const tbody = document.querySelector('#tabelaCaixa tbody');
        let saldo = 0;
        tbody.innerHTML = movimentos.map(m => {
            let saldoCell = '-';
            if (m.tipo === 'abertura') { saldo = Number(m.valorInicial) || 0; saldoCell = fmtMoeda(saldo); }
            else if (m.tipo === 'entrada') { saldo += Number(m.valor) || 0; saldoCell = fmtMoeda(saldo); }
            else if (m.tipo === 'saida') { saldo -= Number(m.valor) || 0; saldoCell = fmtMoeda(saldo); }
            else if (m.tipo === 'fechamento') { saldoCell = fmtMoeda(Number(m.valorFinal) || 0); }
            return '<tr><td>' + fmtDataHora(m.data) + '</td><td><span class="badge badge-' + (m.tipo === 'entrada' ? 'ativa' : m.tipo === 'saida' ? 'cancelada' : 'finalizada') + '">' + m.tipo + '</span></td><td>' + (m.descricao || m.responsavel || '-') + '</td><td>' + (m.tipo === 'entrada' ? fmtMoeda(m.valor) : '-') + '</td><td>' + (m.tipo === 'saida' ? fmtMoeda(m.valor) : '-') + '</td><td>' + saldoCell + '</td><td>' + (m.responsavel || '-') + '</td></tr>';
        }).join('') || '<tr><td colspan="7" style="text-align:center">Nenhuma movimentacao</td></tr>';

        carregarReservasCaixa();
    } catch (e) { console.error('Erro caixa:', e); }
}

// Reservas ainda ativas (pendentes de fechamento) - visíveis para qualquer usuário
async function carregarReservasCaixa() {
    const container = document.getElementById('reservasCaixaContainer');
    if (!container) return;
    try {
        const reservas = await (await fetch(API + '/reservas', { headers: H })).json();
        const abertas = reservas.filter(r => r.status === 'ativa');
        if (!abertas.length) {
            container.innerHTML = '<p class="small">Nenhuma reserva em aberto. Crie uma na aba "Nova Reserva".</p>';
            return;
        }
        container.innerHTML = abertas.map(r => {
            const consumo = (r.adicionais || []).reduce((s, i) => s + i.preco * i.qtd, 0);
            const total = r.valor + consumo;
            return '<div class="reserva-caixa">' +
                '<div class="reserva-caixa-info">' +
                    '<strong>#' + r.id + ' - ' + r.clienteNome + '</strong>' +
                    '<span>🛏️ ' + r.quartoNome + ' • ' + fmtData(r.entrada) + ' a ' + fmtData(r.saida) + ' (' + r.noites + ' noites)</span>' +
                    '<span>Hospedagem ' + fmtMoeda(r.valor) + (consumo ? ' + Consumo ' + fmtMoeda(consumo) : '') + ' = <strong>' + fmtMoeda(total) + '</strong></span>' +
                '</div>' +
                '<div class="reserva-caixa-acoes">' +
                    '<button class="btn btn-sm btn-outline" onclick="abrirModalReserva(' + r.id + ')">👁️ Ver / Lançar Produtos</button>' +
                    '<button class="btn btn-sm btn-primary" onclick="abrirModalReserva(' + r.id + ')">✅ Finalizar</button>' +
                '</div>' +
            '</div>';
        }).join('');
    } catch (e) { container.innerHTML = '<p class="small">Erro ao carregar reservas em aberto.</p>'; }
}

async function abrirCaixa() {
    const valor = parseFloat(document.getElementById('caixaValorInicial').value) || 0;
    try {
        const r = await fetch(API + '/caixa/abrir', { method: 'POST', headers: H, body: JSON.stringify({ valorInicial: valor }) });
        if (r.ok) { alert('Caixa aberto!'); document.getElementById('caixaValorInicial').value = ''; carregarCaixa(); carregarDashboard(); carregarNovaReservaForm(); }
        else { const j = await r.json(); alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

async function fecharCaixa() {
    const valor = parseFloat(document.getElementById('caixaValorFinal').value) || 0;
    if (!confirm('Fechar caixa com valor contado: ' + fmtMoeda(valor) + '?')) return;
    try {
        const r = await fetch(API + '/caixa/fechar', { method: 'POST', headers: H, body: JSON.stringify({ valorFinal: valor }) });
        const j = await r.json();
        if (r.ok) {
            alert('Caixa fechado!');
            document.getElementById('caixaValorFinal').value = '';
            carregarCaixa();
            carregarDashboard();
            
            // Se retornou PDF, abrir para impressão e WhatsApp
            if (j.fechamento && j.fechamento.pdfHTML) {
                abrirPDFcomWhatsApp(j.fechamento.pdfHTML, valor);
            }
        } else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

function abrirPDFcomWhatsApp(html, valor) {
    // Abrir nova janela com o PDF
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    
    // Link WhatsApp
    const msg = 'Fechamento de caixa da Pousada Aconchego - ' + new Date().toLocaleDateString('pt-BR') + '. Total: ' + fmtMoeda(valor);
    const whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
    
    // Mostrar modal com opções
    setTimeout(() => {
        if (confirm('Deseja enviar o recibo via WhatsApp para o cliente?')) {
            window.open('https://wa.me/?text=' + encodeURIComponent('Fechamento de caixa da Pousada Aconchego - ' + new Date().toLocaleDateString('pt-BR') + '. Total: R$ ' + valor.toFixed(2).replace('.', ',')), '_blank');
        }
    }, 1000);
}

// ============================================
// PRODUTOS / COMANDA
// ============================================
async function carregarProdutos() {
    try {
        const produtos = await (await fetch(API + '/produtos')).json();
        const tbody = document.querySelector('#tabelaProdutos tbody');
        const podeGerenciar = user.role === 'admin';
        const acoesProduto = (p) => podeGerenciar
            ? '<button class="btn btn-sm btn-outline" onclick="editarProduto(' + p.id + ', \'' + p.nome.replace(/'/g, "\\'") + '\', ' + p.preco + ')">Editar</button><button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirProduto(' + p.id + ')">Excluir</button>'
            : '<span class="small">—</span>';
        tbody.innerHTML = produtos.filter(p => p.nome && p.preco != null).map(p => '<tr><td>#' + p.id + '</td><td>' + p.nome + '</td><td>' + fmtMoeda(p.preco) + '</td><td>' + acoesProduto(p) + '</td></tr>').join('') || '<tr><td colspan="4" style="text-align:center">Nenhum produto</td></tr>';
    } catch (e) { console.error('Erro produtos:', e); }
}

async function addProduto() {
    const nome = document.getElementById('pNome').value;
    const preco = parseFloat(document.getElementById('pPreco').value);
    if (!nome || isNaN(preco)) return showMsg('pMsg', 'Preencha nome e preco', true);
    try {
        const r = await fetch(API + '/produtos', { method: 'POST', headers: H, body: JSON.stringify({ nome, preco }) });
        if (r.ok) { showMsg('pMsg', 'Produto adicionado!', false); document.getElementById('pNome').value = ''; document.getElementById('pPreco').value = ''; carregarProdutos(); }
        else { const j = await r.json(); showMsg('pMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('pMsg', 'Erro de conexao', true); }
}

async function editarProduto(id, nome, preco) {
    const n = prompt('Nome:', nome); if (!n) return;
    const p = prompt('Preco:', preco); if (!p) return;
    try { await fetch(API + '/produtos/' + id, { method: 'PUT', headers: H, body: JSON.stringify({ nome: n, preco: p }) }); carregarProdutos(); } catch (e) { alert('Erro'); }
}

async function excluirProduto(id) { if (!confirm('Excluir produto?')) return; try { await fetch(API + '/produtos/' + id, { method: 'DELETE', headers: H }); carregarProdutos(); } catch (e) { alert('Erro'); } }

async function carregarComandas() {
    try {
        const reservas = await (await fetch(API + '/reservas', { headers: H })).json();
        const ativas = reservas.filter(r => r.status === 'ativa');
        const container = document.getElementById('comandasContainer');
        if (!ativas.length) { container.innerHTML = '<p class="small">Nenhuma reserva ativa com comanda aberta</p>'; return; }
        container.innerHTML = ativas.map(r => {
            const subtotal = (r.adicionais || []).reduce((s, i) => s + i.preco * i.qtd, 0);
            return '<div class="card-full" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><strong>#' + r.id + ' - ' + r.clienteNome + '</strong> (' + r.quartoNome + ')<span class="badge badge-ativa" style="margin-left:8px">' + r.entrada + ' to ' + r.saida + '</span></div><button class="btn btn-primary" onclick="abrirModalReserva(' + r.id + ')">Comanda</button></div><div class="comanda-total">Subtotal Adicionais: ' + fmtMoeda(subtotal) + '</div>' + (r.adicionais || []).length ? (r.adicionais || []).map(i => '<div class="comanda-item"><div class="comanda-item-info"><span class="comanda-item-nome">' + i.nome + '</span><span class="comanda-item-detalhe">' + i.qtd + 'x ' + fmtMoeda(i.preco) + '</span></div><span class="comanda-item-total">' + fmtMoeda(i.preco * i.qtd) + '</span></div>').join('') : '<p class="small">Nenhum item</p>' + '</div>';
        }).join('');
    } catch (e) { console.error('Erro comandas:', e); }
}

// ============================================
// QUARTOS
// ============================================
async function carregarQuartos() {
    try {
        const quartos = await (await fetch(API + '/quartos')).json();
        const tbody = document.querySelector('#tabelaQuartos tbody');
        tbody.innerHTML = quartos.map(q => '<tr><td>#' + q.id + '</td><td>' + q.nome + '</td><td>' + fmtMoeda(q.diaria) + '</td><td>' + q.capacidade + ' pessoa(s)</td><td><span class="badge badge-' + (q.ativo ? 'ativa' : 'cancelada') + '">' + (q.ativo ? 'Ativo' : 'Inativo') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="editarQuarto(' + q.id + ', \'' + q.nome.replace(/'/g, "\\'") + '\', ' + q.diaria + ', ' + q.capacidade + ')">Editar</button><button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirQuarto(' + q.id + ')">Excluir</button></td></tr>').join('') || '<tr><td colspan="6" style="text-align:center">Nenhum quarto</td></tr>';
    } catch (e) { console.error('Erro quartos:', e); }
}

async function addQuarto() {
    const nome = document.getElementById('qNome').value;
    const diaria = parseFloat(document.getElementById('qDiaria').value);
    const cap = parseInt(document.getElementById('qCap').value) || 2;
    if (!nome || isNaN(diaria)) return showMsg('qMsg', 'Preencha nome e diaria', true);

    try {
        const r = await fetch(API + '/quartos', { method: 'POST', headers: H, body: JSON.stringify({ nome, diaria, capacidade: cap }) });
        if (r.ok) { showMsg('qMsg', 'Quarto cadastrado!', false); document.getElementById('qNome').value = ''; document.getElementById('qDiaria').value = ''; document.getElementById('qCap').value = ''; carregarQuartos(); carregarNovaReservaForm(); }
        else { const j = await r.json(); showMsg('qMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('qMsg', 'Erro de conexao', true); }
}

async function editarQuarto(id, nome, diaria, cap) {
    const n = prompt('Nome:', nome); if (!n) return;
    const d = prompt('Diaria:', diaria); if (!d) return;
    const c = prompt('Capacidade:', cap); if (!c) return;
    try { await fetch(API + '/quartos/' + id, { method: 'PUT', headers: H, body: JSON.stringify({ nome: n, diaria: d, capacidade: c }) }); carregarQuartos(); carregarNovaReservaForm(); } catch (e) { alert('Erro'); }
}

async function excluirQuarto(id) { if (!confirm('Excluir quarto?')) return; try { await fetch(API + '/quartos/' + id, { method: 'DELETE', headers: H }); carregarQuartos(); carregarNovaReservaForm(); } catch (e) { alert('Erro'); } }

// ============================================
// CLIENTES
// ============================================
async function carregarClientes() {
    try {
        const clientes = await (await fetch(API + '/clientes', { headers: H })).json();
        const tbody = document.querySelector('#tabelaClientes tbody');
        tbody.innerHTML = clientes.map(c =>
            '<tr><td>#' + c.id + '</td><td>' + c.nome + '</td><td>' + c.email + '</td><td>' + (c.telefone || '-') + '</td><td>' + (c.criadoEm ? fmtDataHora(c.criadoEm) : '-') + '</td>' +
            '<td><button class="btn btn-sm btn-outline" onclick="editarCliente(' + c.id + ', \'' + String(c.nome).replace(/'/g, "\\'") + '\', \'' + String(c.email).replace(/'/g, "\\'") + '\', \'' + String(c.telefone || '').replace(/'/g, "\\'") + '\')">Editar</button>' +
            '<button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirCliente(' + c.id + ')">Excluir</button></td></tr>'
        ).join('') || '<tr><td colspan="6" style="text-align:center">Nenhum cliente</td></tr>';
    } catch (e) { console.error('Erro clientes:', e); }
}

async function addCliente() {
    const nome = document.getElementById('cNome').value;
    const email = document.getElementById('cEmail').value;
    const senha = document.getElementById('cSenha').value;
    const telefone = document.getElementById('cTelefone').value;
    if (!nome || !email || !senha) return showMsg('cMsg', 'Preencha nome, email e senha', true);
    try {
        const r = await fetch(API + '/clientes', { method: 'POST', headers: H, body: JSON.stringify({ nome, email, senha, telefone }) });
        if (r.ok) {
            showMsg('cMsg', 'Cliente cadastrado!', false);
            document.getElementById('cNome').value = '';
            document.getElementById('cEmail').value = '';
            document.getElementById('cSenha').value = '';
            document.getElementById('cTelefone').value = '';
            carregarClientes(); carregarNovaReservaForm();
        } else { const j = await r.json(); showMsg('cMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('cMsg', 'Erro de conexao', true); }
}

async function editarCliente(id, nome, email, telefone) {
    const n = prompt('Nome:', nome); if (n === null) return;
    const e = prompt('Email:', email); if (e === null) return;
    const t = prompt('Telefone:', telefone); if (t === null) return;
    const s = prompt('Nova senha (deixe vazio para manter):', '');
    const body = { nome: n, email: e, telefone: t };
    if (s) body.senha = s;
    try {
        const r = await fetch(API + '/clientes/' + id, { method: 'PUT', headers: H, body: JSON.stringify(body) });
        if (r.ok) { carregarClientes(); carregarNovaReservaForm(); }
        else { const j = await r.json(); alert('Erro: ' + (j.erro || r.status)); }
    } catch (err) { alert('Erro'); }
}

async function excluirCliente(id) {
    if (!confirm('Excluir este cliente?')) return;
    try { await fetch(API + '/clientes/' + id, { method: 'DELETE', headers: H }); carregarClientes(); carregarNovaReservaForm(); } catch (e) { alert('Erro'); }
}

// ============================================
// FINANCEIRO
// ============================================
async function carregarFinanceiro() {
    try {
        const f = await (await fetch(API + '/financeiro', { headers: H })).json();
        document.getElementById('fatTotal').textContent = fmtMoeda(f.total);

        const tbodyMes = document.querySelector('#tabelaMensal tbody');
        tbodyMes.innerHTML = Object.entries(f.porMes || {}).map(([mes, valor]) => '<tr><td>' + mes + '</td><td>' + fmtMoeda(valor) + '</td><td>-</td><td>-</td><td>-</td></tr>').join('') || '<tr><td colspan="5" style="text-align:center">Sem dados</td></tr>';

        const tbodyPag = document.querySelector('#tabelaPagamentos tbody');
        tbodyPag.innerHTML = (f.pagamentos || []).map(p => '<tr><td>' + fmtDataHora(p.data) + '</td><td>#' + p.reservaId + '</td><td>-</td><td>' + p.forma + '</td><td>' + fmtMoeda(p.valor) + '</td></tr>').join('') || '<tr><td colspan="5" style="text-align:center">Sem pagamentos</td></tr>';
    } catch (e) { console.error('Erro financeiro:', e); }
}

// ============================================
// CONFIGURACOES
// ============================================
async function carregarConfig() {
    try {
        const s = await (await fetch(API + '/site')).json();
        document.getElementById('sTitulo').value = s.titulo || '';
        document.getElementById('sSub').value = s.subtitulo || '';
        document.getElementById('sDesc').value = s.descricao || '';
        document.getElementById('sTel').value = s.telefone || '';
        document.getElementById('sEmail').value = s.email || '';
        document.getElementById('sWpp').value = s.whatsapp || '';
        document.getElementById('sImg').value = s.heroImg || '';
        document.getElementById('sLogo').value = s.logo || '';
        renderGaleriaAdmin(s.galeria || []);
    } catch (e) { console.error('Erro config:', e); }
}

let galeriaAdminAtual = [];

function renderGaleriaAdmin(galeria) {
    galeriaAdminAtual = Array.isArray(galeria) ? galeria : [];
    const container = document.getElementById('galeriaAdmin');
    container.innerHTML = galeriaAdminAtual.map((u, i) => { const url = typeof u === 'string' ? u : u.url; const isVideo = /\.(mp4|webm|mov)$/i.test(url); return '<p>' + (isVideo ? 'Video ' + url : '<img src="' + url + '" style="width:80px;height:60px;object-fit:cover;border-radius:8px">') + ' <button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="removerGaleria(' + i + ')">Remover</button></p>'; }).join('') || '<p class="small">Nenhuma midia</p>';
}

async function salvarSite() {
    try {
        const r = await fetch(API + '/site', { method: 'PUT', headers: H, body: JSON.stringify({ titulo: document.getElementById('sTitulo').value, subtitulo: document.getElementById('sSub').value, descricao: document.getElementById('sDesc').value, telefone: document.getElementById('sTel').value, email: document.getElementById('sEmail').value, whatsapp: document.getElementById('sWpp').value, heroImg: document.getElementById('sImg').value, logo: document.getElementById('sLogo').value, galeria: galeriaAdminAtual }) });
        const j = await r.json();
        showMsg('sMsg', r.ok ? 'Salvo! Recarregue o site para ver.' : 'Erro: ' + (j.erro || r.status), !r.ok);
    } catch (e) { showMsg('sMsg', 'Erro de conexao', true); }
}

function toBase64(file) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); }); }

async function uploadLogo() {
    const f = document.getElementById('sLogoFile').files[0];
    if (!f) return;
    showMsg('sMsg', 'Enviando...', false);
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) { document.getElementById('sLogo').value = j.url; await salvarSite(); } else showMsg('sMsg', 'Erro no upload', true);
}

async function uploadHero() {
    const f = document.getElementById('sImgFile').files[0];
    if (!f) return;
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) document.getElementById('sImg').value = j.url;
}

async function uploadGaleria() {
    const f = document.getElementById('gFile').files[0];
    if (!f) return;
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) { galeriaAdminAtual.push(j.url); renderGaleriaAdmin(galeriaAdminAtual); await salvarSite(); }
}

function addFoto() {
    const url = document.getElementById('gUrl').value;
    if (!url) return;
    galeriaAdminAtual.push(url);
    document.getElementById('gUrl').value = '';
    renderGaleriaAdmin(galeriaAdminAtual);
    salvarSite();
}

function removerGaleria(i) { galeriaAdminAtual.splice(i, 1); renderGaleriaAdmin(galeriaAdminAtual); salvarSite(); }

// ============================================
// SITE - QUARTOS DO SITE
// ============================================
async function carregarSiteQuartos() {
    try {
        const quartos = await (await fetch(API + '/site/quartos', { headers: H })).json();
        const tbody = document.querySelector('#tabelaSiteQuartos tbody');
        tbody.innerHTML = quartos.map(q => '<tr><td>#' + q.id + '</td><td>' + q.nome + '</td><td>' + fmtMoeda(q.diaria) + '</td><td>' + q.capacidade + '</td><td>' + (q.foto ? '<img src="' + q.foto + '" style="width:60px;height:40px;object-fit:cover;border-radius:4px">' : '-') + '</td><td>' + (q.descricao || '-') + '</td><td><span class="badge badge-' + (q.ativo ? 'ativa' : 'cancelada') + '">' + (q.ativo ? 'Ativo' : 'Inativo') + '</span></td><td><button class="btn btn-sm btn-outline" onclick="editarSiteQuarto(' + q.id + ', \'' + q.nome.replace(/'/g, "\\'") + '\', ' + q.diaria + ', ' + q.capacidade + ', \'' + (q.foto || '').replace(/'/g, "\\'") + '\', \'' + (q.descricao || '').replace(/'/g, "\\'") + '\', ' + q.ativo + ')">Editar</button><button class="btn btn-sm btn-outline" onclick="escolherFotoQuarto(' + q.id + ')">📷 Foto</button><button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirSiteQuarto(' + q.id + ')">Excluir</button></td></tr>').join('') || '<tr><td colspan="8" style="text-align:center">Nenhum quarto</td></tr>';
        preencherGaleriaQuarto();
    } catch (e) { console.error('Erro site quartos:', e); }
}

async function addSiteQuarto() {
    const nome = document.getElementById('sqNome').value;
    const diaria = parseFloat(document.getElementById('sqDiaria').value);
    const cap = parseInt(document.getElementById('sqCap').value) || 2;
    const foto = document.getElementById('sqFoto').value;
    const desc = document.getElementById('sqDesc').value;
    const ativo = document.getElementById('sqAtivo').checked;
    if (!nome || isNaN(diaria)) return showMsg('sqMsg', 'Preencha nome e diária', true);
    try {
        const r = await fetch(API + '/site/quartos', { method: 'POST', headers: H, body: JSON.stringify({ nome, diaria, capacidade: cap, foto, descricao: desc, ativo }) });
        if (r.ok) { showMsg('sqMsg', 'Quarto adicionado!', false); document.getElementById('sqNome').value = ''; document.getElementById('sqDiaria').value = ''; document.getElementById('sqCap').value = ''; document.getElementById('sqFoto').value = ''; document.getElementById('sqDesc').value = ''; document.getElementById('sqFotoFile').value = ''; mostrarPreviewQuarto(''); carregarSiteQuartos(); carregarQuartos(); carregarNovaReservaForm(); }
        else { const j = await r.json(); showMsg('sqMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('sqMsg', 'Erro de conexao', true); }
}

async function editarSiteQuarto(id, nome, diaria, cap, foto, descParam, ativo) {
    const n = prompt('Nome:', nome); if (!n) return;
    const d = prompt('Diária:', diaria); if (!d) return;
    const c = prompt('Capacidade:', cap); if (!c) return;
    const f = prompt('URL Foto:', foto); if (f === null) return;
    const descNova = prompt('Descrição:', ''); if (descNova === null) return;
    const a = confirm('Ativo?'); 
    try {
        await fetch(API + '/site/quartos/' + id, { method: 'PUT', headers: H, body: JSON.stringify({ nome: n, diaria: d, capacidade: c, foto: f, descricao: descNova, ativo: a }) });
        carregarSiteQuartos(); carregarQuartos(); carregarNovaReservaForm();
    } catch (e) { alert('Erro'); }
}

async function excluirSiteQuarto(id) { if (!confirm('Excluir este quarto?')) return; try { await fetch(API + '/site/quartos/' + id, { method: 'DELETE', headers: H }); carregarSiteQuartos(); carregarQuartos(); carregarNovaReservaForm(); } catch (e) { alert('Erro'); } }

// ------ Fotos dos quartos (upload do computador ou escolha na galeria) ============
function mostrarPreviewQuarto(url) {
    const img = document.getElementById('sqFotoPreview');
    if (!img) return;
    if (url) { img.src = url; img.style.display = 'block'; } else { img.removeAttribute('src'); img.style.display = 'none'; }
}

// Envia a foto escolhida no formulario do novo quarto
async function uploadFotoQuarto() {
    const inp = document.getElementById('sqFotoFile');
    const f = inp.files[0];
    if (!f) { showMsg('sqMsg', 'Escolha uma imagem primeiro', true); return; }
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) {
        document.getElementById('sqFoto').value = j.url;
        mostrarPreviewQuarto(j.url);
        showMsg('sqMsg', 'Foto enviada! Agora clique em Adicionar (ou Editar).', false);
    } else { showMsg('sqMsg', 'Erro no upload da foto', true); }
}

// Preenche o select "Escolher uma foto da galeria" com as imagens já enviadas
async function preencherGaleriaQuarto() {
    try {
        const s = await (await fetch(API + '/site/public')).json();
        const sel = document.getElementById('sqFotoGaleria');
        if (!sel) return;
        const fotos = (s.galeria || [])
            .map(u => (typeof u === 'string' ? u : u.url))
            .filter(u => u && !/\.(mp4|webm|mov)$/i.test(u));
        sel.innerHTML = '<option value="">— Escolher uma foto da galeria —</option>' +
            fotos.map(u => '<option value="' + u + '">' + u.split('/').pop() + '</option>').join('');
    } catch (e) { /* silencioso */ }
}

// Foto para um quarto já existente (botão na tabela)
let _sqFotoRowId = null;
function escolherFotoQuarto(id) {
    _sqFotoRowId = id;
    const inp = document.getElementById('sqFotoRowFile');
    if (!inp) return;
    inp.value = '';
    inp.click();
}

// Handler do upload por linha (registrado uma vez)
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('sqFotoRowFile');
    if (!inp) return;
    inp.addEventListener('change', async () => {
        const f = inp.files[0];
        if (!f || !_sqFotoRowId) return;
        try {
            const b64 = await toBase64(f);
            const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
            const j = await r.json();
            if (j.url) {
                await fetch(API + '/site/quartos/' + _sqFotoRowId, { method: 'PUT', headers: H, body: JSON.stringify({ foto: j.url }) });
                carregarSiteQuartos();
            } else {
                alert('Erro no upload da foto');
            }
        } catch (e) { alert('Erro no upload da foto'); }
    });
});

// ============================================
// SITE - TEXTOS DO SITE
// ============================================
async function carregarTextosSite() {
    try {
        const s = await (await fetch(API + '/site/public')).json();
        document.getElementById('stTitulo').value = s.titulo || '';
        document.getElementById('stSubtitulo').value = s.subtitulo || '';
        document.getElementById('stDescricao').value = s.descricao || '';
        document.getElementById('stQuartosTitulo').value = s.quartosTitulo || '';
        document.getElementById('stQuartosSub').value = s.quartosSubtitulo || '';
        document.getElementById('stDifTitulo').value = s.diferenciaisTitulo || '';
        document.getElementById('stTelefone').value = s.telefone || '';
        document.getElementById('stEmail').value = s.email || '';
        document.getElementById('stWhatsApp').value = s.whatsapp || '';
        document.getElementById('stEndereco').value = s.endereco || '';
        document.getElementById('stHeroImg').value = s.heroImg || '';
        document.getElementById('stLogo').value = s.logo || '';
        document.getElementById('stSobre').value = s.sobre || '';
    } catch (e) { console.error('Erro textos site:', e); }
}

async function salvarTextosSite() {
    try {
        const r = await fetch(API + '/site/textos', { method: 'PUT', headers: H, body: JSON.stringify({
            titulo: document.getElementById('stTitulo').value,
            subtitulo: document.getElementById('stSubtitulo').value,
            descricao: document.getElementById('stDescricao').value,
            telefone: document.getElementById('stTelefone').value,
            email: document.getElementById('stEmail').value,
            whatsapp: document.getElementById('stWhatsApp').value,
            endereco: document.getElementById('stEndereco').value,
            quartosTitulo: document.getElementById('stQuartosTitulo').value,
            quartosSubtitulo: document.getElementById('stQuartosSub').value,
            diferenciaisTitulo: document.getElementById('stDifTitulo').value,
            heroImg: document.getElementById('stHeroImg').value,
            logo: document.getElementById('stLogo').value,
            sobre: document.getElementById('stSobre').value
        }) });
        const j = await r.json();
        showMsg('stMsg', r.ok ? 'Salvo! Recarregue o site para ver.' : 'Erro: ' + (j.erro || r.status), !r.ok);
    } catch (e) { showMsg('stMsg', 'Erro de conexao', true); }
}

async function uploadLogoSite() {
    const f = document.getElementById('stLogoFile').files[0];
    if (!f) return;
    showMsg('stMsg', 'Enviando...', false);
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) { document.getElementById('stLogo').value = j.url; await salvarSite(); }
    else showMsg('stMsg', 'Erro no upload', true);
}

async function uploadHeroSite() {
    const f = document.getElementById('stHeroFile').files[0];
    if (!f) return;
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) document.getElementById('stHeroImg').value = j.url;
}

// ============================================
// SITE - DIFERENCIAIS
// ============================================
async function carregarDiferenciais() {
    try {
        const difs = await (await fetch(API + '/site/diferenciais', { headers: H })).json();
        const tbody = document.querySelector('#tabelaDiferenciais tbody');
        tbody.innerHTML = difs.map(d => '<tr><td>#' + d.id + '</td><td>' + d.icone + '</td><td>' + d.titulo + '</td><td>' + d.descricao + '</td><td><button class="btn btn-sm btn-outline" onclick="editarDiferencial(' + d.id + ', \'' + d.icone.replace(/'/g, "\\'") + '\', \'' + d.titulo.replace(/'/g, "\\'") + '\', \'' + d.descricao.replace(/'/g, "\\'") + '\')">Editar</button><button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirDiferencial(' + d.id + ')">Excluir</button></td></tr>').join('') || '<tr><td colspan="5" style="text-align:center">Nenhum diferencial</td></tr>';
    } catch (e) { console.error('Erro diferenciais:', e); }
}

async function addDiferencial() {
    const icone = document.getElementById('dfIcone').value;
    const titulo = document.getElementById('dfTitulo').value;
    const desc = document.getElementById('dfDesc').value;
    if (!icone || !titulo) return showMsg('dfMsg', 'Preencha ícone e título', true);
    try {
        const r = await fetch(API + '/site/diferenciais', { method: 'POST', headers: H, body: JSON.stringify({ icone, titulo, descricao: desc }) });
        if (r.ok) { showMsg('dfMsg', 'Diferencial adicionado!', false); document.getElementById('dfIcone').value = ''; document.getElementById('dfTitulo').value = ''; document.getElementById('dfDesc').value = ''; carregarDiferenciais(); }
        else { const j = await r.json(); showMsg('dfMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('dfMsg', 'Erro de conexao', true); }
}

async function editarDiferencial(id, icone, titulo, descParam) {
    const i = prompt('Ícone:', icone); if (!i) return;
    const t = prompt('Título:', titulo); if (!t) return;
    const d = prompt('Descrição:', descParam); if (!d) return;
    try { await fetch(API + '/site/diferenciais/' + id, { method: 'PUT', headers: H, body: JSON.stringify({ icone: i, titulo: t, descricao: d }) }); carregarDiferenciais(); } catch (e) { alert('Erro'); }
}

async function excluirDiferencial(id) { if (!confirm('Excluir este diferencial?')) return; try { await fetch(API + '/site/diferenciais/' + id, { method: 'DELETE', headers: H }); carregarDiferenciais(); } catch (e) { alert('Erro'); } }

// ============================================
// SITE - GALERIA DO SITE
// ============================================
let galeriaSiteAtual = [];

async function carregarGaleriaSite() {
    try {
        const galeria = await (await fetch(API + '/site/public')).json().then(s => s.galeria || []);
        galeriaSiteAtual = galeria;
        const container = document.getElementById('galeriaSiteAdmin');
        container.innerHTML = galeriaSiteAtual.map((u, i) => { const url = typeof u === 'string' ? u : u.url; const isVideo = /\.(mp4|webm|mov)$/i.test(url); return '<p>' + (isVideo ? '🎥 <video src="' + url + '" style="width:80px;height:60px;object-fit:cover;border-radius:8px"></video>' : '<img src="' + url + '" style="width:80px;height:60px;object-fit:cover;border-radius:8px">') + ' <span style="margin:0 10px;color:#666;font-size:.8rem">' + (typeof u === 'object' && u.legenda ? u.legenda : '') + '</span> <button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="removerGaleriaSite(' + i + ')">Remover</button></p>'; }).join('') || '<p class="small">Nenhuma mídia</p>';
    } catch (e) { console.error('Erro galeria site:', e); }
}

async function uploadGaleriaSite() {
    const f = document.getElementById('sgFile').files[0];
    if (!f) return;
    const b64 = await toBase64(f);
    const r = await fetch(API + '/upload', { method: 'POST', headers: H, body: JSON.stringify({ nome: f.name, base64: b64 }) });
    const j = await r.json();
    if (j.url) { galeriaSiteAtual.push({ url: j.url, tipo: f.type.startsWith('video') ? 'video' : 'foto', legenda: '' }); renderGaleriaSite(); await salvarGaleriaSite(); }
    else alert('Erro no upload');
}

function addGaleriaSite() {
    const url = document.getElementById('sgUrl').value;
    const legenda = document.getElementById('sgLegenda').value;
    if (!url) return;
    galeriaSiteAtual.push({ url, tipo: url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') ? 'video' : 'foto', legenda });
    document.getElementById('sgUrl').value = '';
    document.getElementById('sgLegenda').value = '';
    renderGaleriaSite();
    salvarGaleriaSite();
}

function removerGaleriaSite(i) { galeriaSiteAtual.splice(i, 1); renderGaleriaSite(); salvarGaleriaSite(); }

async function salvarGaleriaSite() {
    try {
        await fetch(API + '/site', { method: 'PUT', headers: H, body: JSON.stringify({ galeria: galeriaSiteAtual }) });
    } catch (e) { console.error('Erro salvar galeria:', e); }
}

// ============================================
// SITE - SEÇÕES EXTRAS
// ============================================
async function carregarSecoesExtras() {
    try {
        const secoes = await (await fetch(API + '/site/secoes', { headers: H })).json();
        const tbody = document.querySelector('#tabelaSecoesExtras tbody');
        tbody.innerHTML = secoes.map(s => '<tr><td>#' + s.id + '</td><td>' + s.titulo + '</td><td>' + s.tipo + '</td><td>' + s.ordem + '</td><td><button class="btn btn-sm btn-outline" onclick="editarSecaoExtra(' + s.id + ', \'' + s.titulo.replace(/'/g, "\\'") + '\', \'' + s.tipo + '\', ' + s.ordem + ', \'' + (s.conteudo || '').replace(/'/g, "\\'") + '\')">Editar</button><button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirSecaoExtra(' + s.id + ')">Excluir</button></td></tr>').join('') || '<tr><td colspan="5" style="text-align:center">Nenhuma seção</td></tr>';
    } catch (e) { console.error('Erro secoes extras:', e); }
}

async function addSecaoExtra() {
    const titulo = document.getElementById('seTitulo').value;
    const tipo = document.getElementById('seTipo').value;
    const ordem = parseInt(document.getElementById('seOrdem').value) || 1;
    const conteudo = document.getElementById('seConteudo').value;
    if (!titulo || !conteudo) return showMsg('seMsg', 'Preencha título e conteúdo', true);
    try {
        const r = await fetch(API + '/site/secoes', { method: 'POST', headers: H, body: JSON.stringify({ titulo, tipo, conteudo, ordem }) });
        if (r.ok) { showMsg('seMsg', 'Seção adicionada!', false); document.getElementById('seTitulo').value = ''; document.getElementById('seConteudo').value = ''; document.getElementById('seOrdem').value = ''; carregarSecoesExtras(); }
        else { const j = await r.json(); showMsg('seMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('seMsg', 'Erro de conexao', true); }
}

async function editarSecaoExtra(id, titulo, tipo, ordem, conteudo) {
    const t = prompt('Título:', titulo); if (!t) return;
    const tp = prompt('Tipo (texto/html/cards):', tipo); if (!tp) return;
    const o = prompt('Ordem:', ordem); if (!o) return;
    const c = prompt('Conteúdo:', conteudo); if (c === null) return;
    try { await fetch(API + '/site/secoes/' + id, { method: 'PUT', headers: H, body: JSON.stringify({ titulo: t, tipo: tp, ordem: parseInt(o), conteudo: c }) }); carregarSecoesExtras(); } catch (e) { alert('Erro'); }
}

async function excluirSecaoExtra(id) { if (!confirm('Excluir esta seção?')) return; try { await fetch(API + '/site/secoes/' + id, { method: 'DELETE', headers: H }); carregarSecoesExtras(); } catch (e) { alert('Erro'); } }

// ============================================
// BACKUP
// ============================================
async function carregarBackups() {
    try {
        const b = await (await fetch(API + '/admin/backups', { headers: H })).json();
        const container = document.getElementById('backupsList');
        container.innerHTML = b.map(x => '<p><span>' + x + '</span><button class="btn btn-sm btn-outline" onclick="restaurarBackup(\'' + x + '\')">Restaurar</button></p>').join('') || '<p class="small">Sem backups</p>';
    } catch (e) { console.error('Erro backups:', e); }
}

async function backupAgora() { try { await fetch(API + '/admin/backup-agora', { method: 'POST', headers: H }); alert('Backup criado!'); carregarBackups(); } catch (e) { alert('Erro'); } }

async function testarConexao() {
    const msg = document.getElementById('bkMsg');
    try {
        const r = await fetch(API + '/status');
        const j = await r.json();
        if (msg) { msg.textContent = '✅ API conectada! Status: ' + (j.status || 'online'); msg.className = 'msg success'; }
        else alert('✅ API conectada! Status: ' + (j.status || 'online'));
    } catch (e) {
        if (msg) { msg.textContent = '❌ Falha ao conectar na API: ' + e.message; msg.className = 'msg error'; }
        else alert('❌ Falha ao conectar na API');
    }
}

async function backupDownload() {
    try {
        const r = await fetch(API + '/admin/backup-download', { headers: H });
        if (!r.ok) throw new Error('Erro ao baixar');
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'backup-pousada-' + new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-') + '.json';
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (e) { alert('Erro ao baixar backup: ' + e.message); }
}

async function restaurarBackup(arquivo) { if (!confirm('Restaurar backup ' + arquivo + '?')) return; try { await fetch(API + '/admin/restaurar', { method: 'POST', headers: H, body: JSON.stringify({ arquivo }) }); alert('Restaurado! Recarregue a pagina.'); location.reload(); } catch (e) { alert('Erro'); } }

async function restaurarBackupUpload() {
    const file = document.getElementById('bkFile').files[0];
    if (!file) return alert('Selecione um arquivo');
    const formData = new FormData();
    formData.append('arquivo', file);
    try {
        const r = await fetch(API + '/admin/restaurar-upload', { method: 'POST', headers: { 'Authorization': H.Authorization }, body: formData });
        const j = await r.json();
        if (r.ok) { alert('Backup restaurado! Recarregue a página.'); location.reload(); }
        else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

async function limparDados() {
    if (!confirm('ATENÇÃO: Isso vai APAGAR TODOS OS DADOS e restaurar o sistema para o estado inicial. Tem certeza?')) return;
    if (!confirm('TEM CERTEZA? Essa ação não pode ser desfeita!')) return;
    try {
        const r = await fetch(API + '/admin/limpar-dados', { method: 'POST', headers: H, body: JSON.stringify({ confirmar: true }) });
        const j = await r.json();
        if (r.ok) { alert('Sistema resetado! ' + j.msg); location.reload(); }
        else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

// Reset OPERACIONAL: apaga hospedagens/reservas, comandas, caixa e financeiro.
// Mantém quartos, fotos, clientes e produtos.
async function resetOperacional() {
    if (!confirm('ZERAR o histórico de Hospedagens (reservas), Comandas, Caixa e Financeiro?\n\nQuartos, FOTOS, clientes e produtos serão MANTIDOS.\n\nContinuar?')) return;
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    try {
        const r = await fetch(API + '/admin/reset-operacional', { method: 'POST', headers: H, body: JSON.stringify({ confirmar: true }) });
        const j = await r.json();
        if (r.ok) { alert('✅ ' + j.msg); location.reload(); }
        else { alert('Erro: ' + (j.erro || r.status)); }
    } catch (e) { alert('Erro de conexao'); }
}

// ============================================
// USUÁRIOS DO SISTEMA
// ============================================
async function carregarUsuarios() {
    try {
        const usuarios = await (await fetch(API + '/usuarios', { headers: H })).json();
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        tbody.innerHTML = usuarios.map(u => '<tr><td>#' + u.id + '</td><td>' + u.nome + '</td><td>' + u.email + '</td><td>' + (u.telefone || '-') + '</td><td><span class="badge badge-' + (u.role === 'admin' ? 'finalizada' : 'ativa') + '">' + u.role + '</span></td><td>' + (u.criadoEm ? fmtData(u.criadoEm) : '-') + '</td><td><button class="btn btn-sm btn-outline" onclick="editarUsuario(' + u.id + ', \'' + u.nome.replace(/'/g, "\\'") + '\', \'' + u.email + '\', \'' + (u.telefone || '') + '\', \'' + u.role + '\')">Editar</button>' + (u.id !== 1 ? '<button class="btn btn-sm" style="background:#fce4ec;color:#c62828;border:1px solid #c62828" onclick="excluirUsuario(' + u.id + ')">Excluir</button>' : '') + '</td></tr>').join('') || '<tr><td colspan="7" style="text-align:center">Nenhum usuário</td></tr>';
    } catch (e) { console.error('Erro usuarios:', e); }
}

async function addUsuario() {
    const nome = document.getElementById('uNome').value;
    const email = document.getElementById('uEmail').value;
    const senha = document.getElementById('uSenha').value;
    const telefone = document.getElementById('uTelefone').value;
    const role = document.getElementById('uRole').value;
    if (!nome || !email || !senha) return showMsg('uMsg', 'Preencha nome, email e senha', true);
    try {
        const r = await fetch(API + '/usuarios', { method: 'POST', headers: H, body: JSON.stringify({ nome, email, senha, telefone, role }) });
        if (r.ok) { showMsg('uMsg', 'Usuário criado!', false); document.getElementById('uNome').value = ''; document.getElementById('uEmail').value = ''; document.getElementById('uSenha').value = ''; document.getElementById('uTelefone').value = ''; carregarUsuarios(); }
        else { const j = await r.json(); showMsg('uMsg', 'Erro: ' + (j.erro || r.status), true); }
    } catch (e) { showMsg('uMsg', 'Erro de conexao', true); }
}

async function editarUsuario(id, nome, email, telefone, role) {
    const n = prompt('Nome:', nome); if (!n) return;
    const e = prompt('Email:', email); if (!e) return;
    const t = prompt('Telefone:', telefone); if (t === null) return;
    const r = prompt('Role (admin/funcionario):', role); if (!r || !['admin', 'funcionario'].includes(r)) return;
    const s = prompt('Nova senha (deixe vazio para manter):', '');
    try {
        const body = { nome: n, email: e, telefone: t, role: r };
        if (s) body.senha = s;
        await fetch(API + '/usuarios/' + id, { method: 'PUT', headers: H, body: JSON.stringify(body) });
        carregarUsuarios();
    } catch (e) { alert('Erro'); }
}

async function excluirUsuario(id) { if (!confirm('Excluir este usuário?')) return; try { await fetch(API + '/usuarios/' + id, { method: 'DELETE', headers: H }); carregarUsuarios(); } catch (e) { alert('Erro'); } }

function setupEventListeners() {
    document.getElementById('filtroStatus')?.addEventListener('change', carregarReservas);
    document.getElementById('filtroData')?.addEventListener('change', carregarReservas);
    document.getElementById('filtroAno')?.addEventListener('change', carregarFinanceiro);

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });
}

carregarDashboard();