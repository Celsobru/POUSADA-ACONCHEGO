const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'data.json');

const initial = {
  users: [], // clientes e admin
  quartos: [
    { id: 1, nome: 'Suíte Standard', diaria: 180, capacidade: 2, ativo: true, descricao: 'Cama de casal, TV, Wi-Fi e ar-condicionado.', foto: '' },
    { id: 2, nome: 'Suíte Luxo', diaria: 260, capacidade: 2, ativo: true, descricao: 'Mais espaço, frigobar, varanda e vista para o jardim.', foto: '' },
    { id: 3, nome: 'Suíte Família', diaria: 320, capacidade: 4, ativo: true, descricao: 'Até 4 pessoas, camas extras e espaço kids.', foto: '' }
  ],
  reservas: [],
  caixa: [], // {id, tipo:'abertura'|'fechamento', data, valor, responsavel}
  produtos: [
    { id: 1, nome: 'Cerveja lata', preco: 9.00 },
    { id: 2, nome: 'Refrigerante', preco: 6.00 },
    { id: 3, nome: 'Água mineral', preco: 4.00 },
    { id: 4, nome: 'Sanduíche', preco: 18.00 },
    { id: 5, nome: 'Café da manhã extra', preco: 25.00 }
  ],
  comandas: [], // {id, reservaId, clienteId, itens:[], status:'aberta'|'paga'}
  pagamentos: [],
  caixaAberto: null,
  site: {
    titulo: 'Pousada Aconchego',
    subtitulo: 'Seu refúgio em Bauru',
    descricao: 'Conforto, tranquilidade e hospitalidade de verdade no coração do interior paulista.',
    telefone: '(14) 99999-9999',
    email: 'contato@pousadaaconchego.com.br',
    whatsapp: '5514999999999',
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
};

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function save(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; }

module.exports = { load, save, nextId };
