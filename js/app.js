const API_BASE = 'https://dragonball-api.com/api/characters';
const PLANET_API = 'https://dragonball-api.com/api/planets';
const PAGE_NAMES = ['inicio', 'personajes', 'planetas', 'galeria', 'laboratorio', 'guia'];
const $ = (selector) => document.querySelector(selector);

function getSavedCharacterViewMode() {
  try {
    return localStorage.getItem('dragonball-character-view') === 'tenkaichi' ? 'tenkaichi' : 'catalog';
  } catch {
    return 'catalog';
  }
}

const state = {
  activeView: 'inicio',
  resource: 'characters',
  method: 'async',
  page: 1,
  limit: 12,
  name: '',
  race: '',
  affiliation: '',
  detailId: null,
  characterViewMode: getSavedCharacterViewMode(),
  selectedCharacterId: null,
  focusCharacterDetail: false,
  planetPage: 1,
  planetLimit: 12,
  planetName: '',
  planetDestroyed: '',
  planetDetailId: null,
  planetListPayload: null,
  planetDetailPayload: null,
  planetsById: new Map(),
  payload: null,
  listPayload: null,
  listPayloadKey: null,
  tenkaichiPayload: null,
  tenkaichiPayloadKey: null,
  charactersById: new Map(),
  requestId: 0,
};

const raceLabels = {
  Saiyan: 'Saiyajin', Human: 'Humano', Namekian: 'Namekiano', Majin: 'Majin',
  'Frieza Race': 'Raza de Freezer', Android: 'Androide', 'Jiren Race': 'Raza de Jiren',
  God: 'Dios', Angel: 'Ángel', Evil: 'Maligno', Nucleico: 'Nucleico',
  'Nucleico benigno': 'Nucleico benigno', Unknown: 'Desconocida',
};
const affiliationLabels = {
  'Z Fighter': 'Guerrero Z', 'Army of Frieza': 'Ejército de Freezer', Freelancer: 'Independiente',
  'Red Ribbon Army': 'Ejército Red Ribbon', 'Namekian Warrior': 'Guerrero namekiano',
  'Pride Troopers': 'Tropas del Orgullo', 'Assistant of Vermoud': 'Asistente de Vermoud',
  'God Assistant of Beerus': 'Asistente divino de Beerus', Villain: 'Villano', Other: 'Otra',
};
const genderLabels = { Male: 'Masculino', Female: 'Femenino', Unknown: 'Desconocido' };

function spanishRace(value) {
  return raceLabels[value] ?? value ?? 'Raza desconocida';
}

function spanishAffiliation(value) {
  return affiliationLabels[value] ?? value ?? 'Sin afiliación';
}

function spanishGender(value) {
  return genderLabels[value] ?? value ?? 'Desconocido';
}

function spanishTransformation(value) {
  return String(value ?? 'Transformación sin nombre')
    .replace(/Golden Great Ape/gi, 'Ozaru dorado')
    .replace(/Great Ape/gi, 'Ozaru')
    .replace(/Super Saiyan God Super Saiyan/gi, 'Super Saiyajin Dios Azul')
    .replace(/Super Saiyan God/gi, 'Super Saiyajin Dios')
    .replace(/Super Saiyan Blue/gi, 'Super Saiyajin Azul')
    .replace(/Super Saiyan/gi, 'Super Saiyajin')
    .replace(/Ultra Instinct/gi, 'Ultra Instinto')
    .replace(/Golden Frieza/gi, 'Freezer dorado')
    .replace(/Final Form/gi, 'Forma final')
    .replace(/Full Power/gi, 'Poder máximo');
}

function buildUrl() {
  if (state.resource === 'planets') {
    if (state.planetDetailId !== null) return `${PLANET_API}/${encodeURIComponent(state.planetDetailId)}`;
    const params = new URLSearchParams();
    if (!state.planetName && state.planetDestroyed === '') {
      params.set('page', state.planetPage);
      params.set('limit', state.planetLimit);
    }
    if (state.planetName) params.set('name', state.planetName);
    if (state.planetDestroyed !== '') params.set('isDestroyed', state.planetDestroyed);
    const query = params.toString();
    return query ? `${PLANET_API}?${query}` : PLANET_API;
  }
  if (state.detailId !== null) return `${API_BASE}/${encodeURIComponent(state.detailId)}`;
  const params = new URLSearchParams();
  if (state.characterViewMode === 'tenkaichi') {
    params.set('limit', 100);
  } else if (!state.name && !state.race && !state.affiliation) {
    params.set('page', state.page);
    params.set('limit', state.limit);
  }
  if (state.name) params.set('name', state.name);
  if (state.race) params.set('race', state.race);
  if (state.affiliation) params.set('affiliation', state.affiliation);
  const query = params.toString();
  return query ? `${API_BASE}?${query}` : API_BASE;
}

function characterListKey(mode = state.characterViewMode) {
  return mode === 'tenkaichi'
    ? JSON.stringify([mode, state.name, state.race, state.affiliation])
    : JSON.stringify([mode, state.page, state.limit, state.name, state.race, state.affiliation]);
}

function cachedCharacterList(mode = state.characterViewMode) {
  const key = characterListKey(mode);
  if (mode === 'tenkaichi') return state.tenkaichiPayloadKey === key ? state.tenkaichiPayload : null;
  return state.listPayloadKey === key ? state.listPayload : null;
}

function characterItems(payload) {
  return Array.isArray(payload) ? payload : (payload?.items ?? payload?.data ?? []);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function imageMarkup(image, name, className = '') {
  const imageUrl = safeImage(image);
  const fallback = `<span class="portrait-fallback" aria-hidden="true">${escapeHtml(String(name || '?').slice(0, 2).toUpperCase())}</span>`;
  return `<div class="character-portrait ${className}">${fallback}${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" />` : ''}</div>`;
}

function bindImageFallbacks() {
  document.querySelectorAll('.character-portrait img').forEach((image) => {
    if (image.dataset.fallbackBound) return;
    image.dataset.fallbackBound = 'true';
    image.addEventListener('error', () => image.remove(), { once: true });
  });
}

function formatPower(value) {
  if (!value || value === '0') return 'Sin dato';
  return String(value)
    .replace(/Septillion/gi, 'septillones')
    .replace(/Quadrillion/gi, 'cuatrillones')
    .replace(/Trillion/gi, 'billones')
    .replace(/Billion/gi, 'mil millones')
    .replace(/Million/gi, 'millones');
}

function setActiveView(view, updateUrl = true) {
  if (!PAGE_NAMES.includes(view)) view = 'inicio';
  state.activeView = view;
  document.querySelectorAll('[data-page-view]').forEach((section) => {
    const active = section.dataset.pageView === view;
    section.hidden = !active;
    section.classList.toggle('is-active', active);
  });
  document.querySelectorAll('[data-view-link]').forEach((link) => {
    const active = link.dataset.viewLink === view;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (updateUrl && window.location.hash !== `#${view}`) {
    window.history.pushState(null, '', `#${view}`);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setRunButton() {
  const method = state.method === 'async' ? 'async / await' : '.then() / .catch()';
  $('#run-request').innerHTML = `<span class="run-play" aria-hidden="true">▶</span><span>Repetir última petición · ${method}</span><span class="run-arrow" aria-hidden="true">↗</span>`;
}

function selectMethod(method) {
  state.method = method;
  document.querySelectorAll('.method-tab').forEach((tab) => {
    const active = tab.dataset.method === method;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  setRunButton();
  updateCodeViewer();
}

function setPending() {
  $('#run-request').disabled = true;
  document.querySelectorAll('.method-tab').forEach((tab) => { tab.disabled = true; });
  $('#run-request').innerHTML = '<span class="run-play" aria-hidden="true">◌</span><span>Esperando respuesta…</span><span class="run-arrow" aria-hidden="true">···</span>';
  $('#metric-status').textContent = 'PENDIENTE';
  $('#metric-status').className = 'status-waiting';
  $('#metric-status-label').textContent = 'solicitud en curso';
  $('#metric-latency').innerHTML = '— <small>ms</small>';
  $('#metric-type').textContent = '—';
  setIndicator('', 'CONSULTANDO');
  $('#live-status').textContent = `Consultando la API de Dragon Ball: ${buildUrl()}`;
  $('#request-url').textContent = buildUrl();
  $('#home-status').textContent = 'Consultando';
  $('#home-latency').textContent = 'Esperando respuesta de la API';
  $('#json-output').textContent = '// Esperando la respuesta JSON…';
  updateCodeViewer();
}

function setMetrics(response, elapsed) {
  const contentType = response.headers.get('content-type') ?? 'desconocido';
  $('#metric-status').textContent = `HTTP ${response.status}`;
  $('#metric-status').className = response.ok ? 'status-ok' : 'status-error';
  $('#metric-status-label').textContent = response.ok ? 'respuesta recibida' : 'la API reportó un error';
  $('#metric-latency').innerHTML = `${Math.round(elapsed)} <small>ms</small>`;
  $('#metric-type').textContent = contentType.split(';')[0];
  $('#metric-type').title = contentType;
  $('#home-status').textContent = response.ok ? `${response.status} OK` : `HTTP ${response.status}`;
  $('#home-latency').textContent = `Respondió en ${Math.round(elapsed)} ms`;
}

function finishRequest(requestId) {
  if (requestId !== state.requestId) return;
  $('#run-request').disabled = false;
  document.querySelectorAll('.method-tab').forEach((tab) => { tab.disabled = false; });
  setRunButton();
}

function setIndicator(kind, label) {
  const indicator = $('#response-indicator');
  indicator.className = `response-indicator${kind ? ` is-${kind}` : ''}`;
  indicator.innerHTML = `<i></i> ${escapeHtml(label)}`;
}

function characterCardMarkup(character, featured = false) {
  const id = escapeHtml(character.id);
  const name = escapeHtml(character.name || 'Sin nombre');
  const race = escapeHtml(spanishRace(character.race));
  const affiliation = escapeHtml(spanishAffiliation(character.affiliation));
  const power = escapeHtml(formatPower(character.ki));
  return `<article class="character-card${featured ? ' home-character-card' : ''}">
    <button type="button" class="character-image-button" data-image-character="${id}" aria-label="Ampliar imagen de ${name}">
      ${imageMarkup(character.image, character.name || 'Personaje', 'card-portrait')}<span class="image-zoom-hint">Ampliar <i>↗</i></span>
    </button>
    <button type="button" class="character-info-button" data-character-id="${id}" aria-label="Ver ficha de ${name}">
      <span class="character-card-info"><span class="character-race">${race}</span><strong>${name}</strong><span class="character-affiliation">${affiliation}</span><span class="character-power"><i>KI</i>${power}</span></span><span class="character-open" aria-hidden="true">↗</span>
    </button>
  </article>`;
}

function bindCharacterCards(container) {
  bindImageFallbacks();
  bindLightboxTriggers(container);
  container.querySelectorAll('[data-character-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const sameLoadedCharacter = String(card.dataset.characterId) === String(state.detailId)
        && String(state.payload?.id) === String(state.detailId);
      if (!sameLoadedCharacter) openCharacter(card.dataset.characterId);
    });
  });
}

function bindLightboxTriggers(container) {
  container.querySelectorAll('[data-image-character]').forEach((button) => {
    button.addEventListener('click', () => {
      const character = state.charactersById.get(String(button.dataset.imageCharacter));
      if (!character) return;
      const transformationIndex = button.dataset.transformationIndex;
      const transformation = transformationIndex === undefined
        ? null
        : character.transformations?.[Number(transformationIndex)];
      openCharacterLightbox(character, transformation);
    });
  });
}

function renderGallery(characters, meta) {
  const grid = $('#gallery-grid');
  const count = $('#gallery-count');
  if (!characters.length) {
    grid.innerHTML = '<p class="gallery-empty">No hay retratos para mostrar con esta consulta.</p>';
    count.textContent = '0 RETRATOS';
    return;
  }
  const total = meta?.totalItems ?? meta?.total ?? characters.length;
  count.textContent = `${characters.length} RETRATOS · ${Number(total).toLocaleString('es-NI')} EN EL CATÁLOGO`;
  grid.innerHTML = characters.map((character, index) => {
    const id = escapeHtml(character.id);
    const name = escapeHtml(character.name || 'Sin nombre');
    return `<article class="gallery-card" style="--gallery-index:${index}">
      <button type="button" class="gallery-image-button" data-image-character="${id}" aria-label="Ampliar imagen de ${name}">
        ${imageMarkup(character.image, character.name || 'Personaje', 'gallery-portrait')}<span class="gallery-image-action">Ver retrato <i>↗</i></span>
      </button>
      <button type="button" class="gallery-caption" data-character-id="${id}" aria-label="Abrir ficha de ${name}"><span>${escapeHtml(spanishRace(character.race))}</span><strong>${name}</strong><i aria-hidden="true">+</i></button>
    </article>`;
  }).join('');
  bindCharacterCards(grid);
}

function renderHome(characters, meta) {
  if (meta?.totalItems || meta?.total) {
    const total = meta.totalItems ?? meta.total;
    $('#home-total').textContent = Number(total).toLocaleString('es-NI');
    $('#home-total-note').textContent = 'personajes en el catálogo';
  } else if (characters.length) {
    $('#home-total').textContent = String(characters.length);
    $('#home-total-note').textContent = 'resultados en esta consulta';
  }
  const featured = characters.slice(0, 4);
  $('#home-featured').innerHTML = featured.length
    ? featured.map((character) => characterCardMarkup(character, true)).join('')
    : '<p class="featured-loading">No hay personajes destacados en esta respuesta.</p>';
  bindCharacterCards($('#home-featured'));
  renderGallery(characters, meta);
  const heroCharacter = characters.find((character) => character.name?.toLowerCase() === 'goku') ?? characters[0];
  if (heroCharacter) {
    $('#hero-character-image').innerHTML = `<button type="button" class="hero-image-button" data-image-character="${escapeHtml(heroCharacter.id)}" aria-label="Ampliar imagen de ${escapeHtml(heroCharacter.name)}">${imageMarkup(heroCharacter.image, heroCharacter.name, 'hero-character-portrait')}</button>`;
    bindImageFallbacks();
    bindLightboxTriggers($('#hero-character-image'));
  }
}

function renderCharacters(payload) {
  state.resource = 'characters';
  setCharacterDetailMode(false);
  const characters = characterItems(payload);
  const meta = Array.isArray(payload) ? null : (payload?.meta ?? payload?.pagination ?? null);
  if (state.characterViewMode === 'tenkaichi') {
    state.tenkaichiPayload = payload;
    state.tenkaichiPayloadKey = characterListKey('tenkaichi');
  } else {
    state.listPayload = payload;
    state.listPayloadKey = characterListKey('catalog');
  }
  state.charactersById = new Map(characters.map((character) => [String(character.id), character]));
  const total = meta?.totalItems ?? meta?.total ?? characters.length;
  $('#catalog-count').textContent = `${Number(total).toLocaleString('es-NI')} PERSONAJES`;
  $('#catalog-description').textContent = state.name || state.race || state.affiliation
    ? `Resultados${state.name ? ` · ${state.name}` : ''}${state.race ? ` · ${spanishRace(state.race)}` : ''}${state.affiliation ? ` · ${spanishAffiliation(state.affiliation)}` : ''}`
    : 'Explora el universo de Dragon Ball';
  const currentPage = meta?.currentPage ?? state.page;
  const totalPages = meta?.totalPages ?? 1;
  $('#catalog-page').textContent = meta ? `PÁGINA ${currentPage} / ${totalPages}` : (characters.length ? 'RESULTADOS' : '');

  if (!characters.length) {
    $('#character-content').innerHTML = '<div class="character-placeholder"><span class="placeholder-orb">?</span><strong>No encontramos personajes</strong><small>Prueba otro nombre o cambia los filtros.</small></div>';
    $('#pagination').hidden = true;
    renderHome([], meta);
    return;
  }

  if (state.characterViewMode === 'tenkaichi') renderTenkaichiGrid(characters);
  else {
    $('#character-content').innerHTML = `<div class="character-grid catalog-grid">${characters.map((character) => characterCardMarkup(character)).join('')}</div>`;
    bindCharacterCards($('#character-content'));
  }
  renderHome(characters, meta);
  const hasPages = state.characterViewMode !== 'tenkaichi' && meta && totalPages > 1 && !state.name && !state.race && !state.affiliation;
  $('#pagination').hidden = !hasPages;
  if (hasPages) {
    $('#page-label').textContent = `${currentPage} / ${totalPages}`;
    $('#prev-page').disabled = currentPage <= 1;
    $('#next-page').disabled = currentPage >= totalPages;
  }
}

function tenkaichiFighterMarkup(character) {
  const id = String(character.id);
  const name = escapeHtml(character.name || 'Sin nombre');
  const selected = String(state.selectedCharacterId) === id;
  return `<button type="button" class="tenkaichi-fighter${selected ? ' is-selected' : ''}" data-character-id="${escapeHtml(id)}" aria-label="Seleccionar a ${name}" aria-pressed="${selected}">
    ${imageMarkup(character.image, character.name || 'Personaje', 'tenkaichi-portrait')}
    <span class="tenkaichi-roster-lock" aria-hidden="true">✦</span><span class="tenkaichi-roster-name">${name}</span>
  </button>`;
}

function renderTenkaichiGrid(characters) {
  const selected = characters.find((character) => String(character.id) === String(state.selectedCharacterId)) ?? characters[0];
  if (!selected) return;
  state.selectedCharacterId = String(selected.id);
  renderTenkaichiSelection(selected, false);
}

function revealTenkaichiRosterSelection(characterId, { direction = 0, wrapped = false } = {}) {
  const strip = $('.tenkaichi-roster-grid');
  const button = [...(strip?.querySelectorAll('.tenkaichi-fighter') ?? [])]
    .find((fighter) => fighter.dataset.characterId === String(characterId));
  if (!strip || !button) return;

  const stripBounds = strip.getBoundingClientRect();
  const cardBounds = button.getBoundingClientRect();
  const visibleLeft = stripBounds.left + strip.clientLeft;
  const visibleRight = visibleLeft + strip.clientWidth;
  const maxScroll = strip.scrollWidth - strip.clientWidth;
  const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 0;
  const cardStep = button.getBoundingClientRect().width + gap;
  let nextScrollLeft = strip.scrollLeft;

  if (wrapped) nextScrollLeft = direction > 0 ? 0 : maxScroll;
  else if (direction > 0 && cardBounds.right > visibleRight - 1) nextScrollLeft += cardStep;
  else if (direction < 0 && cardBounds.left < visibleLeft + 1) nextScrollLeft -= cardStep;
  else if (direction === 0 && cardBounds.right > visibleRight) nextScrollLeft += cardBounds.right - visibleRight;
  else if (direction === 0 && cardBounds.left < visibleLeft) nextScrollLeft -= visibleLeft - cardBounds.left;

  strip.scrollLeft = Math.max(0, Math.min(maxScroll, nextScrollLeft));
}

function renderTenkaichiSelection(character, isDetail, transformations = []) {
  const rosterPayload = cachedCharacterList('tenkaichi') ?? state.listPayload;
  const listedCharacters = characterItems(rosterPayload);
  const roster = listedCharacters.some((item) => String(item.id) === String(character.id))
    ? listedCharacters
    : [character, ...listedCharacters];
  const name = escapeHtml(character.name || 'Sin nombre');
  const race = escapeHtml(spanishRace(character.race));
  const affiliation = escapeHtml(spanishAffiliation(character.affiliation));
  const transformationOptions = `<option value="" selected>Forma base · Elige una transformación</option>${transformations.map((item, index) => `<option value="${index}">${escapeHtml(spanishTransformation(item.name ?? item.formName ?? `Forma ${index + 1}`))}</option>`).join('')}`;
  const transformationsMarkup = isDetail
    ? (transformations.length
      ? `<label class="tenkaichi-transform-picker"><span>ELIGE UNA TRANSFORMACIÓN</span><select id="transformation-select" aria-label="Selecciona una transformación">${transformationOptions}</select></label><div id="selected-transformation" class="tenkaichi-current-form"><div><span>FORMA ACTUAL</span><strong>Forma base</strong><small>Elige una transformación para cambiar el retrato.</small></div></div>`
      : '<div class="tenkaichi-no-forms"><span aria-hidden="true">◌</span><p>La API no registra transformaciones para este personaje.</p></div>')
    : '<div class="tenkaichi-no-forms"><span aria-hidden="true">◌</span><p>Confirma un luchador para consultar sus transformaciones.</p></div>';
  const planet = character.originPlanet;
  const planetMarkup = planet?.name
    ? `<div class="tenkaichi-origin"><span>PLANETA DE ORIGEN</span><strong>${escapeHtml(planet.name)}</strong></div>`
    : '';
  const characterDescription = isDetail && character.description
    ? `<p class="tenkaichi-description">${escapeHtml(character.description)}</p>`
    : '';
  const backMarkup = isDetail
    ? '<button id="back-to-catalog" class="tenkaichi-back-button" type="button"><span aria-hidden="true">◀</span> Volver a la selección</button>'
    : '';
  const commandHints = isDetail && transformations.length
    ? '<span><kbd>↑</kbd><kbd>↓</kbd> TRANSFORMACIÓN</span><span><kbd>←</kbd><kbd>→</kbd> CAMBIAR LUCHADOR</span>'
    : '<span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> NAVEGAR PERSONAJES</span><span><kbd class="is-wide">ENTER</kbd> CONFIRMAR SELECCIÓN</span>';

  $('#character-content').innerHTML = `<section class="tenkaichi-select-screen${isDetail ? ' has-selected-fighter' : ' is-roster-preview'}" aria-label="Selección de luchadores">
    <div class="tenkaichi-game-header"><span><b>1P</b> SELECCIÓN DE LUCHADORES</span><span>${isDetail ? 'PERSONAJE CONFIRMADO' : 'ELIGE UN GUERRERO'}</span></div>
    <div class="tenkaichi-roster-panel"><div class="tenkaichi-roster-title"><strong>ELENCO DE COMBATE</strong><span>${roster.length} PERSONAJES · USA FLECHAS PARA EXPLORAR</span></div><div class="tenkaichi-roster-grid">${roster.map(tenkaichiFighterMarkup).join('')}</div></div>
    <div class="tenkaichi-selection-stage">
      <div class="tenkaichi-visual-panel"><span class="tenkaichi-stage-index">SELECCIÓN <b>01</b></span><span class="tenkaichi-stage-aura" aria-hidden="true"></span><span class="tenkaichi-stage-grid" aria-hidden="true"></span><button id="detail-image-trigger" type="button" class="detail-image-trigger tenkaichi-stage-image" data-image-character="${escapeHtml(character.id)}" aria-label="Ampliar imagen de ${name}">${imageMarkup(character.image, character.name || 'Personaje', 'tenkaichi-main-portrait')}<span>VER RETRATO EN GRANDE ↗</span></button><div class="tenkaichi-nameplate"><small>${race} · ${affiliation}</small><strong>${name}</strong><span>GUERRERO SELECCIONADO</span></div><span class="tenkaichi-target-mark" aria-hidden="true">◎</span></div>
      <aside class="tenkaichi-info-panel"><div class="tenkaichi-panel-header"><div><span>PERFIL DE COMBATE</span><small>${isDetail ? 'DATOS DE LA API' : 'VISTA PREVIA'}</small></div><b>1P</b></div><h2>${name}</h2><p class="tenkaichi-character-type">${race} <i>·</i> ${affiliation}</p><div class="tenkaichi-stats"><div><span>NIVEL DE KI</span><strong>${escapeHtml(formatPower(character.ki))}</strong></div><div><span>GÉNERO</span><strong>${escapeHtml(spanishGender(character.gender))}</strong></div></div>${planetMarkup}${characterDescription}<div class="tenkaichi-transformation-zone">${transformationsMarkup}</div>${isDetail ? backMarkup : `<button type="button" class="tenkaichi-confirm-button" data-character-id="${escapeHtml(character.id)}">Confirmar luchador <span aria-hidden="true">▶</span></button>`}</aside>
    </div>
    <div class="tenkaichi-command-bar">${commandHints}<span class="tenkaichi-player-tag">DRAGON BALL · 1P</span></div>
  </section>`;
  bindCharacterCards($('#character-content'));
  revealTenkaichiRosterSelection(character.id);
  if (isDetail) {
    $('#back-to-catalog').addEventListener('click', returnToCatalog);
    if (transformations.length) {
      const selector = $('#transformation-select');
      selector.addEventListener('change', () => {
        const index = Number(selector.value);
        if (selector.value === '' || !transformations[index]) resetTenkaichiTransformation(character);
        else renderSelectedTransformation(transformations[index], index, transformations.length);
      });
    }
  }
}

function updateCharacterModeButtons() {
  const isTenkaichi = state.characterViewMode === 'tenkaichi';
  $('#mode-catalog').classList.toggle('is-active', !isTenkaichi);
  $('#mode-tenkaichi').classList.toggle('is-active', isTenkaichi);
  $('#mode-catalog').setAttribute('aria-pressed', String(!isTenkaichi));
  $('#mode-tenkaichi').setAttribute('aria-pressed', String(isTenkaichi));
}

function changeCharacterViewMode(mode) {
  if (!['catalog', 'tenkaichi'].includes(mode) || state.characterViewMode === mode) return;
  state.characterViewMode = mode;
  try {
    localStorage.setItem('dragonball-character-view', mode);
  } catch {
    // La preferencia sigue activa durante esta sesión aunque el almacenamiento esté bloqueado.
  }
  updateCharacterModeButtons();

  const detail = state.detailId !== null
    && String(state.payload?.id) === String(state.detailId)
    ? state.payload
    : null;
  const selectedCharacter = state.charactersById.get(String(state.detailId));
  setCharacterDetailMode(state.detailId !== null, detail?.name ?? selectedCharacter?.name ?? '');

  if (state.activeView !== 'personajes') return;
  if (detail) renderCharacterDetail(detail);
  else if (state.detailId === null) {
    const cached = cachedCharacterList(mode);
    if (cached) renderCharacters(cached);
    else runSelectedMethod();
  }
}

function moveTenkaichiSelection(direction) {
  const roster = characterItems(cachedCharacterList('tenkaichi') ?? state.tenkaichiPayload);
  if (!roster.length) return;

  const currentId = state.detailId ?? state.selectedCharacterId;
  const currentIndex = roster.findIndex((character) => String(character.id) === String(currentId));
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : roster.length - 1)
    : (currentIndex + direction + roster.length) % roster.length;
  const selected = roster[nextIndex];
  const rosterStrip = $('.tenkaichi-roster-grid');
  if (!rosterStrip) return;

  state.selectedCharacterId = String(selected.id);
  state.detailId = null;
  state.focusCharacterDetail = false;
  state.resource = 'characters';
  setCharacterDetailMode(false);
  $('#pagination').hidden = true;
  updateCodeViewer();
  const selectedButton = [...rosterStrip.querySelectorAll('.tenkaichi-fighter')]
    .find((button) => button.dataset.characterId === String(selected.id));
  rosterStrip.querySelectorAll('.tenkaichi-fighter').forEach((fighter) => {
    const isSelected = fighter === selectedButton;
    fighter.classList.toggle('is-selected', isSelected);
    fighter.setAttribute('aria-pressed', String(isSelected));
  });
  updateTenkaichiPreview(selected, nextIndex);
  revealTenkaichiRosterSelection(selected.id, {
    direction,
    wrapped: direction > 0 ? nextIndex < currentIndex : nextIndex > currentIndex,
  });
  selectedButton?.focus({ preventScroll: true });
  $('#live-status').textContent = `${selected.name || 'Personaje'} seleccionado. Presiona Enter para abrir su ficha.`;
}

function updateTenkaichiPreview(character, rosterIndex) {
  const name = character.name || 'Sin nombre';
  const race = spanishRace(character.race);
  const affiliation = spanishAffiliation(character.affiliation);
  const screen = $('.tenkaichi-select-screen');
  screen.classList.remove('has-selected-fighter');
  screen.classList.add('is-roster-preview');
  state.charactersById.set(String(character.id), character);
  const imageButton = $('#detail-image-trigger');
  imageButton.dataset.imageCharacter = String(character.id);
  delete imageButton.dataset.transformationIndex;
  imageButton.setAttribute('aria-label', `Ampliar imagen de ${name}`);
  imageButton.innerHTML = `${imageMarkup(character.image, name, 'tenkaichi-main-portrait')}<span>VER RETRATO EN GRANDE ↗</span>`;
  $('.tenkaichi-nameplate small').textContent = `${race} · ${affiliation}`;
  $('.tenkaichi-nameplate strong').textContent = name;
  $('.tenkaichi-nameplate>span').textContent = 'GUERRERO SELECCIONADO';
  $('.tenkaichi-info-panel>h2').textContent = name;
  $('.tenkaichi-character-type').textContent = `${race} · ${affiliation}`;
  $('.tenkaichi-panel-header small').textContent = 'VISTA PREVIA';
  $('.tenkaichi-game-header span:last-child').textContent = 'ELIGE UN GUERRERO';
  $('.tenkaichi-transformation-zone').innerHTML = '<div class="tenkaichi-no-forms"><span aria-hidden="true">◌</span><p>Confirma un luchador para consultar sus transformaciones.</p></div>';
  $('.tenkaichi-description')?.remove();
  const stageIndex = $('.tenkaichi-stage-index b');
  stageIndex.textContent = String(rosterIndex + 1).padStart(2, '0');
  const stats = $('.tenkaichi-stats').querySelectorAll('div>strong');
  if (stats[0]) stats[0].textContent = formatPower(character.ki);
  if (stats[1]) stats[1].textContent = spanishGender(character.gender);

  const origin = $('.tenkaichi-origin');
  if (character.originPlanet?.name) {
    if (origin) origin.querySelector('strong').textContent = character.originPlanet.name;
    else $('.tenkaichi-transformation-zone').insertAdjacentHTML('beforebegin', `<div class="tenkaichi-origin"><span>PLANETA DE ORIGEN</span><strong>${escapeHtml(character.originPlanet.name)}</strong></div>`);
  } else origin?.remove();

  const backButton = $('#back-to-catalog');
  let confirmButton = $('.tenkaichi-confirm-button');
  if (!confirmButton) {
    confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'tenkaichi-confirm-button';
    confirmButton.innerHTML = 'Confirmar luchador <span aria-hidden="true">▶</span>';
    confirmButton.addEventListener('click', () => openCharacter(confirmButton.dataset.characterId));
    if (backButton) backButton.replaceWith(confirmButton);
    else $('.tenkaichi-info-panel').append(confirmButton);
  }
  confirmButton.dataset.characterId = String(character.id);

  $('.tenkaichi-command-bar').innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> NAVEGAR PERSONAJES</span><span><kbd class="is-wide">ENTER</kbd> CONFIRMAR SELECCIÓN</span><span class="tenkaichi-player-tag">DRAGON BALL · 1P</span>';
  bindImageFallbacks();
}

function moveTenkaichiTransformation(direction) {
  const selector = $('#transformation-select');
  const optionCount = selector?.options.length ?? 0;
  if (optionCount < 2) return false;

  const currentIndex = selector.selectedIndex < 0 ? 0 : selector.selectedIndex;
  const nextIndex = (currentIndex + direction + optionCount) % optionCount;
  selector.selectedIndex = nextIndex;
  selector.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function handleTenkaichiArrowKeys(event) {
  if (state.activeView !== 'personajes' || state.characterViewMode !== 'tenkaichi' || $('#character-lightbox').open) return;
  const target = event.target instanceof Element ? event.target : null;
  const isVerticalArrow = event.key === 'ArrowUp' || event.key === 'ArrowDown';
  const transformationSelect = $('#transformation-select');
  const focusedControl = target?.closest('input,select,textarea,[contenteditable="true"]');

  if (isVerticalArrow && state.detailId !== null && transformationSelect && (!focusedControl || target === transformationSelect)) {
    event.preventDefault();
    moveTenkaichiTransformation(event.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (focusedControl) {
    if (target === transformationSelect && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      moveTenkaichiSelection(event.key === 'ArrowRight' ? 1 : -1);
    }
    return;
  }
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
    ? 1
    : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  if (!direction) return;
  event.preventDefault();
  moveTenkaichiSelection(direction);
}

function planetStatusLabel(planet) {
  return planet.isDestroyed ? 'Destruido' : 'No destruido';
}

function planetCardMarkup(planet) {
  const id = escapeHtml(planet.id);
  const name = escapeHtml(planet.name || 'Planeta sin nombre');
  const status = planet.isDestroyed ? 'is-destroyed' : 'is-safe';
  return `<article class="planet-card">
    <button type="button" class="planet-card-button" data-planet-id="${id}" aria-label="Abrir ficha del planeta ${name}">
      ${imageMarkup(planet.image, planet.name || 'Planeta', 'planet-portrait')}
      <span class="planet-status-badge ${status}">${planet.isDestroyed ? '☄' : '✦'} ${planetStatusLabel(planet)}</span>
      <span class="planet-card-info"><strong>${name}</strong><span>${escapeHtml(planet.description || 'No hay una descripción disponible para este mundo.')}</span><i>Explorar planeta <b aria-hidden="true">↗</b></i></span>
    </button>
  </article>`;
}

function bindPlanetCards(container) {
  bindImageFallbacks();
  container.querySelectorAll('[data-planet-id]').forEach((button) => {
    button.addEventListener('click', () => openPlanet(button.dataset.planetId));
  });
}

function setPlanetDetailMode(isDetail, planetName = '') {
  $('#planet-search-form').hidden = isDetail;
  $('#planet-toolbar').hidden = isDetail;
  $('#planet-pagination').hidden = true;
  $('#planets-title').textContent = isDetail ? planetName : 'Mundos de Dragon Ball';
  $('#planets-intro').textContent = isDetail
    ? 'Explora su historia y conoce los personajes que viven allí o provienen de este mundo.'
    : 'Explora sus paisajes, conoce su historia y descubre quiénes los habitan.';
}

function renderPlanetDetail(planet) {
  if (!planet || !planet.id) {
    showPlanetError('La API no devolvió la ficha de este planeta.');
    return;
  }
  state.planetsById.set(String(planet.id), planet);
  const characters = Array.isArray(planet.characters) ? planet.characters : [];
  const statusClass = planet.isDestroyed ? 'is-destroyed' : 'is-safe';
  const inhabitantsMarkup = characters.length
    ? `<div class="planet-inhabitants">${characters.map((character) => {
      state.charactersById.set(String(character.id), character);
      const id = escapeHtml(character.id);
      const name = escapeHtml(character.name || 'Personaje sin nombre');
      return `<button type="button" class="planet-inhabitant" data-character-id="${id}" aria-label="Ver ficha de ${name}">${imageMarkup(character.image, character.name || 'Personaje', 'inhabitant-portrait')}<span><strong>${name}</strong><small>${escapeHtml(spanishRace(character.race))}</small></span><i aria-hidden="true">↗</i></button>`;
    }).join('')}</div>`
    : '<div class="planet-empty-inhabitants"><span aria-hidden="true">✦</span><strong>Sin personajes registrados</strong><p>La API no tiene personajes asociados a este planeta.</p></div>';

  setPlanetDetailMode(true, planet.name || 'Planeta');
  $('#planet-count').textContent = 'FICHA DE PLANETA';
  $('#planet-description').textContent = `${planetStatusLabel(planet)} · ID ${planet.id}`;
  $('#planet-page').textContent = '';
  $('#planet-grid').innerHTML = `<article class="planet-detail-card">
    <button id="back-to-planets" class="back-button" type="button"><span aria-hidden="true">←</span> Volver al atlas</button>
    <div class="planet-detail-hero">${imageMarkup(planet.image, planet.name || 'Planeta', 'planet-detail-portrait')}<div class="planet-detail-copy"><span class="planet-status-badge ${statusClass}">${planet.isDestroyed ? '☄' : '✦'} ${planetStatusLabel(planet)}</span><h2>${escapeHtml(planet.name || 'Planeta sin nombre')}</h2><p>${escapeHtml(planet.description || 'No hay una descripción disponible para este mundo.')}</p><div class="planet-detail-facts"><span><i aria-hidden="true">◎</i> Universo Dragon Ball</span><span><i aria-hidden="true">♟</i> ${characters.length} ${characters.length === 1 ? 'personaje asociado' : 'personajes asociados'}</span></div></div></div>
    <div class="planet-inhabitants-heading"><div><span>ARCHIVO DE HABITANTES</span><h3>Personajes de este mundo</h3></div><b>${String(characters.length).padStart(2, '0')}</b></div>
    ${inhabitantsMarkup}
  </article>`;
  bindImageFallbacks();
  $('#back-to-planets').addEventListener('click', returnToPlanets);
  bindCharacterCards($('#planet-grid'));
}

function renderPlanets(payload) {
  state.resource = 'planets';
  if (state.planetDetailId !== null) {
    state.planetDetailPayload = payload;
    renderPlanetDetail(payload);
    return;
  }
  state.planetListPayload = payload;
  const planets = Array.isArray(payload) ? payload : (payload?.items ?? payload?.data ?? []);
  const meta = Array.isArray(payload) ? null : (payload?.meta ?? payload?.pagination ?? null);
  state.planetsById = new Map(planets.map((planet) => [String(planet.id), planet]));
  const total = meta?.totalItems ?? meta?.total ?? planets.length;
  $('#planet-count').textContent = `${Number(total).toLocaleString('es-NI')} PLANETAS`;
  $('#planet-description').textContent = state.planetName || state.planetDestroyed !== ''
    ? `Resultados${state.planetName ? ` · ${state.planetName}` : ''}${state.planetDestroyed !== '' ? ` · ${state.planetDestroyed === 'true' ? 'Destruidos' : 'No destruidos'}` : ''}`
    : 'Un atlas de mundos del universo Dragon Ball';
  const currentPage = meta?.currentPage ?? state.planetPage;
  const totalPages = meta?.totalPages ?? 1;
  $('#planet-page').textContent = meta ? `PÁGINA ${currentPage} / ${totalPages}` : (planets.length ? 'RESULTADOS' : '');
  setPlanetDetailMode(false);

  $('#planet-grid').innerHTML = planets.length
    ? planets.map(planetCardMarkup).join('')
    : '<div class="planet-empty"><span aria-hidden="true">◌</span><strong>No encontramos planetas</strong><p>Prueba con otro nombre o cambia el estado de destrucción.</p></div>';
  bindPlanetCards($('#planet-grid'));

  const hasPages = Boolean(meta && totalPages > 1 && !state.planetName && state.planetDestroyed === '');
  $('#planet-pagination').hidden = !hasPages;
  if (hasPages) {
    $('#planet-page-label').textContent = `${currentPage} / ${totalPages}`;
    $('#planet-prev').disabled = currentPage <= 1;
    $('#planet-next').disabled = currentPage >= totalPages;
  }
}

function showPlanetError(message) {
  setPlanetDetailMode(false);
  $('#planet-count').textContent = 'SIN RESULTADOS';
  $('#planet-description').textContent = 'La consulta de planetas no se pudo completar';
  $('#planet-page').textContent = '';
  $('#planet-grid').innerHTML = `<div class="planet-empty is-error"><span aria-hidden="true">!</span><strong>No se pudo cargar el atlas</strong><p>${escapeHtml(message)}</p></div>`;
  $('#live-status').textContent = message;
}

function openCharacterLightbox(character, transformation = null) {
  const dialog = $('#character-lightbox');
  if (!character || !dialog) return;

  const characterName = character.name || 'Personaje';
  const transformationName = transformation
    ? spanishTransformation(transformation.name ?? transformation.formName ?? 'Transformación')
    : '';
  const title = transformationName || characterName;
  const image = transformation?.image || character.image;
  const power = transformation?.ki || character.ki;

  dialog.dataset.characterId = String(character.id);
  $('#lightbox-kicker').textContent = transformation ? 'FORMA DE COMBATE' : 'RETRATO DE ARCHIVO';
  $('#lightbox-title').textContent = title;
  $('#lightbox-description').textContent = transformation
    ? `${title} de ${characterName}. Un registro del universo de Dragon Ball.`
    : character.description || `${spanishAffiliation(character.affiliation)} · ${spanishRace(character.race)}`;
  $('#lightbox-race').textContent = spanishRace(character.race);
  $('#lightbox-power').textContent = `KI ${formatPower(power)}`;
  $('#lightbox-image').innerHTML = imageMarkup(image, title, 'lightbox-portrait');
  setLightboxZoom(false);
  bindImageFallbacks();

  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function setLightboxZoom(zoom, x = 0.5, y = 0.5) {
  const card = $('#lightbox-3d-card');
  const button = $('#lightbox-zoom');
  const focusX = Math.max(0, Math.min(1, x));
  const focusY = Math.max(0, Math.min(1, y));
  card.classList.toggle('is-zoomed', zoom);
  card.style.setProperty('--zoom-x', `${focusX * 100}%`);
  card.style.setProperty('--zoom-y', `${focusY * 100}%`);
  if (!zoom) {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.style.setProperty('--spot-x', '50%');
    card.style.setProperty('--spot-y', '50%');
  }
  $('#lightbox-image').setAttribute('aria-label', zoom
    ? 'Haz clic para volver al retrato completo'
    : 'Haz clic en una zona del personaje para ampliarla');
  button.setAttribute('aria-pressed', String(zoom));
  button.setAttribute('aria-label', zoom ? 'Reducir retrato' : 'Ampliar retrato');
  button.innerHTML = zoom ? '− <span>Reducir</span>' : '＋ <span>Ampliar</span>';
  $('#live-status').textContent = zoom
    ? 'Retrato ampliado. Haz clic de nuevo en el personaje para volver.'
    : 'Se muestra el retrato completo.';
}

function renderSelectedTransformation(transformation, index, total) {
  const transformationName = spanishTransformation(transformation.name ?? transformation.formName ?? `Forma ${index + 1}`);
  const ki = transformation.ki !== undefined && transformation.ki !== null && transformation.ki !== ''
    ? `Nivel de ki: ${formatPower(transformation.ki)}`
    : 'Forma registrada en la API';
  const character = state.charactersById.get(String(state.detailId));
  if (state.characterViewMode === 'tenkaichi') {
    $('#selected-transformation').innerHTML = `<div class="tenkaichi-current-form"><span>FORMA ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span><strong>${escapeHtml(transformationName)}</strong><small>${escapeHtml(ki)}</small></div>`;
  } else {
    $('#selected-transformation').innerHTML = `<div class="selected-transformation-card">
      <button type="button" class="transformation-image-button" data-image-character="${escapeHtml(state.detailId)}" data-transformation-index="${index}" aria-label="Ampliar ${escapeHtml(transformationName)}">${imageMarkup(transformation.image, `Transformación ${transformationName}`, 'selected-transformation-portrait')}<span>Ampliar ↗</span></button>
      <div class="selected-transformation-info"><span>FORMA ${index + 1} DE ${total}</span><strong>${escapeHtml(transformationName)}</strong><small>${escapeHtml(ki)}</small></div>
    </div>`;
  }
  if (state.characterViewMode === 'tenkaichi' && character) {
    const detailImage = $('#detail-image-trigger');
    const nameplateTitle = $('.tenkaichi-nameplate strong');
    const profileTitle = $('.tenkaichi-info-panel>h2');
    const profilePower = $('.tenkaichi-stats>div:first-child>strong');
    if (nameplateTitle) nameplateTitle.textContent = transformationName;
    if (profileTitle) profileTitle.textContent = `${character.name} · ${transformationName}`;
    if (profilePower) profilePower.textContent = formatPower(transformation.ki ?? character.ki);
    detailImage.dataset.transformationIndex = String(index);
    detailImage.setAttribute('aria-label', `Ampliar imagen de ${character.name}: ${transformationName}`);
    detailImage.innerHTML = `${imageMarkup(transformation.image || character.image, `${character.name} · ${transformationName}`, 'tenkaichi-main-portrait')}<span>${escapeHtml(transformationName)} · Ver en grande ↗</span>`;
    $('#live-status').textContent = `Imagen actualizada: ${character.name}, ${transformationName}.`;
  }
  bindImageFallbacks();
  bindLightboxTriggers($('#selected-transformation'));
}

function resetTenkaichiTransformation(character) {
  const detailImage = $('#detail-image-trigger');
  const nameplateTitle = $('.tenkaichi-nameplate strong');
  const profileTitle = $('.tenkaichi-info-panel>h2');
  const profilePower = $('.tenkaichi-stats>div:first-child>strong');
  $('#selected-transformation').innerHTML = '<div><span>FORMA ACTUAL</span><strong>Forma base</strong><small>Elige una transformación para cambiar el retrato.</small></div>';
  if (nameplateTitle) nameplateTitle.textContent = character.name;
  if (profileTitle) profileTitle.textContent = character.name;
  if (profilePower) profilePower.textContent = formatPower(character.ki);
  delete detailImage.dataset.transformationIndex;
  detailImage.setAttribute('aria-label', `Ampliar imagen de ${character.name}`);
  detailImage.innerHTML = `${imageMarkup(character.image, character.name || 'Personaje', 'tenkaichi-main-portrait')}<span>FORMA BASE · Ver en grande ↗</span>`;
  $('#live-status').textContent = `${character.name}: forma base seleccionada.`;
  bindImageFallbacks();
}

function renderCharacterDetail(character) {
  if (!character || !character.id) {
    showError('La API no devolvió la ficha esperada.', state.requestId);
    return;
  }
  const transformations = Array.isArray(character.transformations) ? character.transformations : [];
  state.charactersById.set(String(character.id), character);
  state.selectedCharacterId = String(character.id);
  setCharacterDetailMode(true, character.name);
  const planet = character.originPlanet;
  $('#catalog-count').textContent = 'FICHA DE PERSONAJE';
  $('#catalog-description').textContent = `${spanishRace(character.race)} · ${spanishGender(character.gender)}`;
  $('#catalog-page').textContent = `ID ${character.id}`;
  $('#pagination').hidden = true;

  const transformationMarkup = transformations.length
    ? `<label class="transformation-picker"><span>ELIGE UNA TRANSFORMACIÓN</span><select id="transformation-select" aria-label="Selecciona una transformación"><option value="" selected>Forma base · Elige una transformación</option>${transformations.map((item, index) => `<option value="${index}">${escapeHtml(spanishTransformation(item.name ?? item.formName ?? `Forma ${index + 1}`))}</option>`).join('')}</select></label><div id="selected-transformation" class="selected-transformation"><p class="transformation-base-hint">Personaje en forma base. Selecciona una transformación para ver sus datos.</p></div>`
    : '<p class="no-transformations">No hay transformaciones disponibles para este personaje.</p>';
  const planetMarkup = planet
    ? `<div class="origin-planet"><div class="planet-orbit"><span></span></div><div><small>PLANETA DE ORIGEN</small><strong>${escapeHtml(planet.name || 'Desconocido')}</strong><p>${escapeHtml(planet.description || 'Sin descripción disponible.')}</p></div></div>`
    : '';
  if (state.characterViewMode === 'tenkaichi') {
    renderTenkaichiSelection(character, true, transformations);
  } else {
    $('#character-content').innerHTML = `<article class="character-detail">
    <button id="back-to-catalog" class="back-button" type="button"><span aria-hidden="true">←</span> Volver al catálogo</button>
    <div class="detail-hero"><button id="detail-image-trigger" type="button" class="detail-image-trigger" data-image-character="${escapeHtml(character.id)}" aria-label="Ampliar imagen de ${escapeHtml(character.name)}">${imageMarkup(character.image, character.name, 'detail-portrait')}<span>Ver imagen en grande ↗</span></button><div class="detail-identity"><span class="character-race">${escapeHtml(spanishRace(character.race))}</span><h2>${escapeHtml(character.name)}</h2><p>${escapeHtml(spanishAffiliation(character.affiliation))} · ${escapeHtml(spanishGender(character.gender))}</p><div class="detail-power"><span>NIVEL DE KI</span><strong>${escapeHtml(formatPower(character.ki))}</strong><small>Máximo: ${escapeHtml(formatPower(character.maxKi))}</small></div></div></div>
    <p class="character-description">${escapeHtml(character.description || 'No hay descripción disponible para este personaje.')}</p>
    ${planetMarkup}
    <div class="transformation-heading"><span>TRANSFORMACIONES</span><span>${transformations.length} ${transformations.length === 1 ? 'FORMA' : 'FORMAS'}</span></div>
    ${transformationMarkup}
  </article>`;
  bindImageFallbacks();
  bindLightboxTriggers($('#character-content'));
  $('#back-to-catalog').addEventListener('click', returnToCatalog);
  if (transformations.length) {
    const selector = $('#transformation-select');
    selector.addEventListener('change', () => {
      const index = Number(selector.value);
      if (selector.value === '') {
        $('#selected-transformation').innerHTML = '<p class="transformation-base-hint">Personaje en forma base. Selecciona una transformación para ver sus datos.</p>';
      } else if (transformations[index]) renderSelectedTransformation(transformations[index], index, transformations.length);
    });
  }
  }
  if (state.focusCharacterDetail) {
    $('#characters-title').focus({ preventScroll: true });
    state.focusCharacterDetail = false;
  }
}

function setPending() {
  $('#run-request').disabled = true;
  document.querySelectorAll('.method-tab').forEach((tab) => { tab.disabled = true; });
  $('#run-request').innerHTML = '<span class="run-play" aria-hidden="true">◌</span><span>Esperando respuesta…</span><span class="run-arrow" aria-hidden="true">···</span>';
  $('#metric-status').textContent = 'PENDIENTE';
  $('#metric-status').className = 'status-waiting';
  $('#metric-status-label').textContent = 'solicitud en curso';
  $('#metric-latency').innerHTML = '— <small>ms</small>';
  $('#metric-type').textContent = '—';
  setIndicator('', 'CONSULTANDO');
  $('#live-status').textContent = `Consultando la API de Dragon Ball: ${buildUrl()}`;
  $('#request-url').textContent = buildUrl();
  $('#home-status').textContent = 'Consultando';
  $('#home-latency').textContent = 'Esperando respuesta de la API';
  $('#json-output').textContent = '// Esperando la respuesta JSON…';
  updateCodeViewer();
}

function setMetrics(response, elapsed) {
  const contentType = response.headers.get('content-type') ?? 'desconocido';
  $('#metric-status').textContent = `HTTP ${response.status}`;
  $('#metric-status').className = response.ok ? 'status-ok' : 'status-error';
  $('#metric-status-label').textContent = response.ok ? 'respuesta recibida' : 'la API reportó un error';
  $('#metric-latency').innerHTML = `${Math.round(elapsed)} <small>ms</small>`;
  $('#metric-type').textContent = contentType.split(';')[0];
  $('#metric-type').title = contentType;
  $('#home-status').textContent = response.ok ? `${response.status} OK` : `HTTP ${response.status}`;
  $('#home-latency').textContent = `Respondió en ${Math.round(elapsed)} ms`;
}

function finishRequest(requestId) {
  if (requestId !== state.requestId) return;
  $('#run-request').disabled = false;
  document.querySelectorAll('.method-tab').forEach((tab) => { tab.disabled = false; });
  setRunButton();
}

function setIndicator(kind, label) {
  const indicator = $('#response-indicator');
  indicator.className = `response-indicator${kind ? ` is-${kind}` : ''}`;
  indicator.innerHTML = `<i></i> ${escapeHtml(label)}`;
}

function showError(message, requestId) {
  if (requestId !== state.requestId) return;
  state.payload = null;
  setIndicator('error', 'ERROR DE API');
  if (state.resource === 'planets') {
    showPlanetError(message);
    $('#home-status').textContent = 'Sin conexión';
    $('#home-latency').textContent = 'No se pudo consultar la API';
    return;
  }
  const detailFailed = state.detailId !== null;
  const selectedCharacter = state.charactersById.get(String(state.detailId));
  setCharacterDetailMode(detailFailed, selectedCharacter?.name ?? '');
  $('#catalog-count').textContent = detailFailed ? 'FICHA NO DISPONIBLE' : 'SIN RESULTADOS';
  $('#catalog-description').textContent = detailFailed ? 'La ficha no se pudo completar' : 'La consulta no se pudo completar';
  $('#catalog-page').textContent = detailFailed ? `ID ${state.detailId}` : '';
  const returnButton = detailFailed
    ? '<button id="back-to-catalog" class="back-button" type="button"><span aria-hidden="true">←</span> Volver a los personajes</button>'
    : '';
  $('#character-content').innerHTML = `<div class="character-placeholder error-placeholder">${returnButton}<span class="placeholder-orb">!</span><strong>${detailFailed ? 'No se pudo abrir la ficha' : 'Algo interrumpió la petición'}</strong><small>${escapeHtml(message)}</small></div>`;
  $('#pagination').hidden = true;
  if (detailFailed) {
    $('#characters-description').textContent = 'La ficha no está disponible en este momento. Puedes volver a la selección.';
    $('#back-to-catalog').addEventListener('click', returnToCatalog);
    state.focusCharacterDetail = false;
  }
  $('#live-status').textContent = message;
  $('#home-status').textContent = 'Sin conexión';
  $('#home-latency').textContent = 'No se pudo consultar la API';
}

function renderResponse(payload, response, elapsed, requestId) {
  if (requestId !== state.requestId) return;
  setMetrics(response, elapsed);
  state.payload = payload;
  $('#json-output').textContent = JSON.stringify(payload, null, 2);
  if (!response.ok || payload?.error) {
    showError(payload?.message ?? payload?.error ?? `Error HTTP ${response.status}`, requestId);
    return;
  }
  setIndicator('success', `${response.status} OK`);
  $('#live-status').textContent = `Respuesta ${response.status} recibida en ${Math.round(elapsed)} milisegundos.`;
  if (state.resource === 'planets') renderPlanets(payload);
  else if (state.detailId !== null) renderCharacterDetail(payload);
  else renderCharacters(payload);
}

function renderNetworkError(error, elapsed, requestId) {
  if (requestId !== state.requestId) return;
  $('#metric-status').textContent = 'SIN RESPUESTA';
  $('#metric-status').className = 'status-error';
  $('#metric-status-label').textContent = 'revisa tu conexión';
  $('#metric-latency').innerHTML = `${Math.round(elapsed)} <small>ms</small>`;
  $('#metric-type').textContent = '—';
  $('#json-output').textContent = JSON.stringify({ error: error.message || 'Error de red' }, null, 2);
  showError('No se pudo conectar con Dragon Ball API. Revisa tu conexión e intenta de nuevo.', requestId);
}

async function runWithAsync() {
  const requestId = ++state.requestId;
  const startedAt = performance.now();
  setPending();
  try {
    const response = await fetch(buildUrl());
    const payload = await response.json();
    renderResponse(payload, response, performance.now() - startedAt, requestId);
  } catch (error) {
    renderNetworkError(error, performance.now() - startedAt, requestId);
  } finally {
    finishRequest(requestId);
  }
}

function runWithPromise() {
  const requestId = ++state.requestId;
  const startedAt = performance.now();
  setPending();
  fetch(buildUrl())
    .then((response) => response.json().then((payload) => ({ response, payload })))
    .then(({ response, payload }) => renderResponse(payload, response, performance.now() - startedAt, requestId))
    .catch((error) => renderNetworkError(error, performance.now() - startedAt, requestId))
    .finally(() => finishRequest(requestId));
}

function runSelectedMethod() {
  if (state.method === 'promise') runWithPromise();
  else runWithAsync();
}

function openCharacter(id) {
  state.resource = 'characters';
  state.detailId = id;
  state.selectedCharacterId = String(id);
  state.focusCharacterDetail = true;
  setActiveView('personajes');
  updateCodeViewer();
  runSelectedMethod();
}

function openPlanet(id) {
  state.resource = 'planets';
  state.detailId = null;
  state.planetDetailId = id;
  state.planetDetailPayload = null;
  setActiveView('planetas');
  updateCodeViewer();
  runSelectedMethod();
}

function returnToPlanets() {
  state.resource = 'planets';
  state.planetDetailId = null;
  updateCodeViewer();
  if (state.planetListPayload) renderPlanets(state.planetListPayload);
  else runSelectedMethod();
}

function navigateToView(view, updateUrl = true) {
  if (!PAGE_NAMES.includes(view)) view = 'inicio';
  if (view === 'planetas') {
    const changedResource = state.resource !== 'planets';
    state.resource = 'planets';
    if (changedResource) state.detailId = null;
    setActiveView(view, updateUrl);
    updateCodeViewer();
    if (state.planetDetailId !== null && state.planetDetailPayload) renderPlanetDetail(state.planetDetailPayload);
    else if (state.planetDetailId === null && state.planetListPayload) renderPlanets(state.planetListPayload);
    else runSelectedMethod();
    return;
  }
  if (view === 'personajes') {
    const changedResource = state.resource !== 'characters';
    state.resource = 'characters';
    if (changedResource) state.detailId = null;
    setActiveView(view, updateUrl);
    updateCodeViewer();
    if (state.detailId !== null) return;
    const cached = cachedCharacterList();
    if (cached) renderCharacters(cached);
    else runSelectedMethod();
    return;
  }
  setActiveView(view, updateUrl);
}

function setCharacterDetailMode(isDetail, characterName = '') {
  const page = $('#personajes');
  const isTenkaichi = state.characterViewMode === 'tenkaichi';
  page.classList.toggle('is-tenkaichi', isTenkaichi);
  page.classList.toggle('is-character-detail', isDetail);
  $('#characters-kicker').textContent = isTenkaichi
    ? (isDetail ? 'FICHA DE COMBATE' : 'TORNEO DE SELECCIÓN')
    : 'CATÁLOGO INTERACTIVO';
  $('#characters-data-label').textContent = isTenkaichi
    ? (isDetail ? 'GUERRERO EN FOCO' : 'ELENCO ACTIVO')
    : 'DATOS EN VIVO';
  $('#search-form').hidden = isDetail;
  document.querySelector('.catalog-toolbar').hidden = isDetail;
  $('#characters-title').textContent = isDetail
    ? (isTenkaichi ? characterName : `Ficha de ${characterName}`)
    : (isTenkaichi ? 'Selección de guerreros' : 'Explora los personajes');
  $('#characters-description').textContent = isDetail
    ? (isTenkaichi ? 'FICHA DE COMBATE · Abre el retrato para explorar su aura y profundidad.' : 'Conoce sus datos y elige una transformación para verla en acción.')
    : (isTenkaichi ? 'Elige un luchador y entra en su ficha sin perder la página del catálogo.' : 'Busca por nombre o combina filtros para encontrar a tu favorito.');
}

function returnToCatalog() {
  state.detailId = null;
  setCharacterDetailMode(false);
  updateCodeViewer();
  const cached = cachedCharacterList();
  if (cached) {
    renderCharacters(cached);
    const selected = [...$('#character-content').querySelectorAll('[data-character-id]')]
      .find((item) => item.dataset.characterId === String(state.selectedCharacterId));
    selected?.focus({ preventScroll: true });
  } else runSelectedMethod();
}

function applySearch(event) {
  event.preventDefault();
  state.resource = 'characters';
  state.name = $('#character-search').value.trim();
  state.race = $('#race-filter').value;
  state.affiliation = $('#affiliation-filter').value;
  state.page = 1;
  state.detailId = null;
  state.selectedCharacterId = null;
  updateCodeViewer();
  runSelectedMethod();
}

function changePage(direction) {
  state.resource = 'characters';
  state.page = Math.max(1, state.page + direction);
  state.detailId = null;
  state.selectedCharacterId = null;
  runSelectedMethod();
}

function applyPlanetSearch(event) {
  event.preventDefault();
  state.resource = 'planets';
  state.planetName = $('#planet-name').value.trim();
  state.planetDestroyed = $('#planet-state').value;
  state.planetPage = 1;
  state.planetDetailId = null;
  state.planetDetailPayload = null;
  updateCodeViewer();
  runSelectedMethod();
}

function changePlanetPage(direction) {
  state.resource = 'planets';
  state.planetPage = Math.max(1, state.planetPage + direction);
  state.planetDetailId = null;
  runSelectedMethod();
}

function updateCodeViewer() {
  const functionSource = state.method === 'async' ? runWithAsync.toString() : runWithPromise.toString();
  $('#code-filename').textContent = state.method === 'async' ? 'fetch-async.js' : 'fetch-promises.js';
  $('#code-output').textContent = `// Petición actual\n// URL: ${buildUrl()}\n\n${functionSource}\n\n${renderResponse.toString()}`;
}

async function copyText(value, label, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = 'Copiado ✓';
    $('#live-status').textContent = `${label} copiado al portapapeles.`;
  } catch {
    button.textContent = 'No disponible';
    $('#live-status').textContent = 'El navegador no permitió copiar al portapapeles.';
  }
  window.setTimeout(() => { button.textContent = original; }, 1400);
}

document.querySelectorAll('[data-view-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigateToView(link.dataset.viewLink);
  });
});
const navToggle = $('#nav-toggle');
const mainNavigation = $('#main-navigation');
function setCompactNavigation(open) {
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  mainNavigation.classList.toggle('is-open', open);
}
navToggle.addEventListener('click', () => {
  setCompactNavigation(navToggle.getAttribute('aria-expanded') !== 'true');
});
mainNavigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setCompactNavigation(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setCompactNavigation(false);
});
window.addEventListener('resize', () => {
  if (window.matchMedia('(min-width: 1101px)').matches) setCompactNavigation(false);
});
document.querySelectorAll('[data-go-view]').forEach((button) => {
  button.addEventListener('click', () => navigateToView(button.dataset.goView));
});
window.addEventListener('hashchange', () => navigateToView(window.location.hash.slice(1), false));
document.querySelectorAll('.method-tab').forEach((tab) => tab.addEventListener('click', () => selectMethod(tab.dataset.method)));
$('#run-request').addEventListener('click', runSelectedMethod);
$('#search-form').addEventListener('submit', applySearch);
$('#prev-page').addEventListener('click', () => changePage(-1));
$('#next-page').addEventListener('click', () => changePage(1));
$('#mode-catalog').addEventListener('click', () => changeCharacterViewMode('catalog'));
$('#mode-tenkaichi').addEventListener('click', () => changeCharacterViewMode('tenkaichi'));
document.addEventListener('keydown', handleTenkaichiArrowKeys);
$('#planet-search-form').addEventListener('submit', applyPlanetSearch);
$('#planet-prev').addEventListener('click', () => changePlanetPage(-1));
$('#planet-next').addEventListener('click', () => changePlanetPage(1));
document.querySelectorAll('.inspector-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    document.querySelectorAll('.inspector-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.inspector-view').forEach((item) => { item.hidden = item.id !== `${view}-view`; });
    if (view === 'code') updateCodeViewer();
  });
});
$('#copy-json').addEventListener('click', (event) => copyText($('#json-output').textContent, 'JSON', event.currentTarget));
$('#copy-code').addEventListener('click', (event) => copyText($('#code-output').textContent, 'Código', event.currentTarget));

$('#close-lightbox').addEventListener('click', () => $('#character-lightbox').close());
$('#character-lightbox').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
$('#lightbox-profile').addEventListener('click', () => {
  const characterId = $('#character-lightbox').dataset.characterId;
  $('#character-lightbox').close();
  if (characterId) openCharacter(characterId);
});
$('#lightbox-image').addEventListener('click', (event) => {
  const card = $('#lightbox-3d-card');
  const zoom = !card.classList.contains('is-zoomed');
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = event.detail === 0 ? 0.5 : (event.clientX - bounds.left) / bounds.width;
  const y = event.detail === 0 ? 0.5 : (event.clientY - bounds.top) / bounds.height;
  setLightboxZoom(zoom, x, y);
});
$('#lightbox-zoom').addEventListener('click', () => {
  const zoom = !$('#lightbox-3d-card').classList.contains('is-zoomed');
  setLightboxZoom(zoom);
});
$('#lightbox-3d-card').addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const card = event.currentTarget;
  if (card.classList.contains('is-zoomed')) return;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  card.style.setProperty('--tilt-x', `${(0.5 - y) * 12}deg`);
  card.style.setProperty('--tilt-y', `${(x - 0.5) * 14}deg`);
  card.style.setProperty('--spot-x', `${x * 100}%`);
  card.style.setProperty('--spot-y', `${y * 100}%`);
});
$('#lightbox-3d-card').addEventListener('pointerleave', (event) => {
  event.currentTarget.style.setProperty('--tilt-x', '0deg');
  event.currentTarget.style.setProperty('--tilt-y', '0deg');
  event.currentTarget.style.setProperty('--spot-x', '50%');
  event.currentTarget.style.setProperty('--spot-y', '50%');
});

const startingView = window.location.hash.slice(1);
if (startingView === 'planetas') state.resource = 'planets';
updateCharacterModeButtons();
setActiveView(PAGE_NAMES.includes(startingView) ? startingView : 'inicio', false);
setRunButton();
updateCodeViewer();
runSelectedMethod();
