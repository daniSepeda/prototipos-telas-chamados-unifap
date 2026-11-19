/* Telas do solicitante e blocos compartilhados: T01–T06 */
(function () {
  'use strict';
  const { esc, ic, fmt, tag, prio, trail, ticketRow, empty, skeletonRows, toast, dialog, fieldError } = UI;
  const { ESTADOS, PRIORIDADES } = DB;
  const me = () => App.me();
  const $ = (root, s) => root.querySelector(s);
  const $$ = (root, s) => [...root.querySelectorAll(s)];

  /* ---------- Blocos compartilhados entre os detalhes ---------- */
  const Shared = {
    ticketHead(c, { showCopy = true } = {}) {
      const cat = DB.cat(c.categoria);
      return `<div class="ticket-head">
        <div>
          <div class="pnum">${ic(cat.icon)}<span>${esc(cat.nome)}</span></div>
          <h1 class="h1">Chamado <span class="protocolo">${esc(c.id)}</span></h1>
          <div class="meta">${tag(c.estado)}${prio(c.prioridade)}<span class="muted small">${esc(DB.localCurto(c.ambiente))}</span></div>
        </div>
        ${showCopy ? `<button class="btn btn-secondary btn-sm" type="button" data-copy="${esc(c.id)}">${ic('content_copy')}Copiar protocolo</button>` : ''}
      </div>`;
    },
    backLink(href, label) { return `<a class="backlink" href="${href}">${ic('arrow_back')}Voltar para ${esc(label)}</a>`; },
    // Barra fixa no rodapé do celular com a ação principal da tela
    mobileBar(html) { return html ? `<div class="mobilebar" role="region" aria-label="Ações do chamado">${html}</div>` : ''; },
    trailPanel(c) { return `<section class="panel trail-panel" aria-label="Andamento">${trail(c)}</section>`; },
    descPanel(c, extra) {
      return `<section class="panel">
        <div class="panel-head"><h2 class="h2">Descrição</h2></div>
        <div class="panel-body stack-sm">
          <p class="desc">${esc(c.descricao)}</p>
          ${c.impedeAula ? `<p class="dotline" style="color:var(--danger)">${ic('event_busy')}Impede atividade letiva imediata</p>` : ''}
          ${extra || ''}
        </div>
      </section>`;
    },
    evidPanel(c, { canAdd = false } = {}) {
      const items = c.anexos.map((a, i) => `<button class="thumb" type="button" data-preview="${i}">
          <span class="pv">${ic(a.tipo === 'video' ? 'movie' : 'image')}</span>
          <b>${esc(a.nome)}</b><small>${a.tipo === 'video' ? 'Vídeo' : 'Imagem'}, ${fmt.dec(a.tamanho)} MB</small>
        </button>`).join('');
      return `<section class="panel">
        <div class="panel-head"><h2 class="h2">Evidências</h2>
          ${canAdd ? `<label class="btn btn-secondary btn-sm">${ic('attach_file')}Anexar<input type="file" class="sr-only" accept=".jpg,.jpeg,.png,.webp,.mp4" multiple data-addfile></label>` : `<span class="muted small">${c.anexos.length || 'Nenhum'} arquivo${c.anexos.length === 1 ? '' : 's'}</span>`}
        </div>
        <div class="panel-body">${c.anexos.length ? `<div class="attach">${items}</div>` : `<p class="muted small">Nenhuma imagem ou vídeo foi anexado.</p>`}</div>
      </section>`;
    },
    historyPanel(c, { internal = false, form = false } = {}) {
      const evs = c.historico.filter(h => internal || h.publico).slice().reverse();
      const li = evs.map(h => {
        const u = DB.user(h.autor);
        const cls = !h.publico ? 'internal' : h.tipo === 'avaliacao' ? 'rating' : '';
        const icon = !h.publico ? 'lock' : h.tipo === 'avaliacao' ? 'star' : /Cancelado/.test(h.texto) ? 'close' : /Reencaminhado/.test(h.texto) ? 'alt_route' : /resolvido/i.test(h.texto) ? 'task_alt' : /aberto/.test(h.texto) ? 'flag' : /Atendimento iniciado/.test(h.texto) ? 'construction' : /Atribuído/.test(h.texto) ? 'assignment_ind' : /anexad/i.test(h.texto) ? 'attach_file' : 'history';
        const autor = internal || h.autor === c.autor || h.autor === me().id ? (u ? u.nome : '—') : 'Equipe de atendimento';
        return `<li class="${cls}"><span class="dot">${ic(icon)}</span><div>
          ${!h.publico ? `<span class="lock">${ic('lock')}Comentário interno</span><div class="bubble tx">${esc(h.texto)}</div>` : `<div class="tx">${esc(h.texto)}</div>`}
          <div class="by">${esc(autor)}, ${fmt.dataHora(h.em)}</div></div></li>`;
      }).join('');
      return `<section class="panel">
        <div class="panel-head"><h2 class="h2">Histórico</h2>${internal ? `<span class="muted small">${ic('shield')} Registro de auditoria, não editável</span>` : ''}</div>
        <div class="panel-body">
          ${form ? `<form class="stack-sm" data-comment style="margin-bottom:24px">
              <div class="field"><label for="cmt">Comentário interno</label>
              <textarea class="textarea" id="cmt" name="texto" rows="3" style="min-height:84px" placeholder="Visível só para gestão e equipes de atendimento"></textarea></div>
              <div class="row"><span class="hint">${ic('visibility_off')} O solicitante não vê comentários internos.</span><span class="spacer"></span><button class="btn btn-secondary btn-sm" type="submit">Registrar comentário</button></div>
            </form>` : ''}
          <ol class="timeline">${li}</ol>
        </div>
      </section>`;
    },
    bindCommon(root, c, rerender) {
      root.addEventListener('click', async e => {
        const go = e.target.closest('[data-scrollto]');
        if (go) {
          const alvo = root.querySelector(go.dataset.scrollto);
          alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          alvo?.querySelector('button, input, textarea')?.focus({ preventScroll: true });
        }
        const cp = e.target.closest('[data-copy]');
        if (cp) {
          const txt = cp.dataset.copy;
          try { await navigator.clipboard.writeText(txt); toast(`Protocolo ${txt} copiado.`); }
          catch (err) { toast(`Copie manualmente: ${txt}`); }
        }
        const pv = e.target.closest('[data-preview]');
        if (pv && c) {
          const a = c.anexos[+pv.dataset.preview];
          dialog({
            title: esc(a.nome),
            body: `<div class="dlg-preview">${ic(a.tipo === 'video' ? 'movie' : 'image')}</div><p class="small">${a.tipo === 'video' ? 'Vídeo' : 'Imagem'}, ${fmt.dec(a.tamanho)} MB. A pré-visualização do arquivo aparece aqui quando o armazenamento estiver conectado.</p>`,
            confirm: '', cancel: 'Fechar'
          });
        }
      });
      const cf = $(root, '[data-comment]');
      if (cf) cf.addEventListener('submit', e => {
        e.preventDefault();
        const ta = cf.querySelector('textarea');
        const v = ta.value.trim();
        if (v.length < 3) { fieldError(ta, 'Escreva o comentário antes de registrar.'); ta.focus(); return; }
        c.historico.push({ em: new Date().toISOString(), autor: me().id, tipo: 'comentario', texto: v, publico: false });
        DB.save(); toast('Comentário interno registrado.'); rerender();
      });
      const af = $(root, '[data-addfile]');
      if (af) af.addEventListener('change', () => {
        const ok = [...af.files].filter(f => Shared.fileError(f) === '');
        const bad = af.files.length - ok.length;
        ok.forEach(f => c.anexos.push({ nome: f.name, tipo: f.type.startsWith('video') ? 'video' : 'image', tamanho: +(f.size / 1048576).toFixed(1) || 0.1 }));
        if (ok.length) {
          c.historico.push({ em: new Date().toISOString(), autor: me().id, tipo: 'anexo', texto: `${ok.length} evidência${ok.length > 1 ? 's' : ''} anexada${ok.length > 1 ? 's' : ''} ao atendimento.`, publico: true });
          DB.save(); toast(`${ok.length} arquivo${ok.length > 1 ? 's' : ''} anexado${ok.length > 1 ? 's' : ''}.`);
        }
        if (bad) toast(`${bad} arquivo${bad > 1 ? 's' : ''} recusado${bad > 1 ? 's' : ''}: formato ou tamanho fora do limite.`, 'err');
        rerender();
      });
    },
    norm: s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    // Busca ambientes pelo nome, código, bloco ou campus (todas as palavras precisam aparecer)
    buscaAmbientes(q, soAtivos) {
      const termos = Shared.norm(q).trim().split(/\s+/).filter(Boolean);
      if (!termos.length || termos.join('').length < 2) return [];
      return DB.s.ambientes.map(a => DB.localPartes(a.id)).filter(p => {
        if (!p) return false;
        if (soAtivos && !(p.ambiente.ativo && p.andar.ativo && p.bloco.ativo && p.campus.ativo)) return false;
        const alvo = Shared.norm([p.ambiente.nome, p.ambiente.codigo, p.bloco.nome, p.andar.nome, p.campus.nome].join(' '));
        return termos.every(t => alvo.includes(t));
      });
    },
    LIMITES: { image: 10, video: 50 },
    fileError(f) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      const isVid = ext === 'mp4';
      if (!isImg && !isVid) return 'Formato não aceito. Use JPG, PNG, WEBP ou MP4.';
      const mb = f.size / 1048576;
      if (isImg && mb > Shared.LIMITES.image) return `Imagem com ${fmt.dec(mb)} MB. O limite é ${Shared.LIMITES.image} MB.`;
      if (isVid && mb > Shared.LIMITES.video) return `Vídeo com ${fmt.dec(mb)} MB. O limite é ${Shared.LIMITES.video} MB.`;
      return '';
    },
    withLoading(root, sel, fn, ms = 380) {
      const host = $(root, sel);
      if (!host) return;
      host.innerHTML = skeletonRows(4);
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    }
  };

  const Screens = {};

  /* =========================================================
     T01 — Login
     ========================================================= */
  const DEMO = [
    ['2021001234', 'Rafael Costa', 'Solicitante'],
    ['1765432', 'Ana Paula Souza', 'Gestão e triagem'],
    ['1987654', 'Joana Ribeiro', 'Executora, manutenção predial'],
    ['1654321', 'Marcos Almeida', 'Reitoria, só consulta'],
    ['1543210', 'Lúcia Ferreira', 'Administração do sistema'],
    ['2019004321', 'Carla Menezes', 'Vínculo inativo, acesso negado']
  ];
  Screens.login = {
    render() {
      const exp = /expirou/.test(location.hash);
      const lembrar = (() => { try { return localStorage.getItem('unifap-lembrar') === '1'; } catch (e) { return false; } })();
      return `<div class="auth">
        <main class="auth-form" id="main">
          <a class="auth-brand" href="#/login">
            <img src="assets/logo-unifap.png" alt="">
            <span>UNIFAP Chamados</span>
          </a>
          <div class="auth-body">
            <h1 class="auth-title">Entre na sua conta</h1>
            <p class="auth-sub">Use sua matrícula ou SIAPE e a senha institucional.</p>
            <form novalidate data-login>
              <div data-msg>${exp ? `<div class="banner warn" role="alert">${ic('schedule')}<div><b>Sua sessão expirou</b>Entre de novo para continuar de onde parou.</div></div>` : ''}</div>
              <div class="field">
                <label for="ident">Matrícula ou SIAPE</label>
                <div class="input-icon">${ic('badge')}<input class="input" id="ident" name="ident" inputmode="numeric" autocomplete="username" placeholder="Digite sua matrícula ou SIAPE"></div>
              </div>
              <div class="field">
                <label for="senha">Senha</label>
                <div class="input-icon pw">${ic('lock')}
                  <input class="input" id="senha" name="senha" type="password" autocomplete="current-password" placeholder="Digite sua senha">
                  <button class="iconbtn" type="button" data-togglepw aria-label="Mostrar senha" aria-pressed="false">${ic('visibility')}</button>
                </div>
              </div>
              <div class="auth-row">
                <label class="auth-check"><input type="checkbox" name="lembrar" ${lembrar ? 'checked' : ''}>Manter conectado</label>
                <button class="linkbtn" type="button" data-forgot>Esqueci a senha</button>
              </div>
              <button class="btn btn-primary btn-lg btn-block" type="submit" data-submit>Entrar</button>
            </form>
            <div class="auth-or" role="separator"><span>ou</span></div>
            <button class="btn btn-secondary btn-lg btn-block" type="button" data-demotoggle aria-expanded="false" aria-controls="demo-list">${ic('switch_account')}Usar conta de demonstração</button>
            <div class="auth-demo" id="demo-list" hidden>
              <p>Protótipo com dados simulados. Escolha uma pessoa para entrar com o perfil dela.</p>
              <ul>${DEMO.map(([id, n, r]) => `<li><button type="button" data-demo="${id}">
                <span class="avatar">${fmt.iniciais(n)}</span><span class="who"><b>${esc(n)}</b><span>${esc(r)}</span></span>${ic('arrow_forward')}
              </button></li>`).join('')}</ul>
            </div>
          </div>
          <p class="auth-foot">Problemas para entrar? Procure o Núcleo de Tecnologia da Informação da UNIFAP.</p>
        </main>
        <aside class="auth-panel" aria-label="Sobre o sistema">
          <img class="auth-photo" src="assets/frente-unifap.webp" alt="Entrada do campus Marco Zero do Equador, com a guarita e a placa verde da Universidade Federal do Amapá.">
          <div class="auth-panel-brand"><img src="assets/logo-unifap.png" alt=""><span>UNIFAP Chamados</span></div>
          <div class="auth-panel-copy">
            <p class="auth-kicker">Foto: Campus Marco Zero do Equador, Macapá</p>
            <h2 class="auth-headline"><span>Relate o problema.</span> <span>Acompanhe até a solução.</span></h2>
            <p class="auth-panel-sub">Uma solução inteligente para gestão de serviços de infraestrutura e manutenção.</p>
          </div>
        </aside>
      </div>`;
    },
    mount(root) {
      const form = $(root, '[data-login]');
      const ident = $(root, '#ident'), senha = $(root, '#senha'), msg = $(root, '[data-msg]'), btn = $(root, '[data-submit]');
      $(root, '[data-togglepw]').addEventListener('click', e => {
        const b = e.currentTarget; const show = senha.type === 'password';
        senha.type = show ? 'text' : 'password';
        b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
        b.innerHTML = ic(show ? 'visibility_off' : 'visibility');
      });
      const tg = $(root, '[data-demotoggle]'), list = $(root, '#demo-list');
      tg.addEventListener('click', () => {
        const open = list.hidden;
        list.hidden = !open; tg.setAttribute('aria-expanded', open);
        if (open) list.querySelector('button').focus();
      });
      $$(root, '[data-demo]').forEach(b => b.addEventListener('click', () => {
        ident.value = b.dataset.demo; senha.value = 'demonstracao';
        fieldError(ident, ''); fieldError(senha, '');
        list.hidden = true; tg.setAttribute('aria-expanded', 'false');
        form.requestSubmit();
      }));
      $(root, '[data-forgot]').addEventListener('click', () => dialog({
        title: 'Esqueceu a senha?',
        body: '<p>A recuperação de senha ainda não está disponível neste sistema. Procure o Núcleo de Tecnologia da Informação da UNIFAP com um documento de identificação.</p>',
        confirm: '', cancel: 'Entendi'
      }));
      const banner = (kind, title, text) => { msg.innerHTML = `<div class="banner ${kind}" role="alert">${ic(kind === 'error' ? 'error' : 'info')}<div><b>${title}</b>${text}</div></div>`; };
      form.addEventListener('submit', e => {
        e.preventDefault();
        msg.innerHTML = '';
        const id = ident.value.replace(/\D/g, ''), pw = senha.value;
        fieldError(ident, id ? '' : 'Informe sua matrícula ou SIAPE.');
        fieldError(senha, pw ? '' : 'Informe sua senha.');
        if (!id) return ident.focus();
        if (!pw) return senha.focus();
        try { localStorage.setItem('unifap-lembrar', form.lembrar.checked ? '1' : '0'); } catch (err) { /* sem armazenamento */ }
        btn.disabled = true; btn.innerHTML = '<span class="spin" aria-hidden="true"></span>Verificando';
        setTimeout(() => {
          btn.disabled = false; btn.textContent = 'Entrar';
          if (id === '0000') return banner('error', 'Serviço de autenticação indisponível', 'Não foi possível verificar suas credenciais agora. Tente de novo em alguns minutos.');
          const u = DB.s.usuarios.find(x => x.login === id);
          if (!u) { banner('error', 'Matrícula, SIAPE ou senha incorretos', 'Confira os dados e tente de novo.'); return senha.select(); }
          if (!u.vinculoAtivo) return banner('error', 'Vínculo institucional inativo', 'Apenas discentes e servidores com vínculo ativo podem usar o sistema. Regularize sua situação na secretaria acadêmica ou no setor de pessoal.');
          if (!u.acessoAtivo) return banner('error', 'Acesso ao sistema desativado', 'Seu acesso foi desativado pela administração do sistema. Procure o administrador para reativá-lo.');
          DB.s.sessao = u.id; DB.save();
          location.hash = '#/painel';
        }, 650);
      });
    }
  };

  /* =========================================================
     T02 — Painel
     ========================================================= */
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const ABERTOS = ['triagem', 'atribuido', 'reencaminhado', 'atendimento'];
  const minhasDemandas = u => DB.s.chamados.filter(c => (c.executor === u.id || (c.equipe && c.equipe === u.setor)) && ['atribuido', 'reencaminhado', 'atendimento', 'resolvido'].includes(c.estado));

  Screens.painel = {
    title: 'Painel',
    render() {
      const u = me(), h = DB.HOJE;
      const sauda = h.getHours() < 12 ? 'Bom dia' : h.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
      const first = u.nome.split(' ')[0];
      const all = DB.s.chamados;
      const meus = all.filter(c => c.autor === u.id);
      const meusAbertos = meus.filter(c => ABERTOS.includes(c.estado));
      const aval = meus.filter(c => c.estado === 'resolvido');
      const fila = all.filter(c => c.estado === 'triagem');
      const filaAlta = fila.filter(c => c.prioridade === 'alta');
      const dem = DB.can('executor') ? minhasDemandas(u).filter(c => c.estado !== 'resolvido') : [];
      const sc = [];
      const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
      // Cartão de atalho: título, seta, valor em destaque (número ou ícone) e legenda
      const card = (href, title, value, icon, desc, primary) => `<a class="shortcut${primary ? ' primary' : ''}" href="${href}">
          <span class="sc-top"><b>${title}</b><span class="sc-go">${ic('arrow_outward')}</span></span>
          ${value == null ? `<span class="sc-ico">${ic(icon)}</span>` : `<span class="sc-num">${value}</span>`}
          <p>${desc}</p></a>`;
      if (DB.can('solicitante')) sc.push(card('#/abrir', 'Abrir chamado', null, 'add', 'Registre um problema em sala, laboratório ou prédio.', true));
      if (DB.can('gestor')) sc.push(card('#/fila', 'Fila de triagem', fila.length, 'inbox', `Aguardando triagem${filaAlta.length ? `, ${filaAlta.length} com prioridade alta` : ''}.`));
      if (DB.can('executor')) sc.push(card('#/demandas', 'Demandas', dem.length, 'handyman', `${dem.length === 1 ? 'Chamado atribuído' : 'Chamados atribuídos'} a você ou à sua equipe.`));
      if (DB.can('executor') && !DB.can('gestor')) sc.push(card('#/fila', 'Fila de triagem', fila.length, 'inbox', 'Aguardando atribuição pela gestão.'));
      if (DB.can('gestor') || DB.can('reitoria')) sc.push(card('#/relatorios', 'Relatórios', null, 'monitoring', 'Volume de chamados e tempo médio de resolução.'));
      if (DB.can('admin')) {
        sc.push(card('#/usuarios', 'Usuários e permissões', DB.s.usuarios.length, 'manage_accounts', 'Contas com acesso ao sistema.'));
        sc.push(card('#/catalogo', 'Locais e categorias', DB.s.ambientes.filter(a => a.ativo).length, 'account_tree', 'Ambientes ativos no catálogo.'));
      }
      if (DB.can('solicitante')) sc.push(card('#/meus', 'Meus chamados', meus.length ? meusAbertos.length : null, 'list_alt', meus.length ? `Em andamento${aval.length ? `, ${plural(aval.length, 'aguardando sua avaliação', 'aguardando sua avaliação')}` : ''}.` : 'Você ainda não abriu chamados.'));

      let sections = '';
      if (DB.can('gestor') && fila.length) {
        const top = fila.slice().sort((a, b) => ['alta', 'media', 'baixa'].indexOf(a.prioridade) - ['alta', 'media', 'baixa'].indexOf(b.prioridade) || a.criadoEm.localeCompare(b.criadoEm)).slice(0, 4);
        sections += `<div class="sectionhead"><h2 class="h2">Próximos na triagem</h2><a href="#/fila" class="small">Ver fila completa</a></div>
          <div class="panel"><ul class="tlist">${top.map(c => ticketRow(c, `#/fila/${c.id}/atribuir`)).join('')}</ul></div>`;
      }
      if (DB.can('executor') && dem.length) {
        sections += `<div class="sectionhead"><h2 class="h2">Suas próximas demandas</h2><a href="#/demandas" class="small">Ver todas</a></div>
          <div class="panel"><ul class="tlist">${dem.slice(0, 4).map(c => ticketRow(c, `#/atendimento/${c.id}`)).join('')}</ul></div>`;
      }
      if (DB.can('solicitante') && meus.length) {
        const rec = meus.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 3);
        sections += `<div class="sectionhead"><h2 class="h2">Seus chamados recentes</h2><a href="#/meus" class="small">Ver todos</a></div>
          <div class="panel"><ul class="tlist">${rec.map(c => ticketRow(c, `#/chamado/${c.id}`)).join('')}</ul></div>`;
      }
      if (aval.length) {
        sections = `<div class="banner info" style="margin-top:24px">${ic('rate_review')}<div><b>${aval.length === 1 ? 'Um chamado seu foi resolvido' : aval.length + ' chamados seus foram resolvidos'}</b>Confirme se o problema acabou e, se quiser, avalie o atendimento. <a href="#/chamado/${aval[0].id}">Abrir ${aval[0].id}</a></div></div>` + sections;
      }

      return `<section class="hello">
          <div>
            <p class="date">${DIAS[h.getDay()].replace(/^./, m => m.toUpperCase())}, ${h.getDate()} de ${MESES_L[h.getMonth()]} de ${h.getFullYear()}</p>
            <h1 class="display">${sauda}, ${esc(first)}</h1>
          </div>
        </section>
        <h2 class="sr-only">Atalhos</h2>
        <div class="shortcuts">${sc.join('')}</div>
        ${sections}`;
    }
  };

  /* =========================================================
     T03 — Abrir chamado
     ========================================================= */
  let rascunho = null;
  Screens.abrir = {
    title: 'Abrir chamado',
    render() {
      const cats = DB.s.categorias.filter(c => c.ativo);
      const campi = DB.s.campi.filter(c => c.ativo);
      return `<div class="pagehead"><div><h1 class="h1">Abrir chamado</h1>
        <p class="lede">Descreva o problema e onde ele está. A prioridade é calculada pelo sistema a partir da categoria e do impacto nas aulas.</p></div></div>
      <form class="grid-main" novalidate data-form>
        <div class="panel">
          <fieldset class="formsec fieldset">
            <legend class="h3">Categoria</legend>
            <p class="hint" style="margin:-6px 0 16px">Escolha a que melhor descreve o problema.</p>
            <div class="catgrid" role="radiogroup" id="cat-group" aria-label="Categoria">
              ${cats.map(c => `<div class="catopt"><input type="radio" name="categoria" id="cat-${c.id}" value="${c.id}"><label for="cat-${c.id}">${ic(c.icon)}<b>${esc(c.nome)}</b><span>${esc(c.exemplo)}</span></label></div>`).join('')}
            </div>
          </fieldset>
          <fieldset class="formsec fieldset">
            <legend class="h3">Local</legend>
            <p class="hint" style="margin:-6px 0 16px">Só aparecem locais ativos no catálogo da universidade.</p>
            <div class="field locsearch">
              <label for="locq">Buscar sala ou local</label>
              <div class="input-icon">${ic('search')}<input class="input" id="locq" type="search" autocomplete="off" placeholder="Ex.: B-204, Laboratório de Química" role="combobox" aria-expanded="false" aria-controls="locq-list" aria-autocomplete="list"></div>
              <ul class="locresults" id="locq-list" role="listbox" aria-label="Locais encontrados" hidden></ul>
            </div>
            <p class="locor"><span>ou escolha nas listas</span></p>
            <div class="fields-2">
              <div class="field"><label for="campus">Campus</label><select class="select" id="campus" name="campus"><option value="">Selecione</option>${campi.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
              <div class="field"><label for="bloco">Bloco</label><select class="select" id="bloco" name="bloco" disabled><option value="">Escolha o campus primeiro</option></select></div>
              <div class="field"><label for="andar">Andar</label><select class="select" id="andar" name="andar" disabled><option value="">Escolha o bloco primeiro</option></select></div>
              <div class="field"><label for="ambiente">Ambiente</label><select class="select" id="ambiente" name="ambiente" disabled><option value="">Escolha o andar primeiro</option></select></div>
            </div>
          </fieldset>
          <div class="formsec">
            <div class="field">
              <label for="descricao">O que está acontecendo?</label>
              <textarea class="textarea" id="descricao" name="descricao" maxlength="1000" placeholder="Ex.: As três tomadas da parede do fundo estão sem energia desde segunda-feira."></textarea>
              <div class="row"><span class="hint">Conte o que você viu, desde quando e onde exatamente.</span><span class="spacer"></span><span class="hint num" data-count>0 de 1000</span></div>
            </div>
            <label class="switch" style="margin-top:20px">
              <input type="checkbox" name="impedeAula" id="impede">
              <span class="track"></span>
              <span class="txt"><b>Impede uma aula ou atividade agora</b><span>Marque se a sala, o laboratório ou o equipamento não pode ser usado nas próximas aulas.</span></span>
            </label>
          </div>
          <div class="formsec">
            <p class="label">Imagens ou vídeos <span class="opt">(opcional)</span></p>
            <p class="hint" style="margin:4px 0 12px">JPG, PNG ou WEBP de até ${Shared.LIMITES.image} MB; MP4 de até ${Shared.LIMITES.video} MB.</p>
            <label class="drop" data-drop>
              ${ic('add_photo_alternate')}
              <b>Arraste os arquivos para cá ou escolha do dispositivo</b>
              <span class="small muted">Fotos ajudam a equipe a levar o material certo.</span>
              <input type="file" class="sr-only" accept=".jpg,.jpeg,.png,.webp,.mp4" multiple data-file>
            </label>
            <ul class="files" data-files></ul>
          </div>
          <div class="sticky-actions" data-actions>
            <span class="muted small" data-status></span>
            <span class="spacer"></span>
            <a class="btn btn-ghost" href="#/painel">Voltar</a>
            <button class="btn btn-primary" type="submit" data-submit>${ic('send')}Enviar chamado</button>
          </div>
        </div>
        <aside class="stack">
          <section class="panel panel-pad stack-sm" aria-live="polite">
            <h2 class="h3">Prioridade calculada</h2>
            <div data-prio></div>
          </section>
          <section class="aside-note stack-sm">
            <h2 class="h3">Depois do envio</h2>
            <ol style="margin:0;padding-left:20px;display:grid;gap:6px">
              <li>Você recebe um protocolo.</li>
              <li>A gestão faz a triagem e atribui a uma equipe.</li>
              <li>A equipe registra o atendimento.</li>
              <li>Você acompanha tudo em <a href="#/meus">Meus chamados</a>.</li>
            </ol>
          </section>
        </aside>
      </form>`;
    },
    mount(root) {
      const form = $(root, '[data-form]');
      const files = [];
      const sel = id => $(root, '#' + id);
      const fill = (el, items, ph) => {
        el.innerHTML = `<option value="">${ph}</option>` + items.map(i => `<option value="${i.id}">${esc(i.nome)}</option>`).join('');
        el.disabled = !items.length;
      };
      const reset = (el, ph) => { el.innerHTML = `<option value="">${ph}</option>`; el.disabled = true; };
      sel('campus').addEventListener('change', e => {
        const v = e.target.value;
        if (v) fill(sel('bloco'), DB.s.blocos.filter(b => b.campus === v && b.ativo), 'Selecione'); else reset(sel('bloco'), 'Escolha o campus primeiro');
        reset(sel('andar'), 'Escolha o bloco primeiro'); reset(sel('ambiente'), 'Escolha o andar primeiro');
      });
      sel('bloco').addEventListener('change', e => {
        const v = e.target.value;
        if (v) fill(sel('andar'), DB.s.andares.filter(a => a.bloco === v && a.ativo), 'Selecione'); else reset(sel('andar'), 'Escolha o bloco primeiro');
        reset(sel('ambiente'), 'Escolha o andar primeiro');
      });
      sel('andar').addEventListener('change', e => {
        const v = e.target.value;
        if (v) fill(sel('ambiente'), DB.s.ambientes.filter(a => a.andar === v && a.ativo), 'Selecione'); else reset(sel('ambiente'), 'Escolha o andar primeiro');
      });
      ['campus', 'bloco', 'andar', 'ambiente'].forEach(id => sel(id).addEventListener('change', e => fieldError(e.target, '')));

      // Busca direta: escolher um resultado preenche campus, bloco, andar e ambiente
      const locq = sel('locq'), locList = $(root, '#locq-list');
      const setLocal = ambId => {
        const p = DB.localPartes(ambId);
        [['campus', p.campus.id], ['bloco', p.bloco.id], ['andar', p.andar.id], ['ambiente', p.ambiente.id]].forEach(([id, v]) => {
          sel(id).value = v; sel(id).dispatchEvent(new Event('change', { bubbles: true }));
        });
      };
      const closeList = () => { locList.hidden = true; locq.setAttribute('aria-expanded', 'false'); };
      const drawLoc = () => {
        const q = locq.value;
        const res = Shared.buscaAmbientes(q, true);
        if (Shared.norm(q).trim().length < 2) return closeList();
        locList.innerHTML = res.length
          ? res.slice(0, 8).map(p => `<li role="option"><button type="button" data-amb="${p.ambiente.id}">${ic('location_on')}<span><b>${esc(p.ambiente.nome)}</b><small>${esc(p.campus.nome)}, ${esc(p.bloco.nome)}, ${esc(p.andar.nome)}</small></span></button></li>`).join('')
            + (res.length > 8 ? `<li class="locmore">Mais ${res.length - 8} resultados. Digite mais para refinar.</li>` : '')
          : `<li class="locmore">Nenhum local ativo encontrado. Confira o código ou escolha nas listas.</li>`;
        locList.hidden = false; locq.setAttribute('aria-expanded', 'true');
      };
      locq.addEventListener('input', drawLoc);
      locq.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { locList.querySelector('button')?.focus(); e.preventDefault(); }
        if (e.key === 'Escape') closeList();
        if (e.key === 'Enter') { e.preventDefault(); locList.querySelector('button')?.click(); }
      });
      locList.addEventListener('keydown', e => {
        const btns = [...locList.querySelectorAll('button')], i = btns.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { btns[Math.min(i + 1, btns.length - 1)]?.focus(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { (i <= 0 ? locq : btns[i - 1]).focus(); e.preventDefault(); }
        if (e.key === 'Escape') { closeList(); locq.focus(); }
      });
      locList.addEventListener('click', e => {
        const b = e.target.closest('[data-amb]');
        if (!b) return;
        setLocal(b.dataset.amb);
        locq.value = ''; closeList();
        toast(`Local definido: ${DB.localCurto(b.dataset.amb)}.`);
        sel('descricao').focus();
      });
      root.addEventListener('focusin', e => { if (!e.target.closest('.locsearch')) closeList(); });

      const desc = sel('descricao'), count = $(root, '[data-count]');
      desc.addEventListener('input', () => { count.textContent = `${desc.value.length} de 1000`; if (desc.value.trim().length >= 20) fieldError(desc, ''); });

      const prioBox = $(root, '[data-prio]');
      const updPrio = () => {
        const cat = form.categoria.value, imp = sel('impede').checked;
        if (!cat && !imp) { prioBox.innerHTML = `<p class="small muted">Escolha a categoria para ver a prioridade que o sistema vai atribuir.</p>`; return; }
        const p = DB.calcPrioridade(cat, imp), P = PRIORIDADES[p];
        const why = imp ? 'A ocorrência impede atividade letiva imediata.' : p === 'media' ? 'Problemas desta categoria podem afetar segurança ou uso do espaço.' : 'Não há impacto imediato informado nas aulas.';
        prioBox.innerHTML = `<div class="prio-preview"><span class="prio ${P.tone}" style="font-size:22px"><span class="big">${P.label}</span></span></div><p class="small muted">${why}</p>`;
      };
      $$(root, '[name=categoria]').forEach(r => r.addEventListener('change', () => { updPrio(); $(root, '#cat-group').removeAttribute('aria-invalid'); $(root, '#cat-err')?.remove(); }));
      sel('impede').addEventListener('change', updPrio);
      updPrio();

      const list = $(root, '[data-files]');
      const drawFiles = () => {
        list.innerHTML = files.map((f, i) => `<li class="file${f.err ? ' bad' : ''}">
          <span class="ico">${ic(f.err ? 'error' : f.video ? 'movie' : 'image')}</span>
          <span style="min-width:0"><b>${esc(f.name)}</b><small>${f.err ? esc(f.err) : `${f.video ? 'Vídeo' : 'Imagem'}, ${fmt.dec(f.size / 1048576)} MB`}</small></span>
          <button class="iconbtn" type="button" data-rm="${i}" aria-label="Remover ${esc(f.name)}">${ic('close')}</button></li>`).join('');
      };
      const addFiles = fl => {
        [...fl].forEach(f => files.push({ name: f.name, size: f.size, video: /\.mp4$/i.test(f.name), err: Shared.fileError(f) }));
        drawFiles();
      };
      $(root, '[data-file]').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
      const drop = $(root, '[data-drop]');
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
      list.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { files.splice(+b.dataset.rm, 1); drawFiles(); } });

      // restaura rascunho se um envio falhou
      if (rascunho) {
        const r = rascunho; rascunho = null;
        if (r.categoria) { const el = $(root, `#cat-${r.categoria}`); if (el) el.checked = true; }
        desc.value = r.descricao || ''; sel('impede').checked = !!r.impedeAula; updPrio();
      }

      form.addEventListener('submit', e => {
        e.preventDefault();
        let first = null;
        const flag = (el, m) => { fieldError(el, m); if (m && !first) first = el; };
        const cat = form.categoria.value;
        const group = $(root, '#cat-group');
        $(root, '#cat-err')?.remove();
        if (!cat) {
          group.setAttribute('aria-invalid', 'true');
          group.insertAdjacentHTML('afterend', `<p class="err" id="cat-err" style="margin-top:10px">${ic('error')}<span>Escolha uma categoria.</span></p>`);
          first = first || group.querySelector('input');
        }
        flag(sel('campus'), sel('campus').value ? '' : 'Escolha o campus.');
        if (sel('campus').value) flag(sel('bloco'), sel('bloco').value ? '' : 'Escolha o bloco.');
        if (sel('bloco').value) flag(sel('andar'), sel('andar').value ? '' : 'Escolha o andar.');
        if (sel('andar').value) flag(sel('ambiente'), sel('ambiente').value ? '' : 'Escolha o ambiente.');
        const dv = desc.value.trim();
        flag(desc, dv.length < 20 ? 'Descreva o problema com pelo menos 20 caracteres.' : '');
        const badFiles = files.filter(f => f.err);
        if (badFiles.length && !first) {
          toast('Remova os arquivos recusados antes de enviar.', 'err');
          first = list.querySelector('.bad button');
        }
        if (first) { first.focus(); return; }

        // envio simulado com progresso
        const btn = $(root, '[data-submit]'), status = $(root, '[data-status]');
        btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>Enviando`;
        const okFiles = files.filter(f => !f.err);
        let p = 0;
        status.innerHTML = `<span style="display:inline-grid;gap:6px;min-width:180px">${okFiles.length ? 'Enviando anexos' : 'Registrando chamado'}<span class="progress"><i style="--p:0%"></i></span></span>`;
        const bar = status.querySelector('i');
        const timer = setInterval(() => {
          p = Math.min(100, p + (okFiles.length ? 12 : 30));
          bar.style.setProperty('--p', p + '%');
          if (p < 100) return;
          clearInterval(timer);
          const u = me();
          const prioridade = DB.calcPrioridade(cat, sel('impede').checked);
          const id = DB.novoProtocolo();
          const agora = DB.HOJE.toISOString().slice(0, 11) + new Date().toTimeString().slice(0, 8);
          DB.s.chamados.unshift({
            id, categoria: cat, ambiente: sel('ambiente').value, autor: u.id, impedeAula: sel('impede').checked, prioridade, estado: 'triagem',
            descricao: dv, criadoEm: new Date(agora).toISOString(), equipe: '', executor: '',
            anexos: okFiles.map(f => ({ nome: f.name, tipo: f.video ? 'video' : 'image', tamanho: +(f.size / 1048576).toFixed(1) || 0.1 })),
            historico: [{ em: new Date(agora).toISOString(), autor: u.id, tipo: 'estado', texto: `Chamado aberto. Prioridade ${PRIORIDADES[prioridade].label.toLowerCase()} calculada${sel('impede').checked ? ': ocorrência impede atividade letiva' : ''}.`, publico: true }]
          });
          DB.save();
          location.hash = `#/confirmacao/${id}`;
        }, 140);
      });
    }
  };

  /* =========================================================
     T04 — Confirmação
     ========================================================= */
  Screens.confirmacao = {
    title: 'Chamado registrado',
    render(id) {
      const c = DB.chamado(id);
      if (!c || c.autor !== me().id) return null;
      const cat = DB.cat(c.categoria);
      return `<div class="confirm">
        <span class="seal">${ic('check')}</span>
        <h1 class="display" style="font-size:clamp(32px,4.4vw,44px)">Chamado registrado</h1>
        <p class="lede">Guarde o protocolo. Ele identifica o chamado em qualquer conversa com a gestão ou com a equipe de atendimento.</p>
        <div class="protobox">
          <div><div class="k">Protocolo</div><div class="v protocolo">${esc(c.id)}</div></div>
          <button class="btn btn-secondary" type="button" data-copy="${esc(c.id)}">${ic('content_copy')}Copiar protocolo</button>
        </div>
        <section class="panel panel-pad">
          <dl class="dl">
            <dt>Situação</dt><dd>${tag(c.estado)}</dd>
            <dt>Prioridade</dt><dd>${prio(c.prioridade)}<span class="muted small" style="margin-left:8px;font-weight:400">calculada pelo sistema</span></dd>
            <dt>Categoria</dt><dd>${esc(cat.nome)}</dd>
            <dt>Local</dt><dd>${esc(DB.localCompleto(c.ambiente))}</dd>
            <dt>Anexos</dt><dd>${c.anexos.length ? c.anexos.map(a => esc(a.nome)).join(', ') : 'Nenhum'}</dd>
          </dl>
        </section>
        <div class="banner info" style="margin-top:20px">${ic('info')}<div>Acompanhe o andamento pela página do chamado. O envio de avisos por e-mail ainda não está disponível.</div></div>
        <div class="row" style="margin-top:28px">
          <a class="btn btn-primary" href="#/chamado/${esc(c.id)}">Ver chamado</a>
          <a class="btn btn-secondary" href="#/meus">Ir para meus chamados</a>
          <a class="btn btn-ghost" href="#/abrir">Abrir outro chamado</a>
        </div>
      </div>`;
    },
    mount(root, id) { Shared.bindCommon(root, DB.chamado(id)); }
  };

  /* =========================================================
     T05 — Meus chamados
     ========================================================= */
  const GRUPOS = {
    todos: { label: 'Todos', test: () => true },
    andamento: { label: 'Em andamento', test: c => ABERTOS.includes(c.estado) },
    resolvidos: { label: 'Resolvidos', test: c => c.estado === 'resolvido' || c.estado === 'concluido' },
    cancelados: { label: 'Cancelados', test: c => c.estado === 'cancelado' }
  };
  let meusFiltro = { q: '', g: 'todos' };
  let meusCarregado = false;
  Screens.meus = {
    title: 'Meus chamados',
    render() {
      const meus = DB.s.chamados.filter(c => c.autor === me().id);
      return `<div class="pagehead"><div><h1 class="h1">Meus chamados</h1><p class="lede">Chamados que você abriu, do mais recente ao mais antigo.</p></div>
        <div class="actions"><a class="btn btn-primary" href="#/abrir">${ic('add')}Abrir chamado</a></div></div>
      <section class="panel">
        ${meus.length ? `<div class="toolbar">
          <div class="field grow"><label for="q">Buscar por protocolo</label><div class="input-icon">${ic('search')}<input class="input" id="q" type="search" placeholder="Ex.: 2026-0418" value="${esc(meusFiltro.q)}"></div></div>
          <div class="field" style="flex:0 1 auto"><span class="label" style="font-size:12.5px;color:var(--ink-2)" id="g-lbl">Situação</span>
            <div class="segmented" role="group" aria-labelledby="g-lbl">${Object.entries(GRUPOS).map(([k, g]) => `<button type="button" data-g="${k}" aria-pressed="${meusFiltro.g === k}">${g.label}<span class="n">${meus.filter(g.test).length}</span></button>`).join('')}</div>
          </div>
        </div>` : ''}
        <div data-list></div>
      </section>`;
    },
    mount(root) {
      const meus = DB.s.chamados.filter(c => c.autor === me().id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      const host = $(root, '[data-list]');
      const draw = () => {
        if (!meus.length) { host.innerHTML = empty('post_add', 'Você ainda não abriu chamados', 'Quando encontrar um problema em sala, laboratório ou prédio, registre aqui para a equipe de manutenção.', `<a class="btn btn-primary" href="#/abrir">${ic('add')}Abrir chamado</a>`); return; }
        const q = meusFiltro.q.trim().toLowerCase();
        const res = meus.filter(GRUPOS[meusFiltro.g].test).filter(c => !q || c.id.toLowerCase().includes(q));
        host.innerHTML = res.length
          ? `<ul class="tlist">${res.map(c => ticketRow(c, `#/chamado/${c.id}`)).join('')}</ul><div class="listfoot">${res.length} de ${meus.length} chamados</div>`
          : empty('filter_alt_off', 'Nenhum chamado com esses filtros', q ? `Nenhum protocolo contém “${esc(meusFiltro.q)}”.` : 'Tente outra situação.', `<button class="btn btn-secondary" type="button" data-clear>Limpar filtros</button>`);
      };
      if (!meusCarregado) { meusCarregado = true; this._cancel = Shared.withLoading(root, '[data-list]', draw); } else draw();
      root.addEventListener('input', e => { if (e.target.id === 'q') { meusFiltro.q = e.target.value; draw(); } });
      root.addEventListener('click', e => {
        const g = e.target.closest('[data-g]');
        if (g) { meusFiltro.g = g.dataset.g; $$(root, '[data-g]').forEach(b => b.setAttribute('aria-pressed', b === g)); draw(); }
        if (e.target.closest('[data-clear]')) { meusFiltro = { q: '', g: 'todos' }; const qi = $(root, '#q'); if (qi) qi.value = ''; $$(root, '[data-g]').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === 'todos')); draw(); }
      });
    },
    unmount() { this._cancel && this._cancel(); }
  };

  /* =========================================================
     T06 — Detalhes do chamado (solicitante)
     ========================================================= */
  let nota = 0;
  Screens.chamado = {
    title: id => 'Chamado ' + id,
    render(id) {
      const c = DB.chamado(id);
      if (!c || c.autor !== me().id) return null;
      const cat = DB.cat(c.categoria);
      let action = '';
      if (c.estado === 'triagem' || c.estado === 'atribuido' || c.estado === 'reencaminhado') {
        action = `<section class="panel panel-pad stack-sm"><h2 class="h3">Cancelar chamado</h2>
          <p class="small muted">${c.estado === 'triagem' ? 'Você pode cancelar enquanto o chamado aguarda triagem.' : 'O chamado já foi atribuído. Para cancelar, informe o motivo.'}</p>
          <button class="btn btn-danger" type="button" data-cancel>${ic('block')}Cancelar chamado</button></section>`;
      } else if (c.estado === 'atendimento') {
        action = `<section class="aside-note">${ic('info')} O atendimento já começou, por isso o chamado não pode mais ser cancelado.</section>`;
      } else if (c.estado === 'resolvido') {
        nota = 0;
        action = `<section class="panel"><form data-rate novalidate>
          <div class="panel-head"><h2 class="h2">O problema foi resolvido?</h2></div>
          <div class="panel-body stack-sm">
            <p class="small muted">A equipe marcou este chamado como resolvido. Avalie o atendimento ou apenas confirme a conclusão.</p>
            <fieldset class="fieldset"><legend class="label">Sua nota <span class="opt">(opcional)</span></legend>
              <div class="row" style="gap:10px"><div class="stars" role="radiogroup" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} de 5" data-star="${n}">${ic('star')}</button>`).join('')}</div><span class="small muted" data-notatxt>Sem nota</span></div>
            </fieldset>
            <div class="field"><label for="coment">Comentário <span class="opt">(opcional)</span></label><textarea class="textarea" id="coment" name="coment" style="min-height:84px" maxlength="500"></textarea></div>
            <div class="stack-sm" style="gap:8px">
              <button class="btn btn-primary btn-block" type="submit">Concluir chamado</button>
              <button class="btn btn-ghost btn-block" type="button" data-reopen>O problema continua</button>
            </div>
          </div></form></section>`;
      } else if (c.estado === 'concluido') {
        action = c.avaliacao ? `<section class="panel panel-pad stack-sm"><h2 class="h3">Sua avaliação</h2>
          <div class="row" style="gap:8px"><span class="stars-static" aria-hidden="true">${[1, 2, 3, 4, 5].map(n => ic('star', n <= c.avaliacao.nota ? '' : 'off')).join('')}</span><b class="small">${c.avaliacao.nota} de 5</b></div>
          ${c.avaliacao.comentario ? `<p class="small">“${esc(c.avaliacao.comentario)}”</p>` : ''}</section>` : `<section class="aside-note">${ic('verified')} Chamado concluído sem avaliação.</section>`;
      } else if (c.estado === 'cancelado') {
        action = `<section class="aside-note">${ic('block')} Este chamado foi cancelado. Se o problema voltar, abra um novo chamado.</section>`;
      }
      const bar = c.estado === 'resolvido'
        ? `<button class="btn btn-primary" type="button" data-scrollto="[data-rate]">${ic('rate_review')}Avaliar e concluir</button>` : '';
      return `${Shared.backLink('#/meus', 'Meus chamados')}
        ${Shared.ticketHead(c)}
        ${Shared.trailPanel(c)}
        ${Shared.mobileBar(bar)}
        <div class="grid-main">
          <div class="stack">${Shared.descPanel(c)}${Shared.evidPanel(c)}${Shared.historyPanel(c)}</div>
          <aside class="stack">
            ${action}
            <section class="panel panel-pad"><h2 class="h3" style="margin-bottom:14px">Detalhes</h2>
              <dl class="kv">
                <div><dt>Categoria</dt><dd>${esc(cat.nome)}</dd></div>
                <div><dt>Local</dt><dd>${esc(DB.localCompleto(c.ambiente))}</dd></div>
                <div><dt>Aberto em</dt><dd>${fmt.dataHora(c.criadoEm)}</dd></div>
                <div><dt>Prioridade</dt><dd>${prio(c.prioridade)} <span class="muted small">calculada pelo sistema</span></dd></div>
                <div><dt>Setor responsável</dt><dd>${c.equipe ? esc(c.equipe) : '<span class="muted">Definido na triagem</span>'}</dd></div>
              </dl>
            </section>
          </aside>
        </div>`;
    },
    mount(root, id) {
      const c = DB.chamado(id);
      const rerender = () => App.render();
      Shared.bindCommon(root, c, rerender);
      const now = () => new Date(DB.HOJE.toISOString().slice(0, 11) + new Date().toTimeString().slice(0, 8)).toISOString();
      $(root, '[data-cancel]')?.addEventListener('click', async () => {
        const needs = c.estado !== 'triagem';
        const fd = await dialog({
          title: `Cancelar o chamado ${esc(c.id)}?`,
          body: `<p>O chamado sai da fila e não poderá ser reaberto. Se o problema voltar, será preciso abrir um novo.</p>
            <div class="field"><label for="just">Motivo${needs ? '' : ' <span class="opt">(opcional)</span>'}</label><textarea class="textarea" id="just" name="just" style="min-height:90px" maxlength="500"></textarea></div>`,
          confirm: 'Cancelar chamado', cancel: 'Manter chamado', danger: true,
          validate: (f, form) => {
            const ta = form.querySelector('#just');
            const m = needs && f.get('just').trim().length < 10 ? 'Informe o motivo com pelo menos 10 caracteres.' : '';
            fieldError(ta, m); if (m) ta.focus(); return m;
          }
        });
        if (!fd) return;
        // revalida o estado atual antes de aplicar (a tela pode estar desatualizada)
        if (!['triagem', 'atribuido', 'reencaminhado'].includes(c.estado)) { toast('O atendimento já começou. O chamado não pode mais ser cancelado.', 'err'); return rerender(); }
        const j = fd.get('just').trim();
        c.estado = 'cancelado';
        c.historico.push({ em: now(), autor: c.autor, tipo: 'estado', texto: 'Cancelado pelo solicitante' + (j ? ': ' + j : '.'), publico: true });
        DB.save(); toast(`Chamado ${c.id} cancelado.`); rerender();
      });
      const rate = $(root, '[data-rate]');
      if (rate) {
        const stars = $$(root, '[data-star]'), txt = $(root, '[data-notatxt]');
        const paint = n => stars.forEach(s => { const on = +s.dataset.star <= n; s.classList.toggle('on', on); s.setAttribute('aria-checked', +s.dataset.star === n); });
        stars.forEach(s => {
          s.addEventListener('click', () => { nota = nota === +s.dataset.star ? 0 : +s.dataset.star; paint(nota); txt.textContent = nota ? `${nota} de 5` : 'Sem nota'; });
          s.addEventListener('mouseenter', () => paint(+s.dataset.star));
          s.addEventListener('mouseleave', () => paint(nota));
        });
        rate.addEventListener('submit', e => {
          e.preventDefault();
          const com = $(root, '#coment').value.trim();
          c.estado = 'concluido';
          if (nota) {
            c.avaliacao = { nota, comentario: com };
            c.historico.push({ em: now(), autor: c.autor, tipo: 'avaliacao', texto: `Avaliação registrada: ${nota} de 5.`, publico: true });
          } else {
            c.historico.push({ em: now(), autor: c.autor, tipo: 'estado', texto: 'Ciência registrada pelo solicitante. Concluído sem avaliação.', publico: true });
          }
          DB.save(); toast(`Chamado ${c.id} concluído.`); rerender();
        });
        $(root, '[data-reopen]').addEventListener('click', async () => {
          const fd = await dialog({
            title: 'O problema continua?',
            body: `<p>O chamado volta para a equipe responsável com a sua observação.</p><div class="field"><label for="obs">O que ainda está acontecendo?</label><textarea class="textarea" id="obs" name="obs" style="min-height:90px"></textarea></div>`,
            confirm: 'Devolver à equipe',
            validate: (f, form) => { const ta = form.querySelector('#obs'); const m = f.get('obs').trim().length < 10 ? 'Descreva o que continua acontecendo.' : ''; fieldError(ta, m); return m; }
          });
          if (!fd) return;
          c.estado = 'atendimento';
          c.historico.push({ em: now(), autor: c.autor, tipo: 'estado', texto: 'Solicitante informou que o problema continua: ' + fd.get('obs').trim(), publico: true });
          DB.save(); toast('Chamado devolvido à equipe.'); rerender();
        });
      }
    }
  };

  window.Screens = Screens;
  window.Shared = Shared;
  window.Shared.ABERTOS = ABERTOS;
  window.Shared.minhasDemandas = minhasDemandas;
})();
