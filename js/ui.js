/* Utilitários de interface: formatação, componentes em string, avisos e diálogos. */
(function () {
  'use strict';
  const { ESTADOS, PRIORIDADES, TRILHA, PERFIS } = DB;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name, cls) => `<span class="ms${cls ? ' ' + cls : ''}" aria-hidden="true">${name}</span>`;

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const pad = n => String(n).padStart(2, '0');
  const fmt = {
    data: iso => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; },
    dataCurta: iso => { const d = new Date(iso); return `${d.getDate()} ${MESES[d.getMonth()]}`; },
    hora: iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    dataHora: iso => `${fmt.data(iso)} às ${fmt.hora(iso)}`,
    relativo(iso) {
      const dias = Math.floor((DB.HOJE - new Date(iso)) / 864e5);
      if (dias <= 0) return 'hoje';
      if (dias === 1) return 'ontem';
      if (dias < 30) return `há ${dias} dias`;
      return fmt.data(iso);
    },
    num: n => n.toLocaleString('pt-BR'),
    dec: (n, c = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }),
    iniciais: nome => nome.split(' ').filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase()
  };

  function tag(estado, sm) {
    const e = ESTADOS[estado];
    return `<span class="tag ${e.tone}${sm ? ' sm' : ''}">${ic(e.icon)}${e.label}</span>`;
  }
  function prio(p) {
    const x = PRIORIDADES[p];
    return `<span class="prio ${x.tone}">${ic(x.icon)}${x.label}<span class="sr-only"> prioridade</span></span>`;
  }
  function perfilChip(p) { return `<span class="chip${p === 'admin' || p === 'gestor' ? ' brand' : ''}">${esc(PERFIS[p].label.replace(' (consulta)', ''))}</span>`; }

  /* Trilha: estado → posições */
  function trailPos(c) {
    if (c.estado === 'cancelado') {
      // em que passo estava quando foi cancelado (aguardando triagem ou atribuído)
      const foiAtribuido = c.historico.some(h => /Atribuído/.test(h.texto));
      return { step: foiAtribuido ? 1 : 0, cls: 'cancel' };
    }
    const e = ESTADOS[c.estado];
    return { step: e.step, cls: c.estado === 'concluido' || c.estado === 'resolvido' ? 'done' : c.estado === 'reencaminhado' ? 'redirect' : '' };
  }
  function mtrail(c) {
    const { step, cls } = trailPos(c);
    const segs = TRILHA.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
    return `<span class="mtrail ${cls}" aria-hidden="true">${segs}</span>`;
  }
  function trail(c) {
    const { step, cls } = trailPos(c);
    const quando = {};
    c.historico.forEach(h => {
      if (/aberto/i.test(h.texto) && !quando.triagem) quando.triagem = h.em;
      if (/^Atribuído/.test(h.texto) && !quando.atribuido) quando.atribuido = h.em;
      if (/Reencaminhado/.test(h.texto)) quando.atribuido = h.em;
      if (/Atendimento iniciado/.test(h.texto)) quando.atendimento = h.em;
      if (/resolvido/i.test(h.texto) && h.tipo === 'estado') quando.resolvido = h.em;
      if (/Cancelado/.test(h.texto)) quando.cancelado = h.em;
      if (h.tipo === 'avaliacao' || /Ciência|Concluído/.test(h.texto)) quando.concluido = h.em;
    });
    const fill = step <= 0 ? 0 : (step / (TRILHA.length - 1)) * 80;
    const items = TRILHA.map((k, i) => {
      let state = i < step ? 'past' : i === step ? 'now' : '';
      let label = ESTADOS[k].label, icon = i < step ? 'check' : ESTADOS[k].icon, when = quando[k];
      let extra = '';
      if (i === step && c.estado === 'reencaminhado') { extra = ' redirect'; label = 'Reencaminhado'; icon = 'alt_route'; }
      if (i === step && cls === 'cancel') { extra = ' cancelled'; label = 'Cancelado'; icon = 'close'; when = quando.cancelado; }
      if (cls === 'cancel' && i > step) { state = ''; }
      if (i === step && (c.estado === 'concluido')) icon = 'verified';
      return `<li class="${state}${extra}" ${i === step ? 'aria-current="step"' : ''}>
        <span class="node">${ic(icon)}</span>
        <span class="lbl">${label}${when ? `<span class="when">${fmt.dataCurta(when)}, ${fmt.hora(when)}</span>` : ''}</span>
      </li>`;
    }).join('');
    return `<div class="trail ${cls}" role="group" aria-label="Andamento do chamado: ${esc(ESTADOS[c.estado].label)}">
      <ol style="--fill:${fill}%"><span class="fillbar" style="width:${fill}%"></span>${items}</ol>
    </div>`;
  }

  /* Linha de chamado (listas T05 e T11) */
  function ticketRow(c, href, opts = {}) {
    const cat = DB.cat(c.categoria);
    const p = DB.localPartes(c.ambiente);
    return `<li><a class="trow" href="${href}">
      <span class="pid protocolo">${esc(c.id)}<small>${fmt.relativo(c.criadoEm)}</small></span>
      <span class="what"><b>${ic(cat.icon)}${esc(cat.nome)}</b><p>${esc(c.descricao)}</p></span>
      <span class="where">${esc(p.ambiente.nome)}<small>${esc(p.bloco.nome)}, ${esc(p.andar.nome)}</small></span>
      <span class="when">${opts.secondary || prio(c.prioridade)}</span>
      <span class="state">${tag(c.estado, true)}${mtrail(c)}</span>
    </a></li>`;
  }

  function empty(icon, title, text, action) {
    return `<div class="empty"><span class="ico">${ic(icon)}</span><b>${title}</b>${text ? `<p>${text}</p>` : ''}${action || ''}</div>`;
  }
  function skeletonRows(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<div class="skelrow" aria-hidden="true"><span class="skel" style="width:70%"></span><span class="skel" style="width:${60 + (i * 7) % 30}%"></span><span class="skel" style="width:80%"></span><span class="skel" style="width:60%"></span></div>`;
    return `<div role="status" aria-label="Carregando">${s}</div>`;
  }

  /* Avisos */
  function toast(msg, kind) {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.innerHTML = ic(kind === 'err' ? 'error' : 'check_circle', 'fill') + `<span>${esc(msg)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  /* Diálogo: devolve uma Promise com o FormData (ou null se cancelado) */
  function dialog({ title, body, confirm = 'Confirmar', cancel = 'Voltar', danger = false, validate }) {
    const dlg = document.getElementById('dialog');
    dlg.innerHTML = `<form method="dialog" novalidate>
      <div class="dlg-body"><h2 class="h2" id="dialog-title">${title}</h2>${body || ''}</div>
      <div class="dlg-foot">
        ${cancel ? `<button class="btn btn-ghost" value="cancel" type="button" data-x>${cancel}</button>` : ''}
        ${confirm ? `<button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" value="ok" type="submit">${confirm}</button>` : ''}
      </div></form>`;
    return new Promise(resolve => {
      const form = dlg.querySelector('form');
      const close = v => { dlg.close(); resolve(v); };
      dlg.querySelector('[data-x]')?.addEventListener('click', () => close(null));
      dlg.addEventListener('cancel', e => { e.preventDefault(); close(null); }, { once: true });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(form);
        if (validate) {
          const msg = validate(fd, form);
          if (msg) return;
        }
        close(fd);
      });
      dlg.showModal();
      const first = dlg.querySelector('textarea, input, select');
      (first || dlg.querySelector('[type=submit]'))?.focus();
    });
  }

  function fieldError(el, msg) {
    const wrap = el.closest('.field') || el.parentElement;
    wrap.querySelector('.err')?.remove();
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      const id = (el.id || el.name || 'f') + '-err';
      const p = document.createElement('p');
      p.className = 'err'; p.id = id; p.innerHTML = ic('error') + `<span>${esc(msg)}</span>`;
      wrap.appendChild(p);
      el.setAttribute('aria-describedby', id);
    } else {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
  }

  window.UI = { esc, ic, fmt, tag, prio, perfilChip, trail, mtrail, ticketRow, empty, skeletonRows, toast, dialog, fieldError };
})();
