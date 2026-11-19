/* Telas de gestão: T10 relatórios, T13 usuários e permissões, T14 locais e categorias */
(function () {
  'use strict';
  const { esc, ic, fmt, empty, toast, dialog, fieldError, perfilChip } = UI;
  const { ESTADOS, PERFIS, SETORES, TIPOS_AMBIENTE } = DB;
  const me = () => App.me();
  const $ = (root, s) => root.querySelector(s);
  const $$ = (root, s) => [...root.querySelectorAll(s)];
  const nowIso = () => new Date(DB.HOJE.toISOString().slice(0, 11) + new Date().toTimeString().slice(0, 8)).toISOString();

  /* =========================================================
     T10 — Relatórios e histórico
     ========================================================= */
  const ABERTOS = ['triagem', 'atribuido', 'reencaminhado', 'atendimento'];
  const DEF = { de: '2026-08-01', ate: '2026-11-18', cat: '', sit: '', local: '' };
  let relF = { ...DEF };

  function baseRelatorio() {
    const vivos = DB.s.chamados.map(c => {
      const ab = new Date(c.criadoEm);
      const res = c.historico.find(h => /resolvido/i.test(h.texto) && h.tipo === 'estado');
      return { categoria: c.categoria, estado: c.estado, criadoEm: c.criadoEm, ambiente: c.ambiente, resolucaoDias: res ? (new Date(res.em) - ab) / 864e5 : null };
    });
    return DB.historicoRelatorio.concat(vivos);
  }
  function aplicar(f) {
    const de = new Date(f.de + 'T00:00:00'), ate = new Date(f.ate + 'T23:59:59');
    return baseRelatorio().filter(r => {
      const d = new Date(r.criadoEm);
      if (d < de || d > ate) return false;
      if (f.cat && r.categoria !== f.cat) return false;
      if (f.sit === 'abertos' ? !ABERTOS.includes(r.estado) : f.sit && r.estado !== f.sit) return false;
      if (f.local && r.ambiente !== f.local) return false;
      return true;
    });
  }
  const tmr = rs => { const v = rs.filter(r => r.resolucaoDias != null); return v.length ? v.reduce((s, r) => s + r.resolucaoDias, 0) / v.length : null; };
  const isDone = r => r.estado === 'resolvido' || r.estado === 'concluido';
  const dBR = s => s.split('-').reverse().join('/');

  Screens.relatorios = {
    title: 'Relatórios',
    render() {
      const locais = [...new Set(baseRelatorio().map(r => r.ambiente))].map(id => DB.amb(id)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
      return `<div class="pagehead"><div><h1 class="h1">Relatórios e histórico</h1>
        <p class="lede">Volume de chamados e tempo médio de resolução por período, categoria, situação e local.</p></div>
        <div class="actions no-print">
          <button class="btn btn-secondary" type="button" data-export="csv">${ic('download')}Exportar CSV</button>
          <button class="btn btn-secondary" type="button" data-export="pdf">${ic('picture_as_pdf')}Exportar PDF</button>
        </div></div>
      <form class="panel no-print" novalidate data-filters style="margin-bottom:20px">
        <div class="panel-body" style="padding-top:20px">
          <div class="fields-4" style="grid-template-columns:repeat(5,minmax(0,1fr))">
            <div class="field"><label for="de">De</label><input class="input" type="date" id="de" name="de" value="${relF.de}"></div>
            <div class="field"><label for="ate">Até</label><input class="input" type="date" id="ate" name="ate" value="${relF.ate}"></div>
            <div class="field"><label for="cat">Categoria</label><select class="select" id="cat" name="cat"><option value="">Todas</option>${DB.s.categorias.map(c => `<option value="${c.id}" ${relF.cat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
            <div class="field"><label for="sit">Situação</label><select class="select" id="sit" name="sit"><option value="">Todas</option><option value="abertos" ${relF.sit === 'abertos' ? 'selected' : ''}>Em aberto (todas as etapas)</option>${Object.entries(ESTADOS).map(([k, e]) => `<option value="${k}" ${relF.sit === k ? 'selected' : ''}>${e.label}</option>`).join('')}</select></div>
            <div class="field"><label for="local">Sala, laboratório ou setor</label><select class="select" id="local" name="local"><option value="">Todos</option>${locais.map(a => `<option value="${a.id}" ${relF.local === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></div>
          </div>
          <div class="row" style="justify-content:flex-end;margin-top:16px">
            <button class="btn btn-ghost" type="button" data-clear>Limpar filtros</button>
            <button class="btn btn-primary" type="submit">Consultar</button>
          </div>
        </div>
      </form>
      <div data-result></div>`;
    },
    mount(root) {
      const host = $(root, '[data-result]');
      const form = $(root, '[data-filters]');
      const draw = () => {
        const rs = aplicar(relF);
        const cat = relF.cat && DB.cat(relF.cat), loc = relF.local && DB.amb(relF.local);
        const sitL = relF.sit === 'abertos' ? 'em aberto' : relF.sit ? ESTADOS[relF.sit].label.toLowerCase() : 'todas as situações';
        const applied = `<p class="applied">${ic('filter_alt')}<span><b>Filtros aplicados:</b> ${dBR(relF.de)} a ${dBR(relF.ate)}; ${cat ? esc(cat.nome) : 'todas as categorias'}; ${sitL}; ${loc ? esc(loc.nome) : 'todos os locais'}.</span></p>`;
        if (!rs.length) { host.innerHTML = `<section class="panel"><div class="panel-body">${applied}</div>${empty('query_stats', 'Nenhum chamado nesse recorte', 'Amplie o período ou remova algum filtro.', `<button class="btn btn-secondary" type="button" data-clear>Limpar filtros</button>`)}</section>`; return; }
        const done = rs.filter(isDone).length, open = rs.filter(r => ABERTOS.includes(r.estado)).length, t = tmr(rs);
        const porCat = DB.s.categorias.map(c => {
          const x = rs.filter(r => r.categoria === c.id);
          return { c, n: x.length, done: x.filter(isDone).length, open: x.filter(r => ABERTOS.includes(r.estado)).length, tmr: tmr(x) };
        }).filter(x => x.n).sort((a, b) => b.n - a.n);
        const max = Math.max(...porCat.map(x => x.n));
        const nice = Math.ceil(max / 10) * 10 || 10;
        const ticks = [0, nice / 2, nice];
        host.innerHTML = `
          <div class="panel" style="padding:14px 20px;margin-bottom:20px">${applied}</div>
          <section class="panel kpis" aria-label="Resumo">
            <div class="kpi"><div class="k">Chamados abertos no período</div><div class="v">${fmt.num(rs.length)}</div><div class="s">${dBR(relF.de)} a ${dBR(relF.ate)}</div></div>
            <div class="kpi"><div class="k">Resolvidos ou concluídos</div><div class="v">${fmt.num(done)}</div><div class="s">${fmt.dec(done / rs.length * 100)}% dos abertos</div></div>
            <div class="kpi"><div class="k">Ainda em aberto</div><div class="v">${fmt.num(open)}</div><div class="s">Triagem, atribuídos e em atendimento</div></div>
            <div class="kpi"><div class="k">Tempo médio de resolução*</div><div class="v">${t == null ? '—' : fmt.dec(t)}<small>${t == null ? '' : t < 2 && t >= 1 ? 'dia' : 'dias'}</small></div><div class="s">Da abertura à resolução</div></div>
          </section>
          <div class="grid-main" style="margin-top:20px;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)">
            <section class="panel">
              <div class="panel-head"><h2 class="h2">Chamados por categoria</h2></div>
              <div class="panel-body">
                <div class="bars" role="list">${porCat.map(x => `<div class="bar" role="listitem" tabindex="0" style="--w:${x.n / nice * 100}%" aria-label="${esc(x.c.nome)}: ${x.n} chamados">
                  <span class="nm">${esc(x.c.nome)}</span><span class="tr"><span class="fl" style="display:block"></span></span><span class="vl">${x.n}</span>
                  <span class="tip">${x.n} chamados, ${fmt.dec(x.n / rs.length * 100)}% do total</span></div>`).join('')}</div>
                <div class="bars-axis" aria-hidden="true" style="margin-top:10px"><span></span><span class="ticks">${ticks.map(t => `<span>${t}</span>`).join('')}</span><span></span></div>
              </div>
            </section>
            <section class="panel">
              <div class="panel-head"><h2 class="h2">Resultados por categoria</h2></div>
              <div class="tablewrap"><table class="table stack-mobile">
                <thead><tr><th>Categoria</th><th class="r">Abertos</th><th class="r">Resolvidos</th><th class="r">Em aberto</th><th class="r">TMR*</th></tr></thead>
                <tbody>${porCat.map(x => `<tr><td>${esc(x.c.nome)}</td><td class="r num" data-l="Abertos">${x.n}</td><td class="r num" data-l="Resolvidos">${x.done}</td><td class="r num" data-l="Em aberto">${x.open}</td><td class="r num" data-l="TMR">${x.tmr == null ? '—' : fmt.dec(x.tmr) + (x.tmr >= 1 && x.tmr < 2 ? ' dia' : ' dias')}</td></tr>`).join('')}</tbody>
              </table></div>
            </section>
          </div>
          <p class="footnote">* Tempo médio de resolução: média, em dias corridos, entre a abertura e a marcação como resolvido, só entre chamados resolvidos ou concluídos. Fórmula provisória, a confirmar com o backend.</p>`;
        host._rows = porCat; host._rs = rs;
      };
      draw();
      const validate = () => {
        const de = $(root, '#de'), ate = $(root, '#ate');
        let m = '';
        if (!de.value || !ate.value) m = 'Informe as duas datas do período.';
        else if (de.value > ate.value) m = 'A data inicial precisa ser anterior à final.';
        fieldError(ate, m); fieldError(de, '');
        if (m) ate.focus();
        return !m;
      };
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (!validate()) return;
        relF = Object.fromEntries(new FormData(form));
        host.innerHTML = `<section class="panel">${UI.skeletonRows(3)}</section>`;
        setTimeout(draw, 350);
      });
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-clear]')) {
          relF = { ...DEF };
          form.de.value = DEF.de; form.ate.value = DEF.ate; form.cat.value = ''; form.sit.value = ''; form.local.value = '';
          fieldError($(root, '#ate'), ''); draw();
        }
        const ex = e.target.closest('[data-export]');
        if (ex) {
          const label = ex.innerHTML;
          ex.disabled = true; ex.innerHTML = `<span class="spin" style="border-color:var(--brand-soft);border-top-color:var(--brand)" aria-hidden="true"></span>Gerando`;
          setTimeout(() => {
            ex.disabled = false; ex.innerHTML = label;
            if (ex.dataset.export === 'pdf') { window.print(); return; }
            const rows = host._rows || [];
            const lines = [
              `Relatório de chamados;UNIFAP`, `Período;${dBR(relF.de)} a ${dBR(relF.ate)}`,
              `Categoria;${relF.cat ? DB.cat(relF.cat).nome : 'Todas'}`, `Situação;${relF.sit ? (ESTADOS[relF.sit]?.label || 'Em aberto') : 'Todas'}`,
              `Local;${relF.local ? DB.amb(relF.local).nome : 'Todos'}`, '',
              'Categoria;Abertos;Resolvidos;Em aberto;TMR (dias)',
              ...rows.map(x => [x.c.nome, x.n, x.done, x.open, x.tmr == null ? '' : fmt.dec(x.tmr)].join(';'))
            ];
            const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = `relatorio-chamados-${relF.de}-a-${relF.ate}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            toast('Relatório exportado em CSV com os filtros aplicados.');
          }, 600);
        }
      });
    }
  };

  /* =========================================================
     T13 — Usuários e permissões
     ========================================================= */
  let usrF = { q: '', perfil: '', vinc: '', acc: '' };
  let usrSel = null;
  Screens.usuarios = {
    title: 'Usuários e permissões',
    render() {
      return `<div class="pagehead"><div><h1 class="h1">Usuários e permissões</h1>
        <p class="lede">Atribua perfis, associe setores e controle o acesso de cada pessoa a este sistema.</p></div>
        <div class="actions"><button class="btn btn-primary" type="button" data-new>${ic('person_add')}Cadastrar usuário</button></div></div>
      <div class="grid-main wide-side">
        <section class="panel">
          <form class="toolbar" data-filters>
            <div class="field grow" style="flex-basis:100%"><label for="uq">Buscar</label><div class="input-icon">${ic('search')}<input class="input" id="uq" name="q" type="search" placeholder="Nome, matrícula ou SIAPE" value="${esc(usrF.q)}"></div></div>
            <div class="field"><label for="up">Perfil</label><select class="select" id="up" name="perfil"><option value="">Todos</option>${Object.entries(PERFIS).map(([k, p]) => `<option value="${k}" ${usrF.perfil === k ? 'selected' : ''}>${esc(p.label.replace(' (consulta)', ''))}</option>`).join('')}</select></div>
            <div class="field"><label for="uv">Vínculo</label><select class="select" id="uv" name="vinc"><option value="">Todos</option><option value="1" ${usrF.vinc === '1' ? 'selected' : ''}>Ativo</option><option value="0" ${usrF.vinc === '0' ? 'selected' : ''}>Inativo</option></select></div>
            <div class="field"><label for="ua">Acesso local</label><select class="select" id="ua" name="acc"><option value="">Todos</option><option value="1" ${usrF.acc === '1' ? 'selected' : ''}>Ativo</option><option value="0" ${usrF.acc === '0' ? 'selected' : ''}>Desativado</option></select></div>
          </form>
          <div data-list></div>
        </section>
        <aside data-edit></aside>
      </div>`;
    },
    mount(root) {
      const list = $(root, '[data-list]'), edit = $(root, '[data-edit]');
      const filtered = () => {
        const q = usrF.q.trim().toLowerCase();
        return DB.s.usuarios.filter(u => (!q || u.nome.toLowerCase().includes(q) || u.login.includes(q)) &&
          (!usrF.perfil || u.perfis.includes(usrF.perfil)) && (!usrF.vinc || String(+u.vinculoAtivo) === usrF.vinc) && (!usrF.acc || String(+u.acessoAtivo) === usrF.acc));
      };
      const drawList = () => {
        const rs = filtered();
        list.innerHTML = rs.length ? rs.map(u => `<button class="urow" type="button" data-u="${u.id}" ${usrSel === u.id ? 'aria-current="true"' : ''}>
            <span class="person"><span class="avatar">${fmt.iniciais(u.nome)}</span><span style="min-width:0"><b>${esc(u.nome)}</b><small>${esc(u.ident)}, ${esc(u.tipo)}</small></span></span>
            <span class="roles">${u.perfis.map(perfilChip).join('')}<small>${esc(u.setor || 'Sem setor')}</small></span>
            <span class="access">
              <span class="dotline ${u.vinculoAtivo ? 'ok' : 'off'}">${ic(u.vinculoAtivo ? 'check_circle' : 'cancel')}Vínculo ${u.vinculoAtivo ? 'ativo' : 'inativo'}</span>
              <span class="dotline ${u.acessoAtivo ? 'ok' : 'mute'}">${ic(u.acessoAtivo ? 'check_circle' : 'do_not_disturb_on')}Acesso ${u.acessoAtivo ? 'ativo' : 'desativado'}</span>
            </span>
            ${ic('chevron_right', 'chev')}
          </button>`).join('') + `<div class="listfoot">Mostrando ${rs.length} de ${DB.s.usuarios.length} usuários</div>`
          : empty('person_search', 'Nenhum usuário encontrado', 'Confira o nome ou o número e os filtros escolhidos.');
      };
      const drawEdit = () => {
        const u = usrSel && DB.user(usrSel);
        if (!u) { edit.innerHTML = `<section class="panel">${empty('touch_app', 'Selecione um usuário', 'Escolha alguém na lista para ver e alterar perfis, setor e acesso.')}</section>`; return; }
        const self = u.id === me().id;
        const audit = DB.s.auditoria.filter(a => a.texto.includes(u.nome)).slice(-1)[0];
        edit.innerHTML = `<form class="panel" novalidate data-editform>
          <div class="panel-head"><div class="row" style="gap:12px"><span class="avatar lg">${fmt.iniciais(u.nome)}</span><div><h2 class="h2">${esc(u.nome)}</h2><span class="small muted">${esc(u.ident)}</span></div></div></div>
          <div class="panel-body stack">
            <div class="aside-note" style="padding:14px 16px">
              <dl class="kv" style="gap:8px">
                <div><dt>Vínculo institucional</dt><dd>${esc(u.tipo)}, <span class="dotline ${u.vinculoAtivo ? 'ok' : 'off'}" style="display:inline-flex">${u.vinculoAtivo ? 'ativo' : 'inativo'}</span></dd></div>
              </dl>
              <p class="small muted" style="margin-top:8px">${ic('sync_lock')} Vem da base institucional e não é alterado aqui.</p>
            </div>
            <fieldset class="fieldset"><legend class="label">Perfis</legend>
              ${Object.entries(PERFIS).map(([k, p]) => {
                const lock = k === 'admin';
                return `<label class="check${lock ? ' disabled' : ''}"><input type="checkbox" name="perfis" value="${k}" ${u.perfis.includes(k) ? 'checked' : ''} ${lock ? 'disabled' : ''}><span><b>${esc(p.label)}</b><span>${lock ? (self ? 'Você não pode alterar o próprio perfil de administrador' : 'Você não pode conceder nem revogar este perfil') : esc(p.desc)}</span></span></label>`;
              }).join('')}
            </fieldset>
            <div class="field"><label for="setor">Setor</label><select class="select" id="setor" name="setor"><option value="">Sem setor</option>${SETORES.map(s => `<option ${u.setor === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><span class="hint">Executores recebem as demandas do setor.</span></div>
            <label class="switch"><input type="checkbox" name="acesso" ${u.acessoAtivo ? 'checked' : ''} ${self ? 'disabled' : ''}><span class="track"></span>
              <span class="txt"><b>Acesso a este sistema</b><span>${self ? 'Você não pode desativar o próprio acesso.' : 'Desativar bloqueia a entrada neste sistema. Não altera o vínculo institucional.'}</span></span></label>
          </div>
          <div class="sticky-actions">
            <button class="btn btn-ghost" type="button" data-discard>Descartar</button>
            <button class="btn btn-primary" type="submit">Salvar alterações</button>
          </div>
          ${audit ? `<div class="panel-foot">${ic('history')}Última alteração: ${esc(DB.user(audit.autor).nome)} em ${fmt.dataHora(audit.em)}.</div>` : ''}
        </form>`;
        const f = $(edit, '[data-editform]');
        $(edit, '[data-discard]').addEventListener('click', () => { drawEdit(); toast('Alterações descartadas.'); });
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const perfis = $$(f, '[name=perfis]:checked').map(i => i.value);
          if (u.perfis.includes('admin') && !perfis.includes('admin')) perfis.push('admin');
          const fs = f.querySelector('fieldset');
          fs.querySelector('.err')?.remove();
          if (!perfis.length) { fs.insertAdjacentHTML('beforeend', `<p class="err">${ic('error')}<span>Selecione pelo menos um perfil.</span></p>`); return; }
          const acesso = f.acesso.checked, setor = f.setor.value;
          if (perfis.includes('executor') && !setor) { fieldError(f.setor, 'Executores precisam de um setor.'); f.setor.focus(); return; }
          fieldError(f.setor, '');
          const mudouPerfis = perfis.slice().sort().join() !== u.perfis.slice().sort().join();
          const mudouAcesso = acesso !== u.acessoAtivo;
          if (!mudouPerfis && !mudouAcesso && setor === u.setor) { toast('Nenhuma alteração para salvar.'); return; }
          if (mudouPerfis || mudouAcesso) {
            const linhas = [];
            if (mudouPerfis) linhas.push(`<li>Perfis: ${perfis.map(p => PERFIS[p].label).join(', ')}</li>`);
            if (mudouAcesso) linhas.push(`<li>Acesso: ${acesso ? 'reativado' : '<b>desativado</b>, a pessoa perde a entrada no sistema imediatamente'}</li>`);
            const ok = await dialog({
              title: `Alterar o acesso de ${esc(u.nome)}?`,
              body: `<ul style="margin:0;padding-left:20px;color:var(--ink-2);display:grid;gap:6px">${linhas.join('')}</ul><p class="small">A alteração fica registrada com seu nome, data e hora.</p>`,
              confirm: 'Salvar alterações', danger: mudouAcesso && !acesso
            });
            if (!ok) return;
          }
          u.perfis = perfis; u.acessoAtivo = acesso; u.setor = setor;
          DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `Acesso de ${u.nome} alterado.` });
          DB.save(); toast(`Alterações de ${u.nome} salvas.`);
          drawList(); drawEdit();
        });
      };
      if (!usrSel) usrSel = 'u3';
      drawList(); drawEdit();
      $(root, '[data-filters]').addEventListener('input', e => { usrF[e.target.name] = e.target.value; drawList(); });
      $(root, '[data-filters]').addEventListener('submit', e => e.preventDefault());
      list.addEventListener('click', e => {
        const b = e.target.closest('[data-u]');
        if (!b) return;
        usrSel = b.dataset.u; drawList(); drawEdit();
        if (window.matchMedia('(max-width: 1080px)').matches) edit.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      $(root, '[data-new]').addEventListener('click', async () => {
        const fd = await dialog({
          title: 'Cadastrar usuário',
          body: `<p>Informe a matrícula ou o SIAPE. Nome e vínculo são confirmados na base institucional.</p>
            <div class="field"><label for="nid">Matrícula ou SIAPE</label><input class="input" id="nid" name="id" inputmode="numeric"></div>
            <div class="field"><label for="nnome">Nome completo</label><input class="input" id="nnome" name="nome"></div>
            <div class="field"><label for="ntipo">Tipo de vínculo</label><select class="select" id="ntipo" name="tipo"><option>Discente</option><option>Docente</option><option>Técnico-administrativo</option></select></div>`,
          confirm: 'Cadastrar',
          validate: (f, form) => {
            const id = f.get('id').replace(/\D/g, ''), nome = f.get('nome').trim();
            const eid = form.querySelector('#nid'), en = form.querySelector('#nnome');
            let m1 = !id ? 'Informe a matrícula ou o SIAPE.' : id.length < 7 ? 'O número precisa ter pelo menos 7 dígitos.' : DB.s.usuarios.some(u => u.login === id) ? 'Já existe um usuário com esse número.' : '';
            let m2 = nome.split(' ').length < 2 ? 'Informe nome e sobrenome.' : '';
            fieldError(eid, m1); fieldError(en, m2);
            if (m1) eid.focus(); else if (m2) en.focus();
            return m1 || m2;
          }
        });
        if (!fd) return;
        const id = fd.get('id').replace(/\D/g, ''), tipo = fd.get('tipo');
        const nu = { id: 'u' + (DB.s.usuarios.length + 1) + Date.now() % 1000, nome: fd.get('nome').trim(), login: id, ident: tipo === 'Discente' ? id : 'SIAPE ' + id, tipo, vinculoAtivo: true, acessoAtivo: true, perfis: ['solicitante'], setor: '' };
        DB.s.usuarios.unshift(nu);
        DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `Usuário ${nu.nome} cadastrado.` });
        DB.save(); usrSel = nu.id; drawList(); drawEdit();
        toast(`${nu.nome} cadastrado como solicitante.`);
      });
    }
  };

  /* =========================================================
     T14 — Locais e categorias
     ========================================================= */
  let catTab = 'locais';
  let msel = { campus: 'mz', bloco: 'mz-b', andar: 'mz-b-2', ambiente: 'mz-b-2-x1' };
  let locF = { q: '', sit: '' };
  const NIVEIS = [
    { k: 'campus', label: 'Campus', list: () => DB.s.campi, parent: null },
    { k: 'bloco', label: 'Blocos', list: () => DB.s.blocos.filter(b => b.campus === msel.campus), parent: 'campus' },
    { k: 'andar', label: 'Andares', list: () => DB.s.andares.filter(a => a.bloco === msel.bloco), parent: 'bloco' },
    { k: 'ambiente', label: 'Ambientes', list: () => DB.s.ambientes.filter(a => a.andar === msel.andar), parent: 'andar' }
  ];
  const coll = { campus: 'campi', bloco: 'blocos', andar: 'andares', ambiente: 'ambientes' };
  const NOME_NIVEL = { campus: 'Campus', bloco: 'Bloco', andar: 'Andar', ambiente: 'Ambiente' };
  const findItem = (k, id) => DB.s[coll[k]].find(x => x.id === id);
  function vinculados(k, id) {
    return DB.s.chamados.filter(c => {
      const p = DB.localPartes(c.ambiente);
      return p && p[k] && p[k].id === id;
    }).length;
  }
  function deepest() { for (const k of ['ambiente', 'andar', 'bloco', 'campus']) if (msel[k]) return k; return null; }

  Screens.catalogo = {
    title: 'Locais e categorias',
    render() {
      const nAtivos = DB.s.categorias.filter(c => c.ativo).length;
      return `<div class="pagehead"><div><h1 class="h1">Locais e categorias</h1>
        <p class="lede">Catálogo usado na abertura, na triagem e nos relatórios. Só itens ativos aparecem para quem abre um chamado.</p></div></div>
      <div class="tabs" role="tablist">
        <button role="tab" type="button" id="tab-locais" aria-selected="${catTab === 'locais'}" aria-controls="tp" data-tab="locais">${ic('location_on')}Locais<span class="n">${DB.s.ambientes.length}</span></button>
        <button role="tab" type="button" id="tab-cats" aria-selected="${catTab === 'cats'}" aria-controls="tp" data-tab="cats">${ic('category')}Categorias<span class="n">${nAtivos} ativas</span></button>
      </div>
      <div id="tp" role="tabpanel" aria-labelledby="tab-${catTab}" data-tp></div>`;
    },
    mount(root) {
      const tp = $(root, '[data-tp]');
      const rer = () => App.render();

      const drawLocais = () => {
        const q = locF.q.trim().toLowerCase();
        const sitOk = x => !locF.sit || (locF.sit === 'a' ? x.ativo : !x.ativo);
        const pass = sitOk;
        // Resultados da busca em todos os campi, blocos e ambientes (não só nas colunas abertas)
        let results = '';
        if (Shared.norm(q).trim().length >= 2) {
          const termos = Shared.norm(q).trim().split(/\s+/);
          const bate = txt => termos.every(t => Shared.norm(txt).includes(t));
          const achados = [
            ...DB.s.campi.filter(c => bate(c.nome + ' ' + c.codigo)).map(c => ({ k: 'campus', it: c, caminho: 'Universidade Federal do Amapá' })),
            ...DB.s.blocos.filter(b => bate(b.nome + ' ' + b.codigo + ' ' + DB.campus(b.campus).nome)).map(b => ({ k: 'bloco', it: b, caminho: DB.campus(b.campus).nome })),
            ...Shared.buscaAmbientes(q, false).map(p => ({ k: 'ambiente', it: p.ambiente, caminho: [p.campus.nome, p.bloco.nome, p.andar.nome].join(' › ') }))
          ].filter(r => sitOk(r.it));
          results = `<section class="panel catresults" aria-live="polite">
            <div class="panel-head"><h2 class="h3">${achados.length ? `${achados.length} ${achados.length === 1 ? 'resultado' : 'resultados'} para “${esc(locF.q.trim())}”` : `Nenhum local encontrado para “${esc(locF.q.trim())}”`}</h2>
              <button class="btn btn-ghost btn-sm" type="button" data-clearq>Limpar busca</button></div>
            ${achados.length ? `<ul>${achados.slice(0, 12).map(r => `<li><button type="button" data-goto="${r.k}" data-id="${r.it.id}">
              <span class="tag sm neutral">${NOME_NIVEL[r.k]}</span><span class="nm"><b>${esc(r.it.nome)}</b><small>${esc(r.caminho)}</small></span>
              ${r.it.ativo ? '' : '<span class="tag sm neutral">Inativo</span>'}${ic('chevron_right')}</button></li>`).join('')}</ul>
              ${achados.length > 12 ? `<p class="listfoot">Mostrando 12 de ${achados.length}. Digite mais para refinar.</p>` : ''}` : `<p class="panel-body small muted">Confira o nome ou o código. A busca considera campus, bloco e ambiente.</p>`}
          </section>`;
        }
        const cols = NIVEIS.map(n => {
          const parentOk = !n.parent || msel[n.parent];
          const items = parentOk ? n.list() : [];
          const vis = items.filter(pass);
          return `<div class="mcol">
            <div class="mcol-head"><span>${n.label}<span class="n">${items.length}</span></span>
              ${parentOk ? `<button class="btn btn-ghost btn-sm" type="button" data-add="${n.k}">${ic('add')}Adicionar</button>` : ''}</div>
            ${!parentOk ? `<p class="mempty">Escolha ${n.k === 'bloco' ? 'um campus' : n.k === 'andar' ? 'um bloco' : 'um andar'}.</p>` :
              vis.length ? `<ul>${vis.map(x => `<li><button class="mitem${x.ativo ? '' : ' inactive'}" type="button" data-pick="${n.k}" data-id="${x.id}" ${msel[n.k] === x.id ? 'aria-current="true"' : ''}>
                <span class="nm">${esc(x.nome)}</span>${x.ativo ? '' : '<span class="tag sm neutral">Inativo</span>'}${n.k !== 'ambiente' ? ic('chevron_right') : ''}</button></li>`).join('')}</ul>`
              : `<p class="mempty">${items.length ? 'Nenhum item com esse filtro.' : 'Nenhum cadastrado.'}</p>`}
          </div>`;
        }).join('');
        const k = deepest();
        const it = k && findItem(k, msel[k]);
        let form = '';
        if (it) {
          const ordem = ['campus', 'bloco', 'andar', 'ambiente'];
          const partes = ordem.slice(0, ordem.indexOf(k)).map(x => findItem(x, msel[x]).nome);
          const n = vinculados(k, it.id);
          form = `<form class="panel" style="margin-top:20px" novalidate data-itemform>
            <div class="panel-head"><div><h2 class="h2">${NOME_NIVEL[k]}: ${esc(it.nome)}</h2>
              <p class="small muted">${esc(partes.join(' › ') || 'Universidade Federal do Amapá')}; ${n} ${n === 1 ? 'chamado vinculado' : 'chamados vinculados'}</p></div>
              ${it.ativo ? '<span class="tag sm success">' + ic('check_circle') + 'Ativo</span>' : '<span class="tag sm neutral">' + ic('do_not_disturb_on') + 'Inativo</span>'}</div>
            <div class="panel-body">
              <div class="fields-4" style="grid-template-columns:repeat(${k === 'ambiente' ? 3 : 2},minmax(0,1fr))">
                <div class="field"><label for="inome">Nome</label><input class="input" id="inome" name="nome" value="${esc(it.nome)}" required></div>
                ${k !== 'andar' ? `<div class="field"><label for="icod">Código</label><input class="input" id="icod" name="codigo" value="${esc(it.codigo || '')}"><span class="hint">Único dentro do ${k === 'campus' ? 'sistema' : 'campus'}.</span></div>` : ''}
                ${k === 'ambiente' ? `<div class="field"><label for="itipo">Tipo de ambiente</label><select class="select" id="itipo" name="tipo">${TIPOS_AMBIENTE.map(t => `<option ${it.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
              </div>
              <div class="banner info" style="margin-top:20px">${ic('info')}<div>Prefira inativar a excluir. Um item inativo deixa de aparecer em novas aberturas, e os chamados antigos mantêm a referência.</div></div>
            </div>
            <div class="sticky-actions">
              <button class="btn ${it.ativo ? 'btn-danger' : 'btn-secondary'}" type="button" data-toggle>${ic(it.ativo ? 'do_not_disturb_on' : 'check_circle')}${it.ativo ? 'Inativar' : 'Reativar'} ${NOME_NIVEL[k].toLowerCase()}</button>
              <span class="spacer"></span>
              <button class="btn btn-primary" type="submit">Salvar alterações</button>
            </div>
          </form>`;
        }
        tp.innerHTML = `<div class="row" style="margin-bottom:16px;align-items:flex-end">
            <div class="field" style="flex:1 1 260px"><label for="lq">Buscar local</label><div class="input-icon">${ic('search')}<input class="input" id="lq" type="search" placeholder="Nome ou código, em qualquer campus" value="${esc(locF.q)}"></div></div>
            <div class="field" style="flex:0 1 220px"><label for="ls">Situação</label><select class="select" id="ls"><option value="">Ativos e inativos</option><option value="a" ${locF.sit === 'a' ? 'selected' : ''}>Somente ativos</option><option value="i" ${locF.sit === 'i' ? 'selected' : ''}>Somente inativos</option></select></div>
          </div>
          ${results}<div class="miller">${cols}</div>${form}`;

        const lq = $(tp, '#lq');
        lq.addEventListener('input', () => { locF.q = lq.value; const pos = lq.selectionStart; drawLocais(); const n = $(tp, '#lq'); n.focus(); n.setSelectionRange(pos, pos); });
        $(tp, '#ls').addEventListener('change', e => { locF.sit = e.target.value; drawLocais(); });
        const f = $(tp, '[data-itemform]');
        if (f) {
          f.addEventListener('submit', e => {
            e.preventDefault();
            const nome = f.nome.value.trim();
            fieldError(f.nome, nome ? '' : 'Informe o nome.');
            if (!nome) return f.nome.focus();
            if (f.codigo) {
              const cod = f.codigo.value.trim();
              const dup = k !== 'campus' && cod && DB.s[coll[k]].some(x => x.id !== it.id && x.codigo === cod && (k === 'ambiente' ? DB.localPartes(x.id).campus.id === msel.campus : k === 'bloco' ? x.campus === msel.campus : true));
              const m = !cod ? 'Informe o código.' : dup ? 'Já existe outro item com esse código neste campus.' : '';
              fieldError(f.codigo, m);
              if (m) return f.codigo.focus();
              it.codigo = cod;
            }
            it.nome = nome;
            if (f.tipo) it.tipo = f.tipo.value;
            DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `${NOME_NIVEL[k]} ${nome} alterado.` });
            DB.save(); toast(`${NOME_NIVEL[k]} ${nome} salvo.`); drawLocais();
          });
          $(f, '[data-toggle]').addEventListener('click', async () => {
            const n = vinculados(k, it.id);
            const ok = await dialog({
              title: `${it.ativo ? 'Inativar' : 'Reativar'} ${esc(it.nome)}?`,
              body: it.ativo
                ? `<p>${esc(it.nome)} deixa de aparecer para quem abre chamados${k !== 'ambiente' ? ', assim como tudo o que está dentro dele' : ''}. ${n ? `Os ${n} chamados vinculados mantêm a referência.` : ''}</p>`
                : `<p>${esc(it.nome)} volta a aparecer nas novas aberturas de chamado.</p>`,
              confirm: it.ativo ? 'Inativar' : 'Reativar', danger: it.ativo
            });
            if (!ok) return;
            it.ativo = !it.ativo;
            DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `${NOME_NIVEL[k]} ${it.nome} ${it.ativo ? 'reativado' : 'inativado'}.` });
            DB.save(); toast(`${NOME_NIVEL[k]} ${it.nome} ${it.ativo ? 'reativado' : 'inativado'}.`); drawLocais();
          });
        }
      };

      const drawCats = () => {
        tp.innerHTML = `<section class="panel">
          <div class="panel-head"><div><h2 class="h2">Categorias</h2><p class="small muted">Cada categoria tem um setor padrão, sugerido na triagem.</p></div>
            <button class="btn btn-primary btn-sm" type="button" data-newcat>${ic('add')}Nova categoria</button></div>
          <div class="tablewrap"><table class="table cattable stack-mobile">
            <thead><tr><th style="width:52px"><span class="sr-only">Ícone</span></th><th>Categoria</th><th>Setor padrão</th><th class="r">Chamados</th><th>Situação</th><th class="r"><span class="sr-only">Ações</span></th></tr></thead>
            <tbody>${DB.s.categorias.map(c => {
              const n = DB.s.chamados.filter(x => x.categoria === c.id).length;
              return `<tr><td><span class="ico">${ic(c.icon)}</span></td>
                <td><b style="font-weight:600">${esc(c.nome)}</b><span class="cellsub">${esc(c.exemplo)}</span></td>
                <td data-l="Setor padrão">${esc(c.setor)}</td>
                <td class="r num" data-l="Chamados">${n}</td>
                <td>${c.ativo ? `<span class="tag sm success">${ic('check_circle')}Ativa</span>` : `<span class="tag sm neutral">${ic('do_not_disturb_on')}Inativa</span>`}</td>
                <td class="r"><div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:nowrap">
                  <button class="btn btn-ghost btn-sm" type="button" data-editcat="${c.id}">Editar</button>
                  <button class="btn ${c.ativo ? 'btn-danger' : 'btn-secondary'} btn-sm" type="button" data-togglecat="${c.id}">${c.ativo ? 'Inativar' : 'Reativar'}</button>
                </div></td></tr>`;
            }).join('')}</tbody></table></div>
        </section>`;
      };

      const draw = () => (catTab === 'locais' ? drawLocais() : drawCats());
      draw();

      const catDialog = async (c) => {
        const fd = await dialog({
          title: c ? `Editar ${esc(c.nome)}` : 'Nova categoria',
          body: `<div class="field"><label for="cn">Nome</label><input class="input" id="cn" name="nome" value="${esc(c ? c.nome : '')}"></div>
            <div class="field"><label for="ce">Exemplos <span class="opt">(ajudam quem abre o chamado)</span></label><input class="input" id="ce" name="exemplo" value="${esc(c ? c.exemplo : '')}"></div>
            <div class="field"><label for="cs">Setor padrão</label><select class="select" id="cs" name="setor">${SETORES.filter(s => s !== 'Reitoria').map(s => `<option ${c && c.setor === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>`,
          confirm: c ? 'Salvar alterações' : 'Criar categoria',
          validate: (f, form) => {
            const nome = f.get('nome').trim(), el = form.querySelector('#cn');
            const m = !nome ? 'Informe o nome.' : DB.s.categorias.some(x => x !== c && x.nome.toLowerCase() === nome.toLowerCase()) ? 'Já existe uma categoria com esse nome.' : '';
            fieldError(el, m); if (m) el.focus(); return m;
          }
        });
        if (!fd) return;
        if (c) { c.nome = fd.get('nome').trim(); c.exemplo = fd.get('exemplo').trim(); c.setor = fd.get('setor'); toast(`Categoria ${c.nome} salva.`); }
        else {
          const nome = fd.get('nome').trim();
          DB.s.categorias.push({ id: 'c' + Date.now(), nome, icon: 'category', setor: fd.get('setor'), ativo: true, exemplo: fd.get('exemplo').trim() });
          toast(`Categoria ${nome} criada.`);
        }
        DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `Categoria ${fd.get('nome').trim()} ${c ? 'alterada' : 'criada'}.` });
        DB.save(); rer();
      };

      root.addEventListener('click', async e => {
        const t = e.target.closest('[data-tab]');
        if (t) { catTab = t.dataset.tab; rer(); return; }
        const go = e.target.closest('[data-goto]');
        if (go) {
          // Abre o caminho completo do item encontrado nas colunas
          const k = go.dataset.goto, id = go.dataset.id;
          if (k === 'campus') Object.assign(msel, { campus: id, bloco: null, andar: null, ambiente: null });
          if (k === 'bloco') { const b = DB.bloco(id); Object.assign(msel, { campus: b.campus, bloco: id, andar: null, ambiente: null }); }
          if (k === 'ambiente') { const p = DB.localPartes(id); Object.assign(msel, { campus: p.campus.id, bloco: p.bloco.id, andar: p.andar.id, ambiente: id }); }
          locF.q = ''; drawLocais();
          $(tp, `[data-pick="${k}"][data-id="${id}"]`)?.focus();
          $(tp, '[data-itemform]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
        if (e.target.closest('[data-clearq]')) { locF.q = ''; drawLocais(); $(tp, '#lq').focus(); return; }
        const pk = e.target.closest('[data-pick]');
        if (pk) {
          const k = pk.dataset.pick, id = pk.dataset.id;
          const order = ['campus', 'bloco', 'andar', 'ambiente'];
          const i = order.indexOf(k);
          msel[k] = id; order.slice(i + 1).forEach(x => { msel[x] = null; });
          drawLocais();
          $(tp, `[data-pick="${k}"][data-id="${id}"]`)?.focus();
          return;
        }
        const add = e.target.closest('[data-add]');
        if (add) {
          const k = add.dataset.add;
          const fd = await dialog({
            title: `Adicionar ${NOME_NIVEL[k].toLowerCase()}`,
            body: `<div class="field"><label for="an">Nome</label><input class="input" id="an" name="nome"></div>
              ${k !== 'andar' ? `<div class="field"><label for="ac">Código</label><input class="input" id="ac" name="codigo"></div>` : ''}
              ${k === 'ambiente' ? `<div class="field"><label for="at">Tipo de ambiente</label><select class="select" id="at" name="tipo">${TIPOS_AMBIENTE.map(t => `<option>${t}</option>`).join('')}</select></div>` : ''}`,
            confirm: 'Adicionar',
            validate: (f, form) => {
              const n = form.querySelector('#an'), c = form.querySelector('#ac');
              const m1 = f.get('nome').trim() ? '' : 'Informe o nome.';
              const m2 = c && !f.get('codigo').trim() ? 'Informe o código.' : '';
              fieldError(n, m1); if (c) fieldError(c, m2);
              if (m1) n.focus(); else if (m2) c.focus();
              return m1 || m2;
            }
          });
          if (!fd) return;
          const id = k + '-' + Date.now();
          const base = { id, nome: fd.get('nome').trim(), ativo: true };
          if (k === 'campus') Object.assign(base, { codigo: fd.get('codigo').trim() });
          if (k === 'bloco') Object.assign(base, { campus: msel.campus, codigo: fd.get('codigo').trim() });
          if (k === 'andar') Object.assign(base, { bloco: msel.bloco });
          if (k === 'ambiente') Object.assign(base, { andar: msel.andar, codigo: fd.get('codigo').trim(), tipo: fd.get('tipo') });
          DB.s[coll[k]].push(base);
          const order = ['campus', 'bloco', 'andar', 'ambiente'];
          msel[k] = id; order.slice(order.indexOf(k) + 1).forEach(x => { msel[x] = null; });
          DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `${NOME_NIVEL[k]} ${base.nome} cadastrado.` });
          DB.save(); toast(`${NOME_NIVEL[k]} ${base.nome} adicionado.`); drawLocais();
          return;
        }
        if (e.target.closest('[data-newcat]')) return catDialog(null);
        const ec = e.target.closest('[data-editcat]');
        if (ec) return catDialog(DB.cat(ec.dataset.editcat));
        const tc = e.target.closest('[data-togglecat]');
        if (tc) {
          const c = DB.cat(tc.dataset.togglecat);
          const ok = await dialog({
            title: `${c.ativo ? 'Inativar' : 'Reativar'} ${esc(c.nome)}?`,
            body: c.ativo ? `<p>A categoria deixa de aparecer em novas aberturas. Chamados antigos continuam com ela.</p>` : `<p>A categoria volta a aparecer em novas aberturas.</p>`,
            confirm: c.ativo ? 'Inativar' : 'Reativar', danger: c.ativo
          });
          if (!ok) return;
          c.ativo = !c.ativo;
          DB.s.auditoria.push({ em: nowIso(), autor: me().id, texto: `Categoria ${c.nome} ${c.ativo ? 'reativada' : 'inativada'}.` });
          DB.save(); toast(`Categoria ${c.nome} ${c.ativo ? 'reativada' : 'inativada'}.`); rer();
        }
      });
    }
  };
})();
