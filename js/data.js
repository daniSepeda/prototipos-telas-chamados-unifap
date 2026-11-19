/* Dados simulados — nada aqui sai do navegador.
   O estado vive em memória e é guardado no sessionStorage para sobreviver a um recarregamento. */
(function () {
  'use strict';

  const HOJE = new Date('2026-11-18T10:30:00');

  /* ---------- Vocabulário fixo ---------- */
  const ESTADOS = {
    triagem:       { label: 'Aguardando triagem', icon: 'hourglass_top',  tone: 'neutral', step: 0 },
    atribuido:     { label: 'Atribuído',          icon: 'assignment_ind', tone: 'info'   ,   step: 1 },
    reencaminhado: { label: 'Reencaminhado',      icon: 'alt_route',      tone: 'warning', step: 1 },
    atendimento:   { label: 'Em atendimento',     icon: 'construction',   tone: 'info'   ,   step: 2 },
    resolvido:     { label: 'Resolvido',          icon: 'task_alt',       tone: 'success', step: 3 },
    concluido:     { label: 'Concluído',          icon: 'verified',       tone: 'success', step: 4 },
    cancelado:     { label: 'Cancelado',          icon: 'block',          tone: 'danger',  step: -1 }
  };
  const TRILHA = ['triagem', 'atribuido', 'atendimento', 'resolvido', 'concluido'];

  const PRIORIDADES = {
    alta:  { label: 'Alta',  icon: 'keyboard_double_arrow_up', tone: 'danger' },
    media: { label: 'Média', icon: 'drag_handle',              tone: 'warning' },
    baixa: { label: 'Baixa', icon: 'keyboard_arrow_down',      tone: 'neutral' }
  };

  const PERFIS = {
    solicitante: { label: 'Solicitante',            desc: 'Abrir e acompanhar os próprios chamados' },
    gestor:      { label: 'Gestor / triagem',       desc: 'Fila, atribuição e relatórios' },
    executor:    { label: 'Executor',               desc: 'Demandas e registro de atendimento' },
    reitoria:    { label: 'Reitoria (consulta)',    desc: 'Relatórios e exportação, sem alterar chamados' },
    admin:       { label: 'Administrador do sistema', desc: 'Usuários, permissões, locais e categorias' }
  };

  const SETORES = ['Manutenção predial', 'Elétrica', 'Limpeza', 'Refrigeração', 'Tecnologia da informação', 'Administração do campus', 'Reitoria'];
  const TIPOS_AMBIENTE = ['Sala de aula', 'Laboratório', 'Auditório', 'Banheiro', 'Área comum', 'Setor administrativo', 'Depósito'];

  /* ---------- Catálogo ---------- */
  const categorias = [
    { id: 'predial', nome: 'Manutenção predial',       icon: 'construction',      setor: 'Manutenção predial',       ativo: true, exemplo: 'Portas, janelas, forro, pintura, vazamentos' },
    { id: 'eletrica', nome: 'Elétrica',                icon: 'bolt',              setor: 'Elétrica',                 ativo: true, exemplo: 'Tomadas, lâmpadas, disjuntores, fiação' },
    { id: 'refrig', nome: 'Refrigeração',              icon: 'mode_fan',          setor: 'Refrigeração',             ativo: true, exemplo: 'Ar-condicionado, bebedouros, ventiladores' },
    { id: 'ti', nome: 'Tecnologia da informação',      icon: 'lan',               setor: 'Tecnologia da informação', ativo: true, exemplo: 'Rede, projetores, computadores de sala' },
    { id: 'limpeza', nome: 'Limpeza',                  icon: 'cleaning_services', setor: 'Limpeza',                  ativo: true, exemplo: 'Sujeira acumulada, lixo, banheiros' },
    { id: 'jardim', nome: 'Jardinagem',                icon: 'yard',              setor: 'Manutenção predial',       ativo: false, exemplo: 'Poda e áreas verdes' }
  ];

  const campi = [
    { id: 'mz',  nome: 'Marco Zero do Equador', codigo: 'MZ',  ativo: true },
    { id: 'bin', nome: 'Binacional (Oiapoque)', codigo: 'BIN', ativo: true },
    { id: 'maz', nome: 'Mazagão',               codigo: 'MAZ', ativo: true },
    { id: 'san', nome: 'Santana',               codigo: 'SAN', ativo: true }
  ];
  const blocos = [];
  const andares = [];
  const ambientes = [];

  const NOMES_ANDAR = ['Térreo', '1º andar', '2º andar'];
  function addBloco(campus, letra, nome, nAndares, ativo) {
    const bid = campus + '-' + letra.toLowerCase();
    blocos.push({ id: bid, campus, nome, codigo: letra, ativo });
    for (let a = 0; a < nAndares; a++) {
      const aid = bid + '-' + a;
      andares.push({ id: aid, bloco: bid, nome: NOMES_ANDAR[a], ativo: true });
      [1, 2, 3, 5].forEach((n, i) => {
        const s = i + 1;
        const codigo = letra + '-' + (a === 0 ? 'T' : a) + '0' + n;
        ambientes.push({ id: aid + '-' + s, andar: aid, nome: 'Sala ' + codigo, codigo, tipo: 'Sala de aula', ativo: true });
      });
    }
  }
  addBloco('mz', 'A', 'Bloco A', 3, true);
  addBloco('mz', 'B', 'Bloco B', 3, true);
  addBloco('mz', 'C', 'Bloco C', 2, true);
  addBloco('mz', 'D', 'Bloco D', 2, true);
  addBloco('mz', 'F', 'Bloco F', 1, false);
  addBloco('bin', 'P', 'Bloco principal', 2, true);
  addBloco('maz', 'P', 'Bloco principal', 1, true);
  addBloco('san', 'P', 'Bloco principal', 2, true);

  // Ambientes nomeados que aparecem nos chamados
  ambientes.push(
    { id: 'mz-b-2-x1', andar: 'mz-b-2', nome: 'Sala B-204', codigo: 'B-204', tipo: 'Sala de aula', ativo: true },
    { id: 'mz-b-2-x2', andar: 'mz-b-2', nome: 'Depósito B-2', codigo: 'B-2D', tipo: 'Depósito', ativo: false },
    { id: 'mz-b-1-x1', andar: 'mz-b-1', nome: 'Banheiro feminino B-1', codigo: 'B-1BF', tipo: 'Banheiro', ativo: true },
    { id: 'mz-c-0-x1', andar: 'mz-c-0', nome: 'Laboratório de Química', codigo: 'C-LQ1', tipo: 'Laboratório', ativo: true },
    { id: 'mz-c-1-x1', andar: 'mz-c-1', nome: 'Laboratório de Informática 2', codigo: 'C-LI2', tipo: 'Laboratório', ativo: true },
    { id: 'mz-a-0-x1', andar: 'mz-a-0', nome: 'Auditório Central', codigo: 'A-AUD', tipo: 'Auditório', ativo: true },
    { id: 'mz-d-0-x1', andar: 'mz-d-0', nome: 'Biblioteca Central', codigo: 'D-BIB', tipo: 'Setor administrativo', ativo: true },
    { id: 'mz-d-1-x1', andar: 'mz-d-1', nome: 'Coordenação de Engenharia', codigo: 'D-CEN', tipo: 'Setor administrativo', ativo: true }
  );

  /* ---------- Pessoas ---------- */
  const usuarios = [
    { id: 'u1',  nome: 'Rafael Costa',      login: '2021001234', ident: '2021001234',   tipo: 'Discente',                  vinculoAtivo: true,  acessoAtivo: true,  perfis: ['solicitante'], setor: '' },
    { id: 'u2',  nome: 'Ana Paula Souza',   login: '1765432',    ident: 'SIAPE 1765432', tipo: 'Técnica-administrativa',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['gestor', 'solicitante'], setor: 'Administração do campus' },
    { id: 'u3',  nome: 'Joana Ribeiro',     login: '1987654',    ident: 'SIAPE 1987654', tipo: 'Técnica-administrativa',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['executor', 'solicitante'], setor: 'Manutenção predial' },
    { id: 'u4',  nome: 'Marcos Almeida',    login: '1654321',    ident: 'SIAPE 1654321', tipo: 'Docente',                  vinculoAtivo: true,  acessoAtivo: true,  perfis: ['reitoria', 'solicitante'], setor: 'Reitoria' },
    { id: 'u5',  nome: 'Lúcia Ferreira',    login: '1543210',    ident: 'SIAPE 1543210', tipo: 'Técnica-administrativa',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['admin', 'solicitante'], setor: '' },
    { id: 'u6',  nome: 'Paulo Nunes',       login: '1876543',    ident: 'SIAPE 1876543', tipo: 'Técnico-administrativo',   vinculoAtivo: true,  acessoAtivo: false, perfis: ['executor'], setor: 'Manutenção predial' },
    { id: 'u7',  nome: 'Carla Menezes',     login: '2019004321', ident: '2019004321',   tipo: 'Discente',                  vinculoAtivo: false, acessoAtivo: true,  perfis: ['solicitante'], setor: '' },
    { id: 'u8',  nome: 'Sérgio Lima',       login: '1712345',    ident: 'SIAPE 1712345', tipo: 'Técnico-administrativo',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['executor'], setor: 'Elétrica' },
    { id: 'u9',  nome: 'Diego Matos',       login: '1723456',    ident: 'SIAPE 1723456', tipo: 'Técnico-administrativo',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['executor'], setor: 'Refrigeração' },
    { id: 'u10', nome: 'Felipe Rocha',      login: '1734567',    ident: 'SIAPE 1734567', tipo: 'Técnico-administrativo',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['executor'], setor: 'Tecnologia da informação' },
    { id: 'u11', nome: 'Bruna Alves',       login: '1745678',    ident: 'SIAPE 1745678', tipo: 'Técnica-administrativa',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['executor'], setor: 'Limpeza' },
    { id: 'u12', nome: 'Beatriz Lima',      login: '1698765',    ident: 'SIAPE 1698765', tipo: 'Docente',                  vinculoAtivo: true,  acessoAtivo: true,  perfis: ['solicitante'], setor: '' },
    { id: 'u13', nome: 'Tiago Moraes',      login: '2022005678', ident: '2022005678',   tipo: 'Discente',                  vinculoAtivo: true,  acessoAtivo: true,  perfis: ['solicitante'], setor: '' },
    { id: 'u14', nome: 'Helena Cardoso',    login: '1687654',    ident: 'SIAPE 1687654', tipo: 'Docente',                  vinculoAtivo: true,  acessoAtivo: true,  perfis: ['solicitante'], setor: '' },
    { id: 'u15', nome: 'Rogério Pantoja',   login: '1756789',    ident: 'SIAPE 1756789', tipo: 'Técnico-administrativo',   vinculoAtivo: true,  acessoAtivo: true,  perfis: ['executor'], setor: 'Elétrica' }
  ];

  /* ---------- Chamados ---------- */
  function d(dia, mes, h, m) { return new Date(2026, mes - 1, dia, h, m || 0).toISOString(); }
  function ev(em, autor, tipo, texto, publico) { return { em, autor, tipo, texto, publico: publico !== false }; }

  const chamados = [
    {
      id: '2026-0418', categoria: 'eletrica', ambiente: 'mz-b-2-x1', autor: 'u1', impedeAula: true, prioridade: 'alta', estado: 'atendimento',
      descricao: 'Três tomadas da parede do fundo estão sem energia desde segunda-feira. Os alunos não conseguem carregar notebooks durante as aulas práticas.',
      criadoEm: d(16, 11, 8, 12), equipe: 'Elétrica', executor: 'u8',
      anexos: [{ nome: 'tomadas-fundo.jpg', tipo: 'image', tamanho: 1.8 }],
      historico: [
        ev(d(16, 11, 8, 12), 'u1', 'estado', 'Chamado aberto. Prioridade alta calculada: ocorrência impede atividade letiva.'),
        ev(d(16, 11, 9, 40), 'u2', 'estado', 'Atribuído à equipe Elétrica.'),
        ev(d(16, 11, 9, 41), 'u2', 'comentario', 'Verificar também o quadro do 2º andar, houve queda semana passada.', false),
        ev(d(17, 11, 14, 5), 'u8', 'estado', 'Atendimento iniciado.'),
        ev(d(17, 11, 15, 30), 'u8', 'comentario', 'Disjuntor 12 do quadro B2 com aquecimento. Peça solicitada ao almoxarifado.', false)
      ]
    },
    {
      id: '2026-0412', categoria: 'refrig', ambiente: 'mz-c-0-x1', autor: 'u1', impedeAula: false, prioridade: 'media', estado: 'resolvido',
      descricao: 'Ar-condicionado do laboratório pinga água sobre a bancada 3.',
      criadoEm: d(10, 11, 10, 2), equipe: 'Refrigeração', executor: 'u9',
      anexos: [{ nome: 'gotejamento.mp4', tipo: 'video', tamanho: 12.4 }, { nome: 'bancada-3.jpg', tipo: 'image', tamanho: 2.1 }],
      historico: [
        ev(d(10, 11, 10, 2), 'u1', 'estado', 'Chamado aberto. Prioridade média calculada.'),
        ev(d(10, 11, 13, 15), 'u2', 'estado', 'Atribuído à equipe Refrigeração.'),
        ev(d(11, 11, 8, 30), 'u9', 'estado', 'Atendimento iniciado.'),
        ev(d(11, 11, 9, 10), 'u9', 'comentario', 'Dreno obstruído; limpeza feita e mangueira trocada.', false),
        ev(d(11, 11, 11, 0), 'u9', 'estado', 'Marcado como resolvido.')
      ]
    },
    {
      id: '2026-0395', categoria: 'predial', ambiente: 'mz-b-1-x1', autor: 'u1', impedeAula: false, prioridade: 'baixa', estado: 'concluido',
      descricao: 'Porta da segunda cabine não fecha, trinco quebrado.',
      criadoEm: d(28, 10, 15, 20), equipe: 'Manutenção predial', executor: 'u3', anexos: [],
      avaliacao: { nota: 5, comentario: 'Resolvido em um dia. Obrigado!' },
      historico: [
        ev(d(28, 10, 15, 20), 'u1', 'estado', 'Chamado aberto. Prioridade baixa calculada.'),
        ev(d(29, 10, 8, 0), 'u2', 'estado', 'Atribuído à equipe Manutenção predial.'),
        ev(d(29, 10, 10, 30), 'u3', 'estado', 'Atendimento iniciado.'),
        ev(d(29, 10, 11, 45), 'u3', 'estado', 'Marcado como resolvido.'),
        ev(d(30, 10, 9, 5), 'u1', 'avaliacao', 'Avaliação registrada: 5 de 5.')
      ]
    },
    {
      id: '2026-0421', categoria: 'ti', ambiente: 'mz-c-1-x1', autor: 'u1', impedeAula: false, prioridade: 'baixa', estado: 'triagem',
      descricao: 'Projetor liga mas não reconhece a entrada HDMI do computador do professor.',
      criadoEm: d(18, 11, 7, 48), equipe: '', executor: '', anexos: [],
      historico: [ev(d(18, 11, 7, 48), 'u1', 'estado', 'Chamado aberto. Prioridade baixa calculada.')]
    },
    {
      id: '2026-0380', categoria: 'limpeza', ambiente: 'mz-a-0-x1', autor: 'u1', impedeAula: false, prioridade: 'baixa', estado: 'cancelado',
      descricao: 'Lixo acumulado após evento na sexta.',
      criadoEm: d(20, 10, 18, 2), equipe: '', executor: '', anexos: [],
      historico: [
        ev(d(20, 10, 18, 2), 'u1', 'estado', 'Chamado aberto. Prioridade baixa calculada.'),
        ev(d(21, 10, 7, 30), 'u1', 'estado', 'Cancelado pelo solicitante: a limpeza já foi feita pela equipe do evento.')
      ]
    },
    {
      id: '2026-0420', categoria: 'predial', ambiente: 'mz-d-0-x1', autor: 'u12', impedeAula: false, prioridade: 'media', estado: 'triagem',
      descricao: 'Infiltração no forro próximo às estantes de periódicos. Há manchas e cheiro de mofo.',
      criadoEm: d(17, 11, 16, 40), equipe: '', executor: '', anexos: [{ nome: 'forro-manchado.jpg', tipo: 'image', tamanho: 3.2 }],
      historico: [ev(d(17, 11, 16, 40), 'u12', 'estado', 'Chamado aberto. Prioridade média calculada.')]
    },
    {
      id: '2026-0419', categoria: 'eletrica', ambiente: 'mz-a-1-2', autor: 'u14', impedeAula: true, prioridade: 'alta', estado: 'triagem',
      descricao: 'Metade das lâmpadas apagadas. Impossível projetar e escrever no quadro ao mesmo tempo.',
      criadoEm: d(17, 11, 19, 5), equipe: '', executor: '', anexos: [],
      historico: [ev(d(17, 11, 19, 5), 'u14', 'estado', 'Chamado aberto. Prioridade alta calculada: ocorrência impede atividade letiva.')]
    },
    {
      id: '2026-0417', categoria: 'refrig', ambiente: 'mz-b-0-3', autor: 'u13', impedeAula: true, prioridade: 'alta', estado: 'triagem',
      descricao: 'Ar-condicionado desligado e janelas lacradas. Temperatura insuportável à tarde.',
      criadoEm: d(15, 11, 13, 22), equipe: '', executor: '', anexos: [{ nome: 'painel-ar.jpg', tipo: 'image', tamanho: 1.1 }],
      historico: [ev(d(15, 11, 13, 22), 'u13', 'estado', 'Chamado aberto. Prioridade alta calculada: ocorrência impede atividade letiva.')]
    },
    {
      id: '2026-0416', categoria: 'limpeza', ambiente: 'mz-c-0-1', autor: 'u13', impedeAula: false, prioridade: 'baixa', estado: 'triagem',
      descricao: 'Bebedouro do corredor com água parada e sujeira na bandeja.',
      criadoEm: d(15, 11, 9, 0), equipe: '', executor: '', anexos: [],
      historico: [ev(d(15, 11, 9, 0), 'u13', 'estado', 'Chamado aberto. Prioridade baixa calculada.')]
    },
    {
      id: '2026-0414', categoria: 'predial', ambiente: 'mz-b-2-2', autor: 'u14', impedeAula: false, prioridade: 'media', estado: 'atribuido',
      descricao: 'Janela emperrada, não abre nem fecha totalmente. Entra chuva na sala.',
      criadoEm: d(13, 11, 11, 10), equipe: 'Manutenção predial', executor: 'u3', anexos: [],
      historico: [
        ev(d(13, 11, 11, 10), 'u14', 'estado', 'Chamado aberto. Prioridade média calculada.'),
        ev(d(14, 11, 8, 20), 'u2', 'estado', 'Atribuído à equipe Manutenção predial (Joana Ribeiro).')
      ]
    },
    {
      id: '2026-0410', categoria: 'predial', ambiente: 'mz-d-1-x1', autor: 'u12', impedeAula: false, prioridade: 'baixa', estado: 'reencaminhado',
      descricao: 'Fechadura da porta principal da coordenação travando.',
      criadoEm: d(9, 11, 14, 0), equipe: 'Manutenção predial', executor: 'u3', anexos: [],
      historico: [
        ev(d(9, 11, 14, 0), 'u12', 'estado', 'Chamado aberto. Prioridade baixa calculada.'),
        ev(d(10, 11, 8, 0), 'u2', 'estado', 'Atribuído à equipe Tecnologia da informação.'),
        ev(d(11, 11, 10, 15), 'u10', 'estado', 'Reencaminhado para Manutenção predial: a fechadura é mecânica, não eletrônica.'),
        ev(d(11, 11, 10, 16), 'u10', 'comentario', 'Categoria registrada como TI por engano no controle de acesso.', false)
      ]
    },
    {
      id: '2026-0408', categoria: 'predial', ambiente: 'mz-a-2-1', autor: 'u13', impedeAula: false, prioridade: 'media', estado: 'atendimento',
      descricao: 'Placas do forro soltas sobre as carteiras da primeira fila.',
      criadoEm: d(7, 11, 9, 30), equipe: 'Manutenção predial', executor: 'u3', anexos: [{ nome: 'forro-solto.jpg', tipo: 'image', tamanho: 2.6 }],
      historico: [
        ev(d(7, 11, 9, 30), 'u13', 'estado', 'Chamado aberto. Prioridade média calculada.'),
        ev(d(7, 11, 11, 0), 'u2', 'estado', 'Atribuído à equipe Manutenção predial (Joana Ribeiro).'),
        ev(d(10, 11, 8, 15), 'u3', 'estado', 'Atendimento iniciado.'),
        ev(d(10, 11, 8, 20), 'u3', 'comentario', 'Área isolada. Aguardando placas novas para substituição.', false)
      ]
    },
    {
      id: '2026-0402', categoria: 'ti', ambiente: 'mz-c-1-x1', autor: 'u14', impedeAula: true, prioridade: 'alta', estado: 'concluido',
      descricao: 'Rede cabeada fora do ar no laboratório durante a avaliação.',
      criadoEm: d(4, 11, 8, 5), equipe: 'Tecnologia da informação', executor: 'u10', anexos: [],
      avaliacao: { nota: 4, comentario: '' },
      historico: [
        ev(d(4, 11, 8, 5), 'u14', 'estado', 'Chamado aberto. Prioridade alta calculada: ocorrência impede atividade letiva.'),
        ev(d(4, 11, 8, 20), 'u2', 'estado', 'Atribuído à equipe Tecnologia da informação.'),
        ev(d(4, 11, 8, 40), 'u10', 'estado', 'Atendimento iniciado.'),
        ev(d(4, 11, 10, 0), 'u10', 'estado', 'Marcado como resolvido.'),
        ev(d(5, 11, 9, 0), 'u14', 'avaliacao', 'Avaliação registrada: 4 de 5.')
      ]
    },
    {
      id: '2026-0399', categoria: 'eletrica', ambiente: 'mz-d-0-x1', autor: 'u12', impedeAula: false, prioridade: 'media', estado: 'resolvido',
      descricao: 'Luminária de emergência piscando na saída lateral.',
      criadoEm: d(1, 11, 17, 30), equipe: 'Elétrica', executor: 'u15', anexos: [],
      historico: [
        ev(d(1, 11, 17, 30), 'u12', 'estado', 'Chamado aberto. Prioridade média calculada.'),
        ev(d(3, 11, 8, 0), 'u2', 'estado', 'Atribuído à equipe Elétrica.'),
        ev(d(5, 11, 14, 0), 'u15', 'estado', 'Atendimento iniciado.'),
        ev(d(5, 11, 15, 10), 'u15', 'estado', 'Marcado como resolvido.')
      ]
    },
    {
      id: '2026-0422', categoria: 'predial', ambiente: 'mz-b-2-x1', autor: 'u3', impedeAula: false, prioridade: 'baixa', estado: 'atribuido',
      descricao: 'Quadro branco solto do suporte do lado direito.',
      criadoEm: d(18, 11, 8, 50), equipe: 'Manutenção predial', executor: '', anexos: [],
      historico: [
        ev(d(18, 11, 8, 50), 'u3', 'estado', 'Chamado aberto. Prioridade baixa calculada.'),
        ev(d(18, 11, 9, 30), 'u2', 'estado', 'Atribuído à equipe Manutenção predial.')
      ]
    }
  ];

  /* ---------- Base histórica para relatórios (determinística) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gerarHistorico() {
    const rnd = mulberry32(1990);
    const pesos = [['predial', 78, 4.1], ['eletrica', 52, 2.6], ['ti', 41, 2.9], ['refrig', 27, 3.8], ['limpeza', 16, 1.4]];
    const locais = ['mz-b-2-x1', 'mz-c-0-x1', 'mz-d-0-x1', 'mz-a-0-x1', 'mz-c-1-x1', 'mz-b-1-x1', 'mz-a-1-2', 'mz-b-0-3', 'mz-a-2-1', 'bin-p-0-1', 'san-p-1-2', 'maz-p-0-3'];
    const inicio = new Date(2026, 4, 1).getTime();   // maio
    const fim = HOJE.getTime();
    const out = [];
    pesos.forEach(([cat, n, tmr]) => {
      const total = Math.round(n * 1.6);
      for (let i = 0; i < total; i++) {
        const criado = new Date(inicio + rnd() * (fim - inicio));
        const idadeDias = (fim - criado.getTime()) / 864e5;
        const r = rnd();
        let estado;
        if (idadeDias < 6) estado = r < .35 ? 'triagem' : r < .6 ? 'atribuido' : r < .85 ? 'atendimento' : 'resolvido';
        else if (idadeDias < 20) estado = r < .08 ? 'atendimento' : r < .14 ? 'reencaminhado' : r < .3 ? 'resolvido' : r < .94 ? 'concluido' : 'cancelado';
        else estado = r < .93 ? 'concluido' : r < .97 ? 'resolvido' : 'cancelado';
        const dur = Math.max(0.2, tmr * (0.35 + rnd() * 1.3));
        out.push({
          categoria: cat, estado, criadoEm: criado.toISOString(),
          resolucaoDias: (estado === 'resolvido' || estado === 'concluido') ? dur : null,
          ambiente: locais[Math.floor(rnd() * locais.length)]
        });
      }
    });
    return out;
  }

  /* ---------- Store ---------- */
  const KEY = 'unifap-chamados-demo-v2';
  const inicial = () => ({
    chamados, usuarios, categorias, campi, blocos, andares, ambientes,
    seq: 423, sessao: null, auditoria: [
      { em: d(10, 11, 16, 22), autor: 'u5', texto: 'Perfis de Joana Ribeiro alterados: Executor, Solicitante.' }
    ]
  });

  let state;
  try {
    const raw = sessionStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : inicial();
  } catch (e) { state = inicial(); }

  const historicoRelatorio = gerarHistorico();

  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* armazenamento indisponível: segue só em memória */ }
  }
  function reset() {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ok */ }
    state = inicial();
  }

  /* ---------- Consultas ---------- */
  const byId = (list, id) => list.find(x => x.id === id);
  const DB = {
    HOJE, ESTADOS, TRILHA, PRIORIDADES, PERFIS, SETORES, TIPOS_AMBIENTE,
    get s() { return state; },
    save, reset,
    historicoRelatorio,
    user: id => byId(state.usuarios, id),
    cat: id => byId(state.categorias, id),
    chamado: id => byId(state.chamados, id),
    amb: id => byId(state.ambientes, id),
    andar: id => byId(state.andares, id),
    bloco: id => byId(state.blocos, id),
    campus: id => byId(state.campi, id),
    localPartes(ambId) {
      const a = this.amb(ambId); if (!a) return null;
      const an = this.andar(a.andar), b = this.bloco(an.bloco), c = this.campus(b.campus);
      return { campus: c, bloco: b, andar: an, ambiente: a };
    },
    localCurto(ambId) {
      const p = this.localPartes(ambId); if (!p) return '—';
      return p.ambiente.nome + ', ' + p.bloco.nome;
    },
    localCompleto(ambId) {
      const p = this.localPartes(ambId); if (!p) return '—';
      return [p.campus.nome, p.bloco.nome, p.andar.nome, p.ambiente.nome].join(' › ');
    },
    calcPrioridade(catId, impedeAula) {
      if (impedeAula) return 'alta';
      return (catId === 'eletrica' || catId === 'refrig' || catId === 'predial') ? 'media' : 'baixa';
    },
    novoProtocolo() {
      state.seq += 1;
      return '2026-' + String(state.seq).padStart(4, '0');
    },
    can(perm) {
      const u = state.sessao && this.user(state.sessao);
      return !!u && u.perfis.includes(perm);
    }
  };

  window.DB = DB;
})();
