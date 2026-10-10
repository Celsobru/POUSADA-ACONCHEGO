// Preenche o site com as configurações salvas pela admin
const BASE = location.protocol === 'file:' ? 'http://localhost:3010' : '';
fetch(BASE + '/api/site/public')
  .then(r => r.json())
  .then(s => {
    if (!s.titulo) return;
    document.title = s.titulo + ' - Bauru/SP';
    document.querySelector('.logo').innerHTML = '🏡 ' + s.titulo.replace('Pousada ', 'Pousada <span>') + (s.titulo.includes('<') ? '' : '</span>');
    const h = document.querySelector('.hero h1');
    if (h && s.subtitulo) h.innerHTML = s.subtitulo.replace('Bauru', '<span>Bauru</span>');
    const p = document.querySelector('.hero p');
    if (p && s.descricao) p.innerText = s.descricao;
    if (s.heroImg) {
        const heroImg = document.querySelector('.hero-img');
        if (heroImg) heroImg.style.setProperty('--hero-bg', "url('" + s.heroImg + "')");
    }
    // Seção "Sobre a Pousada"
    if (s.sobre) {
        const sobre = document.getElementById('sobreTexto');
        if (sobre) sobre.textContent = s.sobre;
    }
    if (s.telefone) {
        const tels = document.querySelectorAll('#contato p');
        if (tels[1]) tels[1].innerText = '📱 WhatsApp: ' + s.telefone;
    }
    if (s.email) {
        // Busca o parágrafo que contém o email (ícone ✉️ ou @)
        const ps = document.querySelectorAll('#contato p');
        ps.forEach(p => {
            if (p.textContent.includes('@') || p.textContent.includes('✉️')) {
                p.innerHTML = '✉️ ' + s.email;
            }
        });
    }
    if (s.whatsapp) {
        const wa = document.querySelector('#contato .btn-primary');
        if (wa) wa.href = 'https://wa.me/' + s.whatsapp;
    }
    if (s.logo) {
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.innerHTML = `<img src="${s.logo}" style="height:64px;max-width:560px;width:auto;object-fit:contain;display:block" alt="${s.titulo || 'Pousada Aconchego'}">`;
        }
    }
    // Títulos das seções
    if (s.quartosTitulo) document.querySelector('#quartos h2') && (document.querySelector('#quartos h2').textContent = s.quartosTitulo);
    if (s.quartosSubtitulo) document.querySelector('#quartos .section-sub') && (document.querySelector('#quartos .section-sub').textContent = s.quartosSubtitulo);
    if (s.diferenciaisTitulo) document.querySelector('#diferenciais h2') && (document.querySelector('#diferenciais h2').textContent = s.diferenciaisTitulo);
    
    // Quartos dinâmicos
    if (Array.isArray(s.quartos) && s.quartos.length) {
        const cards = document.querySelector('#quartos .cards');
        if (cards) {
            cards.innerHTML = s.quartos.map(q => `
                <div class="card">
                    <div class="card-img">${q.foto ? '<img src="' + q.foto + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px">' : (q.nome.includes('Standard') ? '🛏️' : q.nome.includes('Luxo') ? '🌿' : '👨‍👩‍👧‍👦')}</div>
                    <h3>${q.nome}</h3>
                    <p>${q.descricao || 'Quarto confortável e aconchegante.'}</p>
                    <span class="preco">a partir de R$ ${q.diaria.toFixed(2).replace('.',',')}<small>/noite</small></span>
                </div>
            `).join('');
        }
    }
    
    // Diferenciais dinâmicos
    if (Array.isArray(s.diferenciais) && s.diferenciais.length) {
        const features = document.querySelector('#diferenciais .features');
        if (features) {
            features.innerHTML = s.diferenciais.map(d => `
                <div class="feature">
                    <span>${d.icone || '✨'}</span>
                    <h4>${d.titulo}</h4>
                    <p>${d.descricao || ''}</p>
                </div>
            `).join('');
        }
    }
    
    // Galeria dinâmica (fotos e vídeos)
    if (Array.isArray(s.galeria) && s.galeria.length) {
        const gal = document.querySelector('.galeria');
        if (gal) {
            gal.innerHTML = s.galeria.map(item => {
                const url = typeof item === 'string' ? item : item.url;
                const isVideo = /\.(mp4|webm|mov)$/i.test(url);
                return isVideo
                    ? `<video class="g" src="${url}" controls style="width:100%;height:100%;object-fit:cover;border-radius:14px"></video>`
                    : `<div class="g" style="background:url('${url}') center/cover;font-size:0"></div>`;
            }).join('');
        }
    }
    
    // Seções extras dinâmicas
    if (Array.isArray(s.secoesExtras) && s.secoesExtras.length) {
        const secoesOrdenadas = s.secoesExtras.sort((a,b) => (a.ordem || 0) - (b.ordem || 0));
        secoesOrdenadas.forEach(secao => {
            const container = document.createElement('section');
            container.className = 'section extra-section';
            container.style.marginTop = '40px';
            
            if (secao.tipo === 'cards' && secao.conteudo) {
                try {
                    const cards = JSON.parse(secao.conteudo);
                    container.innerHTML = `
                        <div class="container">
                            <h2 class="section-title">${secao.titulo}</h2>
                            <div class="cards" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
                                ${cards.map(c => `
                                    <div class="card">
                                        <h3>${c.titulo || ''}</h3>
                                        <p>${c.texto || c.descricao || ''}</p>
                                        ${c.avaliacao ? '<div style="color:#c9a227">' + '★'.repeat(c.avaliacao) + '</div>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } catch (e) {
                    console.error('Erro ao parsear cards:', e, secao.conteudo);
                }
            } else if (secao.tipo === 'html' && secao.conteudo) {
                container.innerHTML = `
                    <div class="container">
                        <h2 class="section-title">${secao.titulo}</h2>
                        <div>${secao.conteudo}</div>
                    </div>
                `;
            } else if (secao.conteudo) {
                container.innerHTML = `
                    <div class="container">
                        <h2 class="section-title">${secao.titulo}</h2>
                        <p>${secao.conteudo}</p>
                    </div>
                `;
            }
            
            // Inserir antes do footer
            const footer = document.querySelector('footer');
            if (footer) footer.parentNode.insertBefore(container, footer);
        });
    }
    
    // Contato
    if (s.contato) {
        const contatoDiv = document.querySelector('#contato');
        if (contatoDiv) {
            if (s.contato.endereco) {
                const enderecoP = document.querySelector('#contato p');
                if (enderecoP && enderecoP.textContent.includes('Bauru')) {
                    enderecoP.innerHTML = '📍 ' + s.contato.endereco;
                }
            }
            if (s.contato.telefone) {
                const tels = document.querySelectorAll('#contato p');
                if (tels[1]) tels[1].innerText = '📱 WhatsApp: ' + s.contato.telefone;
            }
            if (s.contato.email) {
                const ps = document.querySelectorAll('#contato p');
                ps.forEach(p => {
                    if (p.textContent.includes('@') || p.textContent.includes('✉️')) {
                        p.innerHTML = '✉️ ' + s.contato.email;
                    }
                });
            }
            if (s.contato.whatsapp) {
                const wa = document.querySelector('#contato .btn-primary');
                if (wa) wa.href = 'https://wa.me/' + s.contato.whatsapp;
            }
        }
    }
    
}).catch(() => {});