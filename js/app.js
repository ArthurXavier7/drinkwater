'use strict';
/* DrinkWater: lembrar, registrar e acompanhar. Dados guardados em localStorage. */

const KEY = 'drinkwater:v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Estado e persistência ---------- */
const DEFAULTS = {
  onboarded: false,
  user: { name: '', dailyGoal: 2000 },
  settings: { remindersEnabled: false, startTime: '08:00', endTime: '22:00', interval: 60, theme: null },
  waterRecords: [] // { id, date: 'AAAA-MM-DD', time: 'HH:MM', amount }
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
      onboarded: !!s.onboarded,
      user: { ...DEFAULTS.user, ...s.user },
      settings: { ...DEFAULTS.settings, ...s.settings },
      waterRecords: Array.isArray(s.waterRecords) ? s.waterRecords : []
    };
  } catch { return structuredClone(DEFAULTS); }
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('Não foi possível salvar os dados neste navegador.'); }
}

/* ---------- Utilitários ---------- */
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeNow = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtMl = (n) => `${Math.round(n).toLocaleString('pt-BR')} ml`;
const fmtDate = (k) => k.split('-').reverse().join('/');
const fmtShort = (k) => fmtDate(k).slice(0, 5);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const recordsOf = (k) => state.waterRecords.filter((r) => r.date === k).sort((a, b) => a.time.localeCompare(b.time));
const totalOf = (k) => recordsOf(k).reduce((s, r) => s + r.amount, 0);
const pctOf = (total) => Math.round((total / state.user.dailyGoal) * 100);
function lastDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return { key: dateKey(d), label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') };
  });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function confirmDialog(msg) {
  return new Promise((resolve) => {
    const dlg = $('#confirm'); $('#confirm-msg').textContent = msg;
    const done = (v) => { dlg.close(); resolve(v); };
    $('#confirm-yes').onclick = () => done(true);
    $('#confirm-no').onclick = () => done(false);
    dlg.oncancel = () => resolve(false);
    dlg.showModal();
  });
}

/* ---------- Registros ---------- */
const MOTIVATION = [
  'Mais um registro concluído. 💧', 'Bom trabalho! Continue acompanhando sua hidratação.',
  'Você está mantendo sua rotina!', 'Cada registro ajuda você a acompanhar melhor seu dia.'
];
function addWater(amount) {
  amount = Math.round(Number(amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 5000) return false;
  state.waterRecords.push({ id: newId(), date: dateKey(), time: timeNow(), amount });
  save(); renderAll();
  toast(`+${amount} ml registrados! 💧`);
  dropAnimation();
  return true;
}
function dropAnimation() {
  const el = document.createElement('div');
  el.className = 'fly'; el.textContent = '💧'; el.setAttribute('aria-hidden', 'true');
  el.style.left = `${window.innerWidth / 2 - 16}px`; el.style.top = '30%';
  document.body.appendChild(el); setTimeout(() => el.remove(), 900);
}
async function removeRecord(id) {
  if (!(await confirmDialog('Excluir este registro?'))) return;
  state.waterRecords = state.waterRecords.filter((r) => r.id !== id);
  save(); renderAll(); toast('Registro excluído.');
}
async function undoLast() {
  const list = recordsOf(dateKey());
  if (!list.length) return toast('Não há registros hoje para desfazer.');
  const last = list[list.length - 1];
  state.waterRecords = state.waterRecords.filter((r) => r.id !== last.id);
  save(); renderAll(); toast(`Registro de ${last.amount} ml desfeito.`);
}

/* ---------- Renderização ---------- */
function recordsHtml(list) {
  return list.map((r) => `<div class="item"><span>${r.time} — ${fmtMl(r.amount)}</span>
    <button data-del="${r.id}" aria-label="Excluir registro das ${r.time}, ${r.amount} ml">🗑️</button></div>`).join('');
}
const emptyHtml = `<div class="empty"><div class="big-emoji" aria-hidden="true">💧</div><strong>Ainda não há registros hoje.</strong>
  <p class="hint">Registre seu primeiro copo de água para começar a acompanhar seu dia.</p>
  <button class="btn" data-goto="register">Registrar água</button></div>`;

function renderHome() {
  const today = dateKey(), total = totalOf(today), goal = state.user.dailyGoal, pct = pctOf(total);
  const name = state.user.name;
  $('#greeting').textContent = name ? `Olá, ${name}! Cuide da sua hidratação ao longo do dia.` : 'Cuide da sua hidratação ao longo do dia.';
  $('#pct').textContent = `${pct}%`;
  $('#amounts').textContent = `${fmtMl(total)} / ${fmtMl(goal)}`;
  $('#ring-label').setAttribute('aria-label', `Progresso de hoje: ${fmtMl(total)} de ${fmtMl(goal)}, ${pct}% da meta pessoal`);
  $('#ring-fg').style.strokeDashoffset = 326.73 * (1 - Math.min(total / goal, 1));
  const n = recordsOf(today).length;
  $('#motivation').textContent = !n ? 'Registre sua água para acompanhar seu dia.'
    : pct >= 100 ? 'Meta pessoal do dia concluída! Bom trabalho. 💧' : MOTIVATION[n % MOTIVATION.length];
  const list = recordsOf(today);
  $('#today-list').innerHTML = list.length ? recordsHtml(list) : emptyHtml;
  $('#undo-home').hidden = !list.length;
}

function renderHistory() {
  const days = lastDays(7), goal = state.user.dailyGoal;
  const totals = days.map((d) => totalOf(d.key));
  const max = Math.max(goal, ...totals) * 1.1;
  $('#chart').innerHTML = `<div class="plot">${days.map((d, i) => `<div class="bar-col"><div class="bar" style="height:${(totals[i] / max) * 100}%"></div></div>`).join('')}
    <div class="goal-line" style="bottom:${(goal / max) * 100}%"></div></div>
    <div class="labels">${days.map((d, i) => `<div class="lbl"><span class="bar-val">${totals[i]}</span><span class="bar-day">${esc(d.label)}</span></div>`).join('')}</div>`;
  $('#chart').setAttribute('aria-label', 'Últimos 7 dias: ' + days.map((d, i) => `${d.label} ${fmtMl(totals[i])}`).join(', '));

  const week = totals.reduce((a, b) => a + b, 0);
  const allMax = Math.max(0, ...[...new Set(state.waterRecords.map((r) => r.date))].map(totalOf));
  const hit = totals.filter((t) => t >= goal).length;
  $('#stats').innerHTML = [
    ['Média diária (7 dias)', fmtMl(week / 7)], ['Maior consumo registrado', fmtMl(allMax)],
    ['Meta pessoal atingida', `${hit} de 7 dias`], ['Total da semana', fmtMl(week)]
  ].map(([l, v]) => `<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join('');

  const pick = $('#date-pick'); if (!pick.value) pick.value = dateKey();
  renderDay();
  const keys = [...new Set(state.waterRecords.map((r) => r.date))].sort().reverse().slice(0, 30);
  const label = (k) => k === dateKey() ? 'Hoje' : k === lastDays(2)[0].key ? 'Ontem' : fmtShort(k);
  $('#days-list').innerHTML = keys.length ? keys.map((k) => `<div class="item clickable" data-day="${k}" tabindex="0" role="button">
    <span><strong>${label(k)}</strong> · ${recordsOf(k).length} registro(s)</span><span>${fmtMl(totalOf(k))} · ${pctOf(totalOf(k))}%</span></div>`).join('')
    : '<p class="hint">Seus dias anteriores aparecerão aqui.</p>';
}
function renderDay() {
  const k = $('#date-pick').value || dateKey(), list = recordsOf(k);
  $('#day-detail').innerHTML = `<p><strong>${fmtDate(k)}</strong><br>Total: ${fmtMl(totalOf(k))} (${pctOf(totalOf(k))}% da meta pessoal)</p>`
    + (list.length ? recordsHtml(list) : '<p class="hint">Nenhum registro nesta data.</p>');
}

function renderSettings() {
  const { user, settings } = state;
  $('#set-name').value = user.name; $('#set-goal').value = user.dailyGoal;
  $('#set-remind').checked = settings.remindersEnabled;
  $('#set-start').value = settings.startTime; $('#set-end').value = settings.endTime; $('#set-interval').value = settings.interval;
  $$('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === currentTheme())));
  notifStatus();
}
function renderAll() {
  renderHome(); renderHistory();
  $('#reg-total').textContent = fmtMl(totalOf(dateKey()));
}

/* ---------- Navegação ---------- */
function show(view) {
  $$('.view').forEach((v) => (v.hidden = v.id !== `view-${view}`));
  $$('.nav [data-view]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.view === view));
  $$('.nav [data-view]').forEach((b) => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); });
  if (view === 'settings') renderSettings();
  if (view === 'history') renderHistory();
  window.scrollTo(0, 0);
}

/* ---------- Tema ---------- */
const currentTheme = () => state.settings.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme() {
  const t = currentTheme();
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === 'dark' ? '#07131f' : '#1e88e5';
}

/* ---------- Lembretes e notificações ---------- */
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function reminderSlots() {
  const { startTime, endTime, interval } = state.settings, out = [];
  if (!startTime || !endTime || interval < 1) return out;
  for (let m = toMin(startTime); m <= toMin(endTime); m += interval) out.push(m);
  return out;
}
const REMINDER_TEXTS = ['💧 Hora de beber água!', 'Que tal fazer uma pausa e beber um pouco de água?', 'Lembrete: registre sua água quando beber. 💧'];
async function notify(text) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const opts = { body: 'Toque para abrir o DrinkWater e registrar.', icon: 'icons/icon-192.png', tag: 'drinkwater' };
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) return reg.showNotification(text, opts);
    } catch { /* usa o fallback abaixo */ }
    try { new Notification(text, opts); return; } catch { /* sem suporte */ }
  }
  toast(text); // fallback dentro do app
}
async function askPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}
function notifStatus() {
  const el = $('#notif-status');
  if (!('Notification' in window)) el.textContent = 'Este navegador não oferece notificações. Os lembretes aparecerão como avisos dentro do app.';
  else if (Notification.permission === 'denied') el.textContent = 'As notificações estão bloqueadas neste navegador. Você pode liberá-las nas configurações do site.';
  else if (!state.settings.remindersEnabled) el.textContent = 'Lembretes desativados.';
  else el.textContent = 'Os lembretes são exibidos enquanto o app estiver aberto ou em segundo plano. Dependendo do navegador e do dispositivo, podem não chegar com o app totalmente fechado.';
}
let lastFired = '';
function reminderTick() {
  if (!state.settings.remindersEnabled) return;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), id = `${dateKey(now)}-${nowMin}`;
  if (id !== lastFired && reminderSlots().includes(nowMin)) {
    lastFired = id; notify(REMINDER_TEXTS[Math.floor(Math.random() * REMINDER_TEXTS.length)]);
  }
}

/* ---------- Exportação e exclusão ---------- */
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  if (!state.waterRecords.length) return toast('Ainda não há registros para exportar.');
  const rows = [...state.waterRecords].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((r) => `${fmtDate(r.date)},${r.time},${r.amount}`);
  download('drinkwater-registros.csv', '\uFEFF' + ['Data,Horário,Quantidade (ml)', ...rows].join('\n'), 'text/csv;charset=utf-8');
}
function exportJson() {
  download('drinkwater-dados.json', JSON.stringify({ user: state.user, settings: state.settings, waterRecords: state.waterRecords }, null, 2), 'application/json');
}
async function wipeAll() {
  if (!(await confirmDialog('Tem certeza que deseja apagar todos os seus registros? Essa ação não poderá ser desfeita.'))) return;
  localStorage.removeItem(KEY); state = load(); applyTheme(); renderAll(); renderSettings(); startOnboarding();
}

/* ---------- Primeiro acesso ---------- */
let step = 0;
function showStep(n) {
  step = n;
  $$('#onboarding [data-step]').forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
  $('#ob-back').hidden = n === 0 || n === 4;
  $('#ob-next').textContent = n === 0 ? 'Continuar' : n === 4 ? 'Começar' : n === 3 ? 'Pular' : 'Continuar';
  $('#ob-next').hidden = false;
  $('#onboarding [data-step]:not([hidden]) input')?.focus();
}
function startOnboarding() { $('#onboarding').hidden = false; showStep(0); }
function nextStep() {
  if (step === 1) state.user.name = $('#ob-name').value.trim();
  if (step === 2) {
    const g = Number($('#ob-goal').value);
    if (!(g >= 500 && g <= 10000)) return toast('Informe uma meta entre 500 e 10.000 ml.');
    state.user.dailyGoal = Math.round(g);
  }
  if (step === 4) { state.onboarded = true; save(); $('#onboarding').hidden = true; renderAll(); show('home'); return; }
  showStep(step + 1);
}

/* ---------- Instalação (PWA) ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#install').hidden = false; });
window.addEventListener('appinstalled', () => { $('#install').hidden = true; toast('DrinkWater instalado! 💧'); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

/* ---------- Eventos ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, [data-day]'); if (!t) return;
  if (t.dataset.view) show(t.dataset.view);
  else if (t.dataset.goto) show(t.dataset.goto);
  else if (t.dataset.add) addWater(t.dataset.add);
  else if (t.dataset.del) removeRecord(t.dataset.del);
  else if (t.dataset.day) { $('#date-pick').value = t.dataset.day; renderDay(); $('#date-pick').scrollIntoView({ block: 'center' }); }
  else if (t.dataset.theme) { state.settings.theme = t.dataset.theme; save(); applyTheme(); renderSettings(); }
  else if (t.dataset.remind) {
    const yes = t.dataset.remind === 'yes';
    state.settings.remindersEnabled = yes; $('#ob-remind-msg').textContent = '';
    if (yes) {
      const p = await askPermission();
      if (p === 'granted') $('#ob-remind-msg').textContent = 'Lembretes ativados! 💧';
      else $('#ob-remind-msg').textContent = 'Sem permissão de notificação, os lembretes aparecerão apenas dentro do app. Você pode mudar isso depois em Configurações.';
    } else $('#ob-remind-msg').textContent = 'Tudo bem, você pode ativar depois em Configurações.';
    save(); showStep(4);
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-day]')) { e.preventDefault(); e.target.click(); }
});
$('#ob-next').onclick = nextStep;
$('#ob-back').onclick = () => showStep(Math.max(0, step - 1));
$('#undo-home').onclick = undoLast;
$('#undo-reg').onclick = undoLast;
$('#add-custom').onclick = () => {
  const v = $('#custom-amount').value, err = $('#custom-error');
  if (addWater(v)) { err.textContent = ''; $('#custom-amount').value = ''; }
  else err.textContent = 'Informe uma quantidade entre 1 e 5.000 ml.';
};
$('#custom-amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#add-custom').click(); });
$('#date-pick').onchange = renderDay;
$('#set-name').onchange = (e) => { state.user.name = e.target.value.trim(); save(); renderHome(); toast('Nome salvo.'); };
$('#set-goal').onchange = (e) => {
  const g = Number(e.target.value);
  if (!(g >= 500 && g <= 10000)) { e.target.value = state.user.dailyGoal; return toast('Informe uma meta entre 500 e 10.000 ml.'); }
  state.user.dailyGoal = Math.round(g); save(); renderAll(); toast('Meta pessoal salva.');
};
$('#set-remind').onchange = async (e) => {
  state.settings.remindersEnabled = e.target.checked; save();
  if (e.target.checked) await askPermission();
  notifStatus();
};
[['#set-start', 'startTime'], ['#set-end', 'endTime']].forEach(([sel, k]) => {
  $(sel).onchange = (e) => { if (e.target.value) { state.settings[k] = e.target.value; save(); toast('Horário salvo.'); } };
});
$('#set-interval').onchange = (e) => {
  const v = Math.round(Number(e.target.value));
  if (!(v >= 15 && v <= 480)) { e.target.value = state.settings.interval; return toast('Use um intervalo entre 15 e 480 minutos.'); }
  state.settings.interval = v; save(); toast('Intervalo salvo.');
};
$('#test-notif').onclick = async () => { await askPermission(); notifStatus(); notify('💧 Hora de beber água!'); };
$('#export-csv').onclick = exportCsv;
$('#export-json').onclick = exportJson;
$('#wipe').onclick = wipeAll;
$('#install').onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#install').hidden = true;
};

/* ---------- Inicialização ---------- */
applyTheme();
renderAll();
$('#install-info').textContent = isStandalone() ? 'O DrinkWater já está instalado neste dispositivo.'
  : 'Para instalar: use "Instalar aplicativo" quando disponível, ou o menu do navegador (no iPhone: Compartilhar > Adicionar à Tela de Início).';
if (!state.onboarded) startOnboarding();
setInterval(reminderTick, 20000);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
