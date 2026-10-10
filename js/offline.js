/* ============================================
   MODO OFFLINE - Pousada Aconchego
   - Fila de ações quando a internet cai
   - Sincroniza automaticamente ao voltar
   ============================================ */
const FILA_KEY = 'fila_offline';

function fila() { return JSON.parse(localStorage.getItem(FILA_KEY) || '[]'); }
function salvarFila(f) { localStorage.setItem(FILA_KEY, JSON.stringify(f)); }

function mostrarStatus() {
    let b = document.getElementById('offlineBadge');
    if (!b) {
        b = document.createElement('div');
        b.id = 'offlineBadge';
        b.style.cssText = 'position:fixed;bottom:15px;left:15px;padding:8px 16px;border-radius:20px;font-size:.85rem;z-index:999;';
        document.body.appendChild(b);
    }
    b.innerText = navigator.onLine ? '🟢 Online' : '🔴 Offline — ações ficam salvas';
    b.style.background = navigator.onLine ? '#e8f5e9' : '#ffebee';
    b.style.color = navigator.onLine ? '#1b5e20' : '#c62828';
}

async function sincronizar() {
    const f = fila();
    if (!f.length) return;
    const restantes = [];
    for (const item of f) {
        try {
            await fetch(item.url, item.options);
        } catch { restantes.push(item); }
    }
    salvarFila(restantes);
    if (!restantes.length) alert('✅ Todas as ações offline foram sincronizadas com o servidor!');
}

window.addEventListener('online', () => { mostrarStatus(); sincronizar(); });
window.addEventListener('offline', mostrarStatus);
window.addEventListener('load', () => { mostrarStatus(); if (navigator.onLine) sincronizar(); });

// Interceptar fetch: se offline, enfileira ações de escrita.
// IMPORTANTE: login/cadastro NUNCA são "fingidos" como sucesso, para que o erro real apareça.
const fetchOriginal = window.fetch;
function respostaOffline(erro) {
    return Promise.resolve(new Response(
        JSON.stringify({ ok: false, offline: true, erro: erro || 'Sem conexão com o servidor. Verifique se ele está ligado (abra o INICIAR.bat).' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
    ));
}
window.fetch = function (url, options) {
    const metodo = (options && options.method) || 'GET';
    const ehAuth = String(url).indexOf('/auth/') !== -1;
    const enfileirar = () => {
        const f = fila();
        f.push({ url, options: { method: metodo, headers: options.headers, body: options.body }, quando: new Date().toISOString() });
        salvarFila(f);
        return new Response(JSON.stringify({ ok: true, offline: true, msg: 'Salvo offline. Será enviado quando a conexão voltar.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    if (!navigator.onLine && metodo !== 'GET') {
        if (ehAuth) return respostaOffline();
        return Promise.resolve(enfileirar());
    }
    return fetchOriginal(url, options).catch(err => {
        if (metodo !== 'GET') {
            if (ehAuth) return respostaOffline();
            return enfileirar();
        }
        throw err;
    });
};
