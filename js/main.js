document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('menu').classList.toggle('active');
});

// PWA - prompt de instalação
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btnInstall').hidden = false;
});
document.getElementById('btnInstall').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
        document.getElementById('btnInstall').hidden = true;
    }
});
const heroBtn = document.getElementById('btnInstallHero');
if (heroBtn) heroBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
    } else {
        alert('📲 Para instalar: no celular, toque em "Adicionar à tela inicial" no menu do navegador.');
    }
});
