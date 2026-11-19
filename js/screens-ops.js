/* Telas operacionais: T07 fila, T08 atribuição, T09 detalhes gerenciais, T11 demandas, T12 atendimento */
(function () {
  'use strict';
  const { esc, ic, fmt, tag, prio, ticketRow, empty, toast, dialog, fieldError } = UI;
  const { ESTADOS, PRIORIDADES, SETORES } = DB;
  const me = () => App.me();
  const $ = (root, s) => root.querySelector(s);
  const $$ = (root, s) => [...root.querySelectorAll(s)];
  const ORD = ['alta', 'media', 'baixa'];
  const SETORES_OP = SETORES.filter(s => !['Administração do campus', 'Reitoria'].includes(s));
  const now = () => new Date(DB.HOJE.toISOString().slice(0, 11) + new Date().toTimeString().slice(0, 8)).toISOString();

  /* =========================================================
     T07 — Fila geral de triagem
     ========================================================= */
  let filaF = { modo: 'triagem', bloco: '', andar: '', amb: '', cat: '', prio: '' };
  let filaCarregada = false;
  let filaSort = { col: 'prio', dir: 1 };
  const nomeNum = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true });
  const ORDENS = {
    id: (a, b) => nomeNum(a.id, b.id),
    cat: (a, b) => nomeNum(DB.cat(a.categoria).nome, DB.cat(b.categoria).nome),
    local: (a, b) => nomeNum(DB.amb(a.ambiente).nome, DB.amb(b.ambiente).nome),
    prio: (a, b) => ORD.indexOf(a.prioridade) - ORD.indexOf(b.prioridade) || a.criadoEm.localeCompare(b.criadoEm),
    espera: (a, b) => a.criadoEm.localeCompare(b.criadoEm)
  };
  Screens.fila = {
    title: 'Fila de triagem',
    render() {
      const gestor = DB.can('gestor');
      const abertos = DB.s.chamados.filter(c => Shared.ABERTOS.includes(c.estado));
      const blocosUsados = [...new Set(abertos.map(c => DB.localPartes(c.ambiente).bloco.id))].map(id => DB.bloco(id));
      return `<div class="pagehead"><div><h1 class="h1">Fila de triagem</h1>
        <p class="lede">Chamados novos, ordenados por prioridade e pelo tempo de espera.${gestor ? ' Atribua cada um à equipe responsável.' : ''}</p></div></div>
      ${gestor ? '' : `<div class="banner info" style="margin-bottom:20px">${ic('visibility')}<div>Você pode consultar a fila. A atribuição inicial é feita pela gestão.</div></div>`}
      <section class="panel">
        <div class="toolbar" style="padding-bottom:12px;border-bottom:0">
          <div class="segmented" role="group" aria-label="Quais chamados mostrar">
            <button type="button" data-modo="triagem" aria-pressed="${filaF.modo === 'triagem'}">Aguardando triagem<span class="n">${abertos.filter(c => c.estado === 'triagem').length}</span></button>
            <button type="button" data-modo="todos" aria-pressed="${filaF.modo === 'todos'}">Todos em aberto<span class="n">${abertos.length}</span></button>
          </div>
        </div>
        <form class="toolbar" data-filters>
          <div class="field"><label for="f-bloco">Bloco</label><select class="select" id="f-bloco" name="bloco"><option value="">Todos</option>${blocosUsados.map(b => `<option value="${b.id}" ${filaF.bloco === b.id ? 'selected' : ''}>${esc(b.nome)} (${esc(DB.campus(b.campus).codigo)})</option>`).join('')}</select></div>
          <div class="field"><label for="f-andar">Andar</label><select class="select" id="f-andar" name="andar"><option value="">Todos</option></select></div>
          <div class="field"><label for="f-amb">Sala</label><select class="select" id="f-amb" name="amb"><option value="">Todas</option></select></div>
          <div class="field"><label for="f-cat">Categoria</label><select class="select" id="f-cat" name="cat"><option value="">Todas</option>${DB.s.categorias.map(c => `<option value="${c.id}" ${filaF.cat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-prio">Prioridade</label><select class="select" id="f-prio" name="prio"><option value="">Todas</option>${ORD.map(p => `<option value="${p}" ${filaF.prio === p ? 'selected' : ''}>${PRIORIDADES[p].label}</option>`).join('')}</select></div>
          <button class="btn btn-ghost" type="button" data-clear style="height:38px">Limpar filtros</button>
        </form>
        <div data-list></div>
      </section>`;
    },
    mount(root) {
      const gestor = DB.can('gestor');
      const host = $(root, '[data-list]');
      const fAndar = $(root, '#f-andar'), fAmb = $(root, '#f-amb');
      const abertos = () => DB.s.chamados.filter(c => Shared.ABERTOS.includes(c.estado));
      const fillDeps = () => {
        const used = abertos().map(c => DB.localPartes(c.ambiente));
        const andares = [...new Map(used.filter(p => p.bloco.id === filaF.bloco).map(p => [p.andar.id, p.andar])).values()];
        fAndar.innerHTML = `<option value="">Todos</option>` + andares.map(a => `<option value="${a.id}" ${filaF.andar === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('');
        fAndar.disabled = !filaF.bloco;
        const ambs = [...new Map(used.filter(p => p.andar.id === filaF.andar).map(p => [p.ambiente.id, p.ambiente])).values()];
        fAmb.innerHTML = `<option value="">Todas</option>` + ambs.map(a => `<option value="${a.id}" ${filaF.amb === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('');
        fAmb.disabled = !filaF.andar;
      };
      const draw = () => {
        const base = abertos().filter(c => filaF.modo === 'todos' || c.estado === 'triagem');
        const res = base.filter(c => {
          const p = DB.localPartes(c.ambiente);
          return (!filaF.bloco || p.bloco.id === filaF.bloco) && (!filaF.andar || p.andar.id === filaF.andar) && (!filaF.amb || p.ambiente.id === filaF.amb) &&
            (!filaF.cat || c.categoria === filaF.cat) && (!filaF.prio || c.prioridade === filaF.prio);
        }).sort((a, b) => ORDENS[filaSort.col](a, b) * filaSort.dir);
        const anyFilter = filaF.bloco || filaF.andar || filaF.amb || filaF.cat || filaF.prio;
        // Etiquetas dos filtros ativos, cada uma removível
        const ativos = [
          filaF.bloco && ['bloco', 'Bloco', DB.bloco(filaF.bloco).nome],
          filaF.andar && ['andar', 'Andar', DB.andar(filaF.andar).nome],
          filaF.amb && ['amb', 'Sala', DB.amb(filaF.amb).nome],
          filaF.cat && ['cat', 'Categoria', DB.cat(filaF.cat).nome],
          filaF.prio && ['prio', 'Prioridade', PRIORIDADES[filaF.prio].label]
        ].filter(Boolean);
        const chips = ativos.length ? `<div class="activefilters"><span class="small muted">Filtrando por</span>${ativos.map(([k, l, v]) =>
          `<button class="fchip" type="button" data-rmf="${k}" aria-label="Remover filtro ${l}: ${esc(v)}">${l}: <b>${esc(v)}</b>${ic('close')}</button>`).join('')}</div>` : '';
        const th = (col, label) => {
          const on = filaSort.col === col;
          return `<th aria-sort="${on ? (filaSort.dir === 1 ? 'ascending' : 'descending') : 'none'}"><button class="thsort${on ? ' on' : ''}" type="button" data-sort="${col}">${label}${ic(on ? (filaSort.dir === 1 ? 'arrow_upward' : 'arrow_downward') : 'unfold_more')}</button></th>`;
        };
        if (!base.length) { host.innerHTML = empty('inbox', 'Nenhum chamado aguardando triagem', 'Os chamados novos aparecem aqui assim que são registrados.'); return; }
        if (!res.length) { host.innerHTML = chips + empty('filter_alt_off', 'Nenhum chamado com esses filtros', 'Remova algum filtro para ver mais resultados.', anyFilter ? `<button class="btn btn-secondary" type="button" data-clear>Limpar filtros</button>` : ''); return; }
        host.innerHTML = `${chips}<div class="tablewrap"><table class="table stack-mobile">
          <thead><tr>${th('id', 'Protocolo')}${th('cat', 'Categoria')}${th('local', 'Local')}${th('prio', 'Prioridade')}${th('espera', 'Espera')}<th>Situação</th><th class="r"><span class="sr-only">Ações</span></th></tr></thead>
          <tbody>${res.map(c => {
            const p = DB.localPartes(c.ambiente), cat = DB.cat(c.categoria);
            return `<tr>
              <td class="protocolo"><a href="#/operacao/${c.id}">${esc(c.id)}</a></td>
              <td data-l="Categoria"><span class="catcell">${ic(cat.icon)}${esc(cat.nome)}</span><span class="cellsub">${c.anexos.length ? `${ic('attach_file')} ${c.anexos.length}` : ''}</span></td>
              <td data-l="Local">${esc(p.ambiente.nome)}<span class="cellsub">${esc(p.bloco.nome)}, ${esc(p.andar.nome)}, ${esc(p.campus.codigo)}</span></td>
              <td data-l="Prioridade">${prio(c.prioridade)}</td>
              <td data-l="Aberto">${fmt.relativo(c.criadoEm)}<span class="cellsub">${fmt.data(c.criadoEm)}</span></td>
              <td>${tag(c.estado, true)}</td>
              <td class="r"><div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:nowrap">
                <a class="btn btn-ghost btn-sm" href="#/operacao/${c.id}">Detalhes</a>
                ${gestor && c.estado === 'triagem' ? `<a class="btn btn-primary btn-sm" href="#/fila/${c.id}/atribuir">Atribuir</a>` : ''}
              </div></td></tr>`;
          }).join('')}</tbody></table></div>
          <div class="listfoot">${res.length} de ${base.length} chamados</div>`;
      };
      fillDeps();
      if (!filaCarregada) { filaCarregada = true; this._c = Shared.withLoading(root, '[data-list]', draw); } else draw();
      $(root, '[data-filters]').addEventListener('change', e => {
        const n = e.target.name; filaF[n] = e.target.value;
        if (n === 'bloco') { filaF.andar = ''; filaF.amb = ''; }
        if (n === 'andar') filaF.amb = '';
        fillDeps(); draw();
      });
      const syncSelects = () => {
        $(root, '#f-bloco').value = filaF.bloco; $(root, '#f-cat').value = filaF.cat; $(root, '#f-prio').value = filaF.prio;
        fillDeps();
      };
      root.addEventListener('click', e => {
        const so = e.target.closest('[data-sort]');
        if (so) {
          const col = so.dataset.sort;
          filaSort = filaSort.col === col ? { col, dir: -filaSort.dir } : { col, dir: 1 };
          draw(); $(root, `[data-sort="${col}"]`)?.focus();
          return;
        }
        const rm = e.target.closest('[data-rmf]');
        if (rm) {
          const k = rm.dataset.rmf;
          filaF[k] = '';
          if (k === 'bloco') { filaF.andar = ''; filaF.amb = ''; }
          if (k === 'andar') filaF.amb = '';
          syncSelects(); draw();
          ($(root, '.fchip') || $(root, '#f-' + k))?.focus();
          return;
        }
        const m = e.target.closest('[data-modo]');
        if (m) { filaF.modo = m.dataset.modo; $$(root, '[data-modo]').forEach(b => b.setAttribute('aria-pressed', b === m)); draw(); }
        if (e.target.closest('[data-clear]')) {
          filaF = { modo: filaF.modo, bloco: '', andar: '', amb: '', cat: '', prio: '' };
          $$(root, '[data-filters] select').forEach(s => { s.value = ''; });
          fillDeps(); draw();
        }
      });
    },
    unmount() { this._c && this._c(); }
  };

  /* Resumo compacto de chamado (atribuição) */
  function resumo(c) {
    const cat = DB.cat(c.categoria);
    const autor = DB.user(c.autor);
    return `<section class="panel">
      <div class="panel-head"><h2 class="h2">Resumo do chamado</h2>${tag(c.estado, true)}</div>
      <div class="panel-body stack">
        <dl class="dl">
          <dt>Prioridade calculada</dt><dd>${prio(c.prioridade)}${c.impedeAula ? ' <span class="muted small" style="font-weight:400">impede atividade letiva</span>' : ''}</dd>
          <dt>Categoria</dt><dd>${esc(cat.nome)}</dd>
          <dt>Local</dt><dd>${esc(DB.localCompleto(c.ambiente))}</dd>
          <dt>Solicitante</dt><dd>${esc(autor.nome)}, ${esc(autor.tipo.toLowerCase())}</dd>
          <dt>Aberto em</dt><dd>${fmt.dataHora(c.criadoEm)}</dd>
        </dl>
        <div><p class="label" style="margin-bottom:6px">Descrição</p><p class="desc">${esc(c.descricao)}</p></div>
        ${c.anexos.length ? `<div><p class="label" style="margin-bottom:10px">Evidências</p><div class="attach">${c.anexos.map((a, i) => `<button class="thumb" type="button" data-preview="${i}"><span class="pv">${ic(a.tipo === 'video' ? 'movie' : 'image')}</span><b>${esc(a.nome)}</b><small>${fmt.dec(a.tamanho)} MB</small></button>`).join('')}</div></div>` : ''}
      </div>
    </section>`;
  }

  /* =========================================================
     T08 — Triar e atribuir
     ========================================================= */
  Screens.atribuir = {
    title: id => 'Atribuir ' + id,
    render(id) {
      const c = DB.chamado(id);
      if (!c) return null;
      const cat = DB.cat(c.categoria);
      const conflict = c.estado !== 'triagem';
      const last = c.historico.slice().reverse().find(h => h.tipo === 'estado');
      return `${Shared.backLink('#/fila', 'Fila de triagem')}
      <div class="pagehead"><div><h1 class="h1">Atribuir chamado <span class="protocolo">${esc(c.id)}</span></h1>
        <p class="lede">Escolha a equipe responsável. O setor padrão da categoria já vem selecionado.</p></div></div>
      <div class="grid-main wide-side">
        ${resumo(c)}
        <form class="panel" novalidate data-assign>
          <div class="panel-head"><h2 class="h2">Responsável</h2></div>
          <div class="panel-body stack">
            ${conflict ? `<div class="banner error" role="alert">${ic('sync_problem')}<div><b>Este chamado já saiu da triagem</b>${esc(DB.user(last.autor)?.nome || '')} alterou a situação em ${fmt.dataHora(last.em)}: ${esc(last.texto)} <a href="#/operacao/${c.id}">Ver detalhes</a></div></div>` : ''}
            <div class="field"><label for="equipe">Equipe</label>
              <select class="select" id="equipe" name="equipe" ${conflict ? 'disabled' : ''}>${SETORES_OP.map(s => `<option ${s === cat.setor ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
              <span class="hint">Setor padrão para ${esc(cat.nome.toLowerCase())}: ${esc(cat.setor)}.</span></div>
            <div class="field"><label for="executor">Executor <span class="opt">(opcional)</span></label>
              <select class="select" id="executor" name="executor" ${conflict ? 'disabled' : ''}></select>
              <span class="hint">Sem executor definido, qualquer pessoa da equipe pode iniciar o atendimento.</span></div>
            <div class="field"><label for="obs">Observação interna <span class="opt">(opcional)</span></label>
              <textarea class="textarea" id="obs" name="obs" style="min-height:90px" ${conflict ? 'disabled' : ''} placeholder="Ex.: verificar também o quadro de energia do andar"></textarea>
              <span class="hint">${ic('visibility_off')} Não aparece para o solicitante.</span></div>
          </div>
          <div class="sticky-actions">
            <a class="btn btn-ghost" href="#/fila">Voltar à fila</a>
            <button class="btn btn-primary" type="submit" ${conflict ? 'disabled' : ''}>Atribuir chamado</button>
          </div>
        </form>
      </div>`;
    },
    mount(root, id) {
      const c = DB.chamado(id);
      Shared.bindCommon(root, c);
      const eq = $(root, '#equipe'), ex = $(root, '#executor');
      const fillEx = () => {
        const list = DB.s.usuarios.filter(u => u.perfis.includes('executor') && u.setor === eq.value && u.acessoAtivo);
        ex.innerHTML = `<option value="">Toda a equipe</option>` + list.map(u => `<option value="${u.id}">${esc(u.nome)}</option>`).join('');
      };
      fillEx(); eq.addEventListener('change', fillEx);
      $(root, '[data-assign]').addEventListener('submit', async e => {
        e.preventDefault();
        if (c.estado !== 'triagem') { toast('Este chamado já foi atribuído por outra pessoa.', 'err'); return App.render(); }
        const exN = ex.value ? DB.user(ex.value).nome : '';
        const ok = await dialog({
          title: 'Confirmar atribuição',
          body: `<p>O chamado <b class="protocolo">${esc(c.id)}</b> vai para <b>${esc(eq.value)}</b>${exN ? `, com ${esc(exN)} como responsável` : ''}. A atribuição fica registrada no histórico.</p>`,
          confirm: 'Atribuir chamado'
        });
        if (!ok) return;
        c.estado = 'atribuido'; c.equipe = eq.value; c.executor = ex.value;
        c.historico.push({ em: now(), autor: me().id, tipo: 'estado', texto: `Atribuído à equipe ${eq.value}${exN ? ` (${exN})` : ''}.`, publico: true });
        const obs = $(root, '#obs').value.trim();
        if (obs) c.historico.push({ em: now(), autor: me().id, tipo: 'comentario', texto: obs, publico: false });
        DB.save();
        toast(`Chamado ${c.id} atribuído a ${eq.value}.`);
        location.hash = '#/fila';
      });
    }
  };

  /* Painel lateral de detalhes operacionais */
  function sideDetails(c, extra) {
    const cat = DB.cat(c.categoria), autor = DB.user(c.autor), ex = c.executor && DB.user(c.executor);
    return `<section class="panel panel-pad"><h2 class="h3" style="margin-bottom:14px">Detalhes</h2>
      <dl class="kv">
        <div><dt>Solicitante</dt><dd>${esc(autor.nome)}<span class="muted small" style="display:block;font-weight:400">${esc(autor.ident)}, ${esc(autor.tipo.toLowerCase())}</span></dd></div>
        <div><dt>Categoria</dt><dd>${esc(cat.nome)}</dd></div>
        <div><dt>Local</dt><dd>${esc(DB.localCompleto(c.ambiente))}</dd></div>
        <div><dt>Equipe</dt><dd>${c.equipe ? esc(c.equipe) : '<span class="muted">Ainda não atribuído</span>'}</dd></div>
        <div><dt>Executor</dt><dd>${ex ? esc(ex.nome) : '<span class="muted">Toda a equipe</span>'}</dd></div>
        <div><dt>Aberto em</dt><dd>${fmt.dataHora(c.criadoEm)}</dd></div>
        ${extra || ''}
      </dl></section>`;
  }

  /* =========================================================
     T09 — Detalhes e histórico gerencial
     ========================================================= */
  Screens.operacao = {
    title: id => 'Chamado ' + id,
    render(id) {
      const c = DB.chamado(id);
      if (!c) return null;
      const u = me();
      const gestor = DB.can('gestor');
      const responsavel = c.executor === u.id || (c.equipe && c.equipe === u.setor);
      const acts = [];
      if (gestor && c.estado === 'triagem') acts.push(`<a class="btn btn-primary btn-block" href="#/fila/${c.id}/atribuir">${ic('assignment_ind')}Atribuir chamado</a>`);
      if ((responsavel || gestor) && ['atribuido', 'reencaminhado', 'atendimento'].includes(c.estado)) acts.push(`<a class="btn ${acts.length ? 'btn-secondary' : 'btn-primary'} btn-block" href="#/atendimento/${c.id}">${ic('construction')}Registrar atendimento</a>`);
      const back = gestor ? ['Fila de triagem', '#/fila'] : responsavel ? ['Demandas', '#/demandas'] : ['Fila de triagem', '#/fila'];
      return `${Shared.backLink(back[1], back[0])}
        ${Shared.ticketHead(c)}
        ${Shared.trailPanel(c)}
        ${Shared.mobileBar(acts.join(''))}
        <div class="grid-main">
          <div class="stack">${Shared.descPanel(c)}${Shared.evidPanel(c)}${Shared.historyPanel(c, { internal: true, form: true })}</div>
          <aside class="stack">
            ${acts.length ? `<section class="panel panel-pad actionlist">${acts.join('')}</section>` : ''}
            ${sideDetails(c, `<div><dt>Prioridade</dt><dd>${prio(c.prioridade)}</dd></div>`)}
            <section class="aside-note">${ic('shield')} O histórico registra autor, data e hora de cada alteração e não pode ser editado nem apagado pela interface.</section>
          </aside>
        </div>`;
    },
    mount(root, id) { Shared.bindCommon(root, DB.chamado(id), () => App.render()); }
  };

  /* =========================================================
     T11 — Demandas de atendimento
     ========================================================= */
  const DGRUPOS = {
    iniciar: { label: 'A iniciar', test: c => c.estado === 'atribuido' || c.estado === 'reencaminhado' },
    andamento: { label: 'Em atendimento', test: c => c.estado === 'atendimento' },
    resolvidos: { label: 'Resolvidos', test: c => c.estado === 'resolvido' },
    todas: { label: 'Todas', test: () => true }
  };
  let demF = { g: 'iniciar', prio: '' };
  let demCarregada = false;
  Screens.demandas = {
    title: 'Demandas',
    render() {
      const u = me();
      const all = Shared.minhasDemandas(u);
      return `<div class="pagehead"><div><h1 class="h1">Demandas de atendimento</h1>
        <p class="lede">Chamados atribuídos a você ou à equipe de ${esc(u.setor.toLowerCase())}.</p></div></div>
      <section class="panel">
        <div class="toolbar">
          <div class="field" style="flex:0 1 auto"><span class="label" style="font-size:12.5px;color:var(--ink-2)" id="dg">Situação</span>
            <div class="segmented" role="group" aria-labelledby="dg">${Object.entries(DGRUPOS).map(([k, g]) => `<button type="button" data-g="${k}" aria-pressed="${demF.g === k}">${g.label}<span class="n">${all.filter(g.test).length}</span></button>`).join('')}</div></div>
          <span class="spacer"></span>
          <div class="field" style="flex:0 1 180px"><label for="d-prio">Prioridade</label><select class="select" id="d-prio"><option value="">Todas</option>${ORD.map(p => `<option value="${p}" ${demF.prio === p ? 'selected' : ''}>${PRIORIDADES[p].label}</option>`).join('')}</select></div>
        </div>
        <div data-list></div>
      </section>`;
    },
    mount(root) {
      const u = me();
      const host = $(root, '[data-list]');
      const draw = () => {
        const all = Shared.minhasDemandas(u);
        const res = all.filter(DGRUPOS[demF.g].test).filter(c => !demF.prio || c.prioridade === demF.prio)
          .sort((a, b) => ORD.indexOf(a.prioridade) - ORD.indexOf(b.prioridade) || a.criadoEm.localeCompare(b.criadoEm));
        if (!all.length) { host.innerHTML = empty('task_alt', 'Nenhuma demanda atribuída', 'Quando a gestão atribuir um chamado a você ou à sua equipe, ele aparece aqui.'); return; }
        host.innerHTML = res.length ? `<ul class="tlist">${res.map(c => {
          const at = c.historico.slice().reverse().find(h => /^Atribuído|Reencaminhado/.test(h.texto));
          return ticketRow(c, `#/atendimento/${c.id}`, { secondary: `${prio(c.prioridade)}${at ? `<small>atribuído ${fmt.dataCurta(at.em)}</small>` : ''}` });
        }).join('')}</ul><div class="listfoot">${res.length} de ${all.length} demandas</div>`
          : empty('filter_alt_off', 'Nada nesta situação', 'Escolha outra situação ou prioridade.');
      };
      if (!demCarregada) { demCarregada = true; this._c = Shared.withLoading(root, '[data-list]', draw); } else draw();
      root.addEventListener('click', e => {
        const g = e.target.closest('[data-g]');
        if (g) { demF.g = g.dataset.g; $$(root, '[data-g]').forEach(b => b.setAttribute('aria-pressed', b === g)); draw(); }
      });
      $(root, '#d-prio').addEventListener('change', e => { demF.prio = e.target.value; draw(); });
    },
    unmount() { this._c && this._c(); }
  };

  /* =========================================================
     T12 — Atendimento e atualização
     ========================================================= */
  Screens.atendimento = {
    title: id => 'Atendimento ' + id,
    render(id) {
      const c = DB.chamado(id);
      if (!c) return null;
      const u = me();
      const responsavel = c.executor === u.id || (c.equipe && c.equipe === u.setor) || DB.can('gestor');
      let acts = '';
      if (!responsavel) {
        acts = `<section class="aside-note">${ic('lock')} Este chamado está com outra equipe. Você pode consultar, mas não registrar atendimento.</section>`;
      } else if (['atribuido', 'reencaminhado'].includes(c.estado)) {
        acts = `<section class="panel panel-pad stack-sm"><h2 class="h3">Próximo passo</h2>
          <p class="small muted">Inicie quando a equipe começar a trabalhar no local. O solicitante deixa de poder cancelar.</p>
          <button class="btn btn-primary btn-block" type="button" data-act="iniciar">${ic('play_arrow')}Iniciar atendimento</button>
          <button class="btn btn-secondary btn-block" type="button" data-act="reencaminhar">${ic('alt_route')}Reencaminhar</button></section>`;
      } else if (c.estado === 'atendimento') {
        acts = `<section class="panel panel-pad stack-sm"><h2 class="h3">Próximo passo</h2>
          <p class="small muted">Marque como resolvido quando o problema estiver corrigido. O solicitante confirma a conclusão.</p>
          <button class="btn btn-primary btn-block" type="button" data-act="resolver">${ic('task_alt')}Marcar como resolvido</button>
          <button class="btn btn-secondary btn-block" type="button" data-act="reencaminhar">${ic('alt_route')}Reencaminhar</button></section>`;
      } else {
        acts = `<section class="aside-note">${ic(ESTADOS[c.estado].icon)} Chamado ${ESTADOS[c.estado].label.toLowerCase()}. Não há ações de atendimento pendentes.</section>`;
      }
      const canEdit = responsavel && ['atribuido', 'reencaminhado', 'atendimento'].includes(c.estado);
      const prox = !responsavel ? '' : ['atribuido', 'reencaminhado'].includes(c.estado)
        ? `<button class="btn btn-secondary" type="button" data-act="reencaminhar">${ic('alt_route')}Reencaminhar</button><button class="btn btn-primary" type="button" data-act="iniciar">${ic('play_arrow')}Iniciar atendimento</button>`
        : c.estado === 'atendimento'
          ? `<button class="btn btn-secondary" type="button" data-act="reencaminhar">${ic('alt_route')}Reencaminhar</button><button class="btn btn-primary" type="button" data-act="resolver">${ic('task_alt')}Marcar como resolvido</button>` : '';
      return `${DB.can('executor') ? Shared.backLink('#/demandas', 'Demandas') : Shared.backLink('#/fila', 'Fila de triagem')}
        ${Shared.ticketHead(c)}
        ${Shared.trailPanel(c)}
        ${Shared.mobileBar(prox)}
        <div class="grid-main">
          <div class="stack">${Shared.descPanel(c)}${Shared.evidPanel(c, { canAdd: canEdit })}${Shared.historyPanel(c, { internal: true, form: responsavel })}</div>
          <aside class="stack">${acts}${sideDetails(c, `<div><dt>Prioridade</dt><dd>${prio(c.prioridade)}</dd></div>`)}</aside>
        </div>`;
    },
    mount(root, id) {
      const c = DB.chamado(id);
      const rerender = () => App.render();
      Shared.bindCommon(root, c, rerender);
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        const reject = msg => { toast(msg, 'err'); rerender(); };
        if (act === 'iniciar') {
          if (!['atribuido', 'reencaminhado'].includes(c.estado)) return reject('Não é possível iniciar: o chamado mudou de situação.');
          c.estado = 'atendimento';
          if (!c.executor) c.executor = me().id;
          c.historico.push({ em: now(), autor: me().id, tipo: 'estado', texto: 'Atendimento iniciado.', publico: true });
          DB.save(); toast('Atendimento iniciado.'); rerender();
        }
        if (act === 'resolver') {
          const fd = await dialog({
            title: 'Marcar como resolvido?',
            body: `<p>O solicitante será convidado a confirmar a conclusão e avaliar o atendimento.</p>
              <div class="field"><label for="rs">O que foi feito <span class="opt">(opcional, visível ao solicitante)</span></label><textarea class="textarea" id="rs" name="rs" style="min-height:90px" placeholder="Ex.: disjuntor substituído e tomadas testadas."></textarea></div>`,
            confirm: 'Marcar como resolvido'
          });
          if (!fd) return;
          if (c.estado !== 'atendimento') return reject('Só é possível resolver um chamado em atendimento.');
          const rs = fd.get('rs').trim();
          c.estado = 'resolvido';
          c.historico.push({ em: now(), autor: me().id, tipo: 'estado', texto: 'Marcado como resolvido.' + (rs ? ' ' + rs : ''), publico: true });
          DB.save(); toast(`Chamado ${c.id} marcado como resolvido.`); rerender();
        }
        if (act === 'reencaminhar') {
          const opts = SETORES_OP.filter(s => s !== c.equipe);
          const fd = await dialog({
            title: 'Reencaminhar chamado',
            body: `<p>Use quando o problema for de outro setor. A gestão e o novo setor veem a justificativa.</p>
              <div class="field"><label for="st">Setor competente</label><select class="select" id="st" name="setor">${opts.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
              <div class="field"><label for="js">Justificativa</label><textarea class="textarea" id="js" name="just" style="min-height:90px" placeholder="Ex.: a fechadura é mecânica, não eletrônica."></textarea></div>`,
            confirm: 'Reencaminhar',
            validate: (f, form) => { const ta = form.querySelector('#js'); const m = f.get('just').trim().length < 15 ? 'Explique o motivo com pelo menos 15 caracteres.' : ''; fieldError(ta, m); if (m) ta.focus(); return m; }
          });
          if (!fd) return;
          if (!['atribuido', 'reencaminhado', 'atendimento'].includes(c.estado)) return reject('Não é possível reencaminhar: o chamado mudou de situação.');
          const setor = fd.get('setor');
          c.estado = 'reencaminhado'; c.equipe = setor; c.executor = '';
          c.historico.push({ em: now(), autor: me().id, tipo: 'estado', texto: `Reencaminhado para ${setor}: ${fd.get('just').trim()}`, publico: true });
          DB.save(); toast(`Chamado reencaminhado para ${setor}.`);
          location.hash = DB.can('executor') ? '#/demandas' : '#/fila';
        }
      });
    }
  };
})();
