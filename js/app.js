/* Roteador por hash, cabeçalho e controle de acesso na interface.
   (Num sistema real, o servidor também verifica cada permissão.) */
(function () {
  'use strict';
  const { esc, ic, fmt } = UI;
  const app = document.getElementById('app');

  const NAV = [
    { href: '#/painel',     label: 'Painel',              icon: 'space_dashboard', desc: 'Resumo e atalhos', show: () => true },
    { href: '#/fila',       label: 'Fila de triagem',     icon: 'inbox', desc: 'Chamados aguardando atribuição', show: () => DB.can('gestor') || DB.can('executor') },
    { href: '#/demandas',   label: 'Demandas',            icon: 'handyman', desc: 'Atribuídos a você ou à sua equipe', show: () => DB.can('executor') },
    { href: '#/relatorios', label: 'Relatórios',          icon: 'monitoring', desc: 'Volume e tempo de resolução', show: () => DB.can('gestor') || DB.can('reitoria') },
    { href: '#/usuarios',   label: 'Usuários',            icon: 'manage_accounts', desc: 'Perfis e acesso ao sistema', show: () => DB.can('admin') },
    { href: '#/catalogo',   label: 'Locais e categorias', icon: 'account_tree', desc: 'Catálogo usado na abertura', show: () => DB.can('admin') },
    { href: '#/meus',       label: 'Meus chamados',       icon: 'list_alt', desc: 'Chamados que você abriu', show: () => DB.can('solicitante') }
  ];

  const ROUTES = [
    { re: /^\/login$/,                   screen: 'login', public: true },
    { re: /^\/painel$/,                  screen: 'painel' },
    { re: /^\/abrir$/,                   screen: 'abrir',      perm: ['solicitante'] },
    { re: /^\/confirmacao\/([\w-]+)$/,   screen: 'confirmacao', perm: ['solicitante'] },
    { re: /^\/meus$/,                    screen: 'meus',       perm: ['solicitante'] },
    { re: /^\/chamado\/([\w-]+)$/,       screen: 'chamado',    perm: ['solicitante'] },
    { re: /^\/fila$/,                    screen: 'fila',       perm: ['gestor', 'executor'] },
    { re: /^\/fila\/([\w-]+)\/atribuir$/, screen: 'atribuir',  perm: ['gestor'] },
    { re: /^\/operacao\/([\w-]+)$/,      screen: 'operacao',   perm: ['gestor', 'executor'] },
    { re: /^\/relatorios$/,              screen: 'relatorios', perm: ['gestor', 'reitoria'] },
    { re: /^\/demandas$/,                screen: 'demandas',   perm: ['executor'] },
    { re: /^\/atendimento\/([\w-]+)$/,   screen: 'atendimento', perm: ['executor', 'gestor'] },
    { re: /^\/usuarios$/,                screen: 'usuarios',   perm: ['admin'] },
    { re: /^\/catalogo$/,                screen: 'catalogo',   perm: ['admin'] }
  ];

  const me = () => DB.s.sessao && DB.user(DB.s.sessao);

  function roleLine(u) {
    const order = ['admin', 'gestor', 'executor', 'reitoria', 'solicitante'];
    const main = order.find(p => u.perfis.includes(p));
    const map = { admin: 'Administração do sistema', gestor: 'Gestão e triagem', executor: 'Equipe de ' + (u.setor || '').toLowerCase(), reitoria: 'Reitoria', solicitante: u.tipo };
    return map[main];
  }

  function header(path) {
    const u = me();
    const isActive = n => path === n.href.slice(1) || path.startsWith(n.href.slice(1) + '/') ||
      (n.href === '#/meus' && (/^\/(chamado|confirmacao)\//.test(path) || path === '/abrir')) ||
      (n.href === '#/fila' && /^\/operacao\//.test(path) && DB.can('gestor')) ||
      (n.href === '#/demandas' && /^\/atendimento\//.test(path));
    const list = NAV.filter(n => n.show());
    const cur = list.find(isActive) || { label: 'Navegar', icon: 'menu' };
    const items = list.map(n => {
      const on = n === cur;
      return `<a class="navitem" href="${n.href}" ${on ? 'aria-current="page"' : ''}>
        <span class="ni-ico">${ic(n.icon)}</span>
        <span class="ni-txt"><b>${n.label}</b><small>${n.desc}</small></span>
        ${on ? ic('check', 'ni-check') : ''}
      </a>`;
    }).join('');
    return `<header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#/painel">
          <img src="assets/logo-unifap.png" alt="">
          <span><span class="brand-name">UNIFAP Chamados</span><span class="brand-sub">Manutenção e infraestrutura</span></span>
        </a>
        <div class="navdrop">
          <button class="navbtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="nav" data-navtoggle>
            ${ic(cur.icon)}<span class="nb-label"><span class="sr-only">Seção atual: </span>${cur.label}</span>
            ${ic('expand_more', 'nb-chev')}
            <span class="sr-only">, abrir menu de navegação</span>
          </button>
          <nav class="navmenu" id="nav" aria-label="Principal">
            <p class="navmenu-head">Ir para</p>
            ${items}
          </nav>
        </div>
        <div class="row" style="margin-left:auto;gap:10px;flex-wrap:nowrap">
          <div class="usermenu">
            <button class="userbtn" type="button" aria-haspopup="true" aria-expanded="false" data-usermenu>
              <span class="avatar">${fmt.iniciais(u.nome)}</span>
              <span class="who"><b>${esc(u.nome)}</b><span>${esc(roleLine(u))}</span></span>
              ${ic('expand_more')}
            </button>
            <div class="menu" role="menu">
              <div class="menu-head"><b>${esc(u.nome)}</b><span>${esc(u.ident)}, ${esc(u.tipo.toLowerCase())}</span>
                <div class="roles">${u.perfis.map(UI.perfilChip).join('')}</div></div>
              <button role="menuitem" type="button" data-reset>${ic('restart_alt')}Restaurar dados de demonstração</button>
              <button role="menuitem" type="button" data-logout>${ic('logout')}Sair</button>
            </div>
          </div>
        </div>
      </div>
    </header>`;
  }

  function denied() {
    return `<div class="denied">
      <span class="ico">${ic('lock')}</span>
      <h1 class="h1">Sem acesso a esta área</h1>
      <p class="lede">Seu perfil não inclui permissão para esta página. Se você precisa dela para o seu trabalho, peça ao administrador do sistema.</p>
      <a class="btn btn-primary" href="#/painel">Voltar ao painel</a>
    </div>`;
  }

  function notFound() {
    return `<div class="denied">
      <span class="ico" style="background:var(--brand-softer);color:var(--brand)">${ic('search_off')}</span>
      <h1 class="h1">Chamado não encontrado</h1>
      <p class="lede">O protocolo informado não existe ou não está disponível para o seu perfil.</p>
      <a class="btn btn-primary" href="#/painel">Voltar ao painel</a>
    </div>`;
  }

  let current = null;
  function render() {
    const path = (location.hash || '#/login').slice(1).split('?')[0];
    const route = ROUTES.find(r => r.re.test(path));
    const params = route ? path.match(route.re).slice(1) : [];
    const u = me();

    if (!route) { location.hash = u ? '#/painel' : '#/login'; return; }
    if (!route.public && !u) { location.hash = '#/login'; return; }
    if (route.public && u) { location.hash = '#/painel'; return; }

    if (current && current.unmount) current.unmount();
    const screen = Screens[route.screen];
    current = screen;

    if (route.public) {
      app.innerHTML = screen.render(...params);
      screen.mount && screen.mount(app, ...params);
      document.title = 'Entrar — UNIFAP Chamados';
      return;
    }

    const allowed = !route.perm || route.perm.some(p => DB.can(p));
    let body;
    if (!allowed) body = denied();
    else {
      body = screen.render(...params);
      if (body === null) body = notFound();
    }
    // Botão flutuante de abrir chamado (só aparece no celular, via CSS)
    const fab = allowed && DB.can('solicitante') && !/^\/(abrir|confirmacao)/.test(path)
      ? `<a class="fab" href="#/abrir">${ic('add')}Abrir chamado</a>` : '';
    app.innerHTML = header(path) + `<main id="main" class="page" tabindex="-1">${body}</main>` + fab;
    if (allowed && body && screen.mount) screen.mount(app.querySelector('main'), ...params);
    document.title = (screen.title ? (typeof screen.title === 'function' ? screen.title(...params) : screen.title) + ' — ' : '') + 'UNIFAP Chamados';
    window.scrollTo(0, 0);
    if (!app.contains(document.activeElement) || document.activeElement === document.body) {
      app.querySelector('main')?.focus({ preventScroll: true });
    }
  }

  /* Interações globais do cabeçalho */
  /* Menu de navegação suspenso: fechado por padrão, mostra a seção atual */
  function setNav(open, focus = true) {
    const nav = document.getElementById('nav'), btn = document.querySelector('[data-navtoggle]');
    if (!nav || !btn) return;
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    if (open && focus) (nav.querySelector('[aria-current="page"]') || nav.querySelector('a'))?.focus();
  }

  document.addEventListener('click', e => {
    const t = e.target;
    const um = t.closest('[data-usermenu]');
    const menu = document.querySelector('.menu');
    if (um) {
      const open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      um.setAttribute('aria-expanded', open);
      if (open) menu.querySelector('button')?.focus();
      return;
    }
    if (menu && !t.closest('.menu')) { menu.classList.remove('open'); document.querySelector('[data-usermenu]')?.setAttribute('aria-expanded', 'false'); }

    const nt = t.closest('[data-navtoggle]');
    if (nt) { setNav(!document.getElementById('nav').classList.contains('open'), e.detail === 0); return; }
    if (!t.closest('.navdrop')) setNav(false, false);
    if (t.closest('[data-logout]')) {
      DB.s.sessao = null; DB.save();
      location.hash = '#/login';
      return;
    }
    if (t.closest('[data-reset]')) {
      const sessao = DB.s.sessao;
      DB.reset(); DB.s.sessao = sessao; DB.save();
      UI.toast('Dados de demonstração restaurados.');
      render();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const menu = document.querySelector('.menu.open');
      if (menu) { menu.classList.remove('open'); document.querySelector('[data-usermenu]')?.focus(); }
      const nav = document.querySelector('.navmenu.open');
      if (nav) { setNav(false); document.querySelector('[data-navtoggle]')?.focus(); }
    }
    const nav = document.querySelector('.navmenu.open');
    if (nav && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const links = [...nav.querySelectorAll('a')].filter(a => a.offsetParent !== null);
      const i = links.indexOf(document.activeElement);
      const n = e.key === 'ArrowDown' ? (i + 1) % links.length : (i - 1 + links.length) % links.length;
      links[n]?.focus(); e.preventDefault();
    }
  });
  document.addEventListener('focusin', e => {
    const nav = document.querySelector('.navmenu.open');
    if (nav && !nav.closest('.navdrop').contains(e.target)) setNav(false, false);
  });

  window.App = { render, go: h => { location.hash = h; }, me };
  window.addEventListener('hashchange', render);
  render();
})();
