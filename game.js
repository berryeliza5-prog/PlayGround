(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  const islands = [
    { name: 'Shelter Cove', kicker: 'LAND AHEAD · 47° 31′ N', title: 'The drowned coast', desc: 'A dark line of pines breaks the horizon. Fresh tracks lead inland.', coord: '47° 31′ N  08° 24′ W' },
    { name: 'Greyhaven', kicker: 'GREYHAVEN · 46° 08′ N', title: 'Where the village slept', desc: 'A fishing village leans into the tide. Something moved behind the chapel.', coord: '46° 08′ N  07° 51′ W' },
    { name: 'Saint Oran', kicker: 'SAINT ORAN · 44° 42′ N', title: 'The green silence', desc: 'The island is overgrown, and the old lighthouse still turns in the wind.', coord: '44° 42′ N  06° 39′ W' },
    { name: 'Signal Rock', kicker: 'SIGNAL ROCK · 43° 10′ N', title: 'One last transmission', desc: 'A radio mast cuts the clouds. If anyone is listening, this is the place.', coord: '43° 10′ N  05° 12′ W' }
  ];
  const crew = [
    { name: 'Maya Chen', role: 'CHIEF ENGINEER', icon: '⚙', condition: 'steady', hp: 100 },
    { name: 'Ilyan Petrov', role: 'SONAR TECH', icon: '⌁', condition: 'steady', hp: 100 },
    { name: 'Ruth Okafor', role: 'MEDIC', icon: '✚', condition: 'steady', hp: 100 },
    { name: 'Tomas Vale', role: 'DECKHAND', icon: '⌖', condition: 'steady', hp: 100 }
  ];
  const state = {
    day: 1, turns: 0, mode: 'sea', island: -1, nextIsland: 0,
    food: 38, water: 34, fuel: 8, scrap: 1, medkits: 2,
    captainHp: 100, signal: 12, journal: [], visited: [], active: true,
    weather: 'LOW CLOUD · CALM SEA', toastTimer: 0, sound: true
  };
  let W = 800, H = 450, tick = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  function log(text) {
    state.journal.unshift({ day: state.day, text });
    state.journal = state.journal.slice(0, 12);
    renderJournal();
  }
  function toast(text) {
    const el = $('toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function setScene() {
    if (state.mode === 'sea') {
      if (state.nextIsland < islands.length) {
        $('coordinates').textContent = state.nextIsland === 0 ? '47° 31′ N  08° 24′ W' : islands[state.nextIsland].coord;
        $('sceneKicker').textContent = state.nextIsland ? 'COURSE SET · ' + islands[state.nextIsland].name.toUpperCase() : 'OPEN WATER';
        $('sceneTitle').textContent = state.nextIsland ? 'The water remembers' : 'The drowned coast';
        $('sceneDesc').textContent = state.nextIsland ? 'Another shore waits beyond the mist. The crew are quieter now.' : 'The old world is quiet beneath the waves. Somewhere ahead, a radio still answers.';
        $('progressText').textContent = state.nextIsland < 3 ? `ROUTE ${String(state.nextIsland + 1).padStart(2, '0')} / 04 · ${islands[state.nextIsland].name.toUpperCase()}` : 'FINAL ROUTE · SIGNAL ROCK';
      }
      $('sceneKicker').textContent = state.nextIsland >= islands.length ? 'SIGNAL ROCK · THE FINAL SHORE' : $('sceneKicker').textContent;
      if (state.nextIsland >= islands.length) { $('sceneTitle').textContent = 'The last horizon'; $('sceneDesc').textContent = 'No more shores remain. The mast on Signal Rock is your final chance.'; $('coordinates').textContent = islands[3].coord; }
      $('actionHeading').textContent = state.nextIsland >= islands.length ? 'There is nowhere else to go.' : 'Keep the boat moving.';
      $('statusText').textContent = 'UNDERWAY';
    } else {
      const island = islands[state.island];
      $('coordinates').textContent = island.coord; $('sceneKicker').textContent = island.kicker;
      $('sceneTitle').textContent = island.title; $('sceneDesc').textContent = island.desc;
      $('progressText').textContent = state.island === 3 ? 'FINAL OBJECTIVE · RAISE THE BEACON' : `SHORE LEAVE · ${island.name.toUpperCase()}`;
      $('actionHeading').textContent = state.island === 3 ? 'Make the last signal count.' : 'Take only what you can carry.';
      $('statusText').textContent = 'SHORE LEAVE';
    }
    $('progressBar').style.width = state.mode === 'island' ? '100%' : `${Math.max(8, 24 + state.nextIsland * 20)}%`;
    $('weatherIcon').textContent = state.day % 5 === 0 ? '☂' : '☁';
    $('weatherText').textContent = state.day % 5 === 0 ? 'SQUALL LINE · ROUGH SEA' : state.day % 3 === 0 ? 'COLD FRONT · SWELL' : 'LOW CLOUD · CALM SEA';
    drawActions(); drawCanvas();
  }
  function action(label, desc, icon, key, fn, disabled = false) {
    return `<button class="action-btn" data-key="${key}" ${disabled ? 'disabled' : ''}><span class="action-top"><span class="action-icon">${icon}</span><span class="action-key">[${key}]</span></span><span class="action-name">${label}</span><span class="action-desc">${desc}</span></button>`;
  }
  function drawActions() {
    let html;
    if (state.mode === 'island') {
      html = action('Hunt the ridgeline', 'More food · risk of exposure', '⌖', 1, 'hunt')
        + action('Forage the shore', 'Food & clean water', '♧', 2, 'forage')
        + action('Search the ruins', 'Parts · medical stores', '▧', 3, 'salvage')
        + action('Return to Seawraith', 'Leave the island', '↶', 4, 'return');
      if (state.island === 3) html = action('Raise the beacon', `Requires 55% signal · now ${state.signal}%`, '⌁', 1, 'beacon') + action('Hunt the ridgeline', 'More food · risk of exposure', '⌖', 2, 'hunt') + action('Forage the shore', 'Food & clean water', '♧', 3, 'forage') + action('Return to Seawraith', 'Tune the radio at sea', '↶', 4, 'return');
    } else {
      const atEnd = state.nextIsland >= islands.length;
      html = action(atEnd ? 'Go ashore' : `Dive for ${islands[state.nextIsland].name}`, atEnd ? 'Reach Signal Rock' : 'Burns 1 unit of diesel', '↗', 1, atEnd ? 'finalShore' : 'travel', !atEnd && state.fuel < 1)
        + action('Tune the shortwave', 'Improve your chance of rescue', '⌁', 2, 'radio')
        + action('Rest & ration', 'Recover strength · spend supplies', '◷', 3, 'rest')
        + action(state.medkits > 0 ? 'Treat the sick' : 'Medical stores empty', state.medkits ? 'Uses 1 medical kit' : 'Salvage a kit on shore', '✚', 4, 'treat', state.medkits < 1 || !crew.some(c => c.condition === 'sick' || c.condition === 'weak'));
    }
    $('actionGrid').innerHTML = html;
    $('actionGrid').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => perform(btn.dataset.key)));
  }
  function perform(key) {
    if (!state.active) return;
    if (key === 'travel' || key === 'finalShore') {
      if (state.fuel < 1 && key === 'travel') return toast('Not enough diesel to reach the next island.');
      if (key === 'travel') { state.fuel--; state.island = state.nextIsland; state.visited.push(state.island); }
      else { state.island = 3; state.visited.push(3); }
      state.mode = 'island'; advance(`The Seawraith surfaces off ${islands[state.island].name}.`); log(`Landfall at ${islands[state.island].name}. The crew went ashore.`); setScene(); return;
    }
    if (key === 'return') {
      state.mode = 'sea'; state.nextIsland = Math.max(state.nextIsland, state.island + 1);
      advance(`Back aboard. ${islands[state.island].name} shrinks behind you.`); log(`We left ${islands[state.island].name} before dark.`); setScene(); return;
    }
    if (key === 'hunt') {
      const gained = rand(7, 12); state.food += gained;
      if (Math.random() < 0.25 + state.day * 0.008) {
        const victim = randomCrew();
        if (victim) { victim.condition = 'sick'; victim.hp = Math.max(25, victim.hp - 20); log(`A wounded animal bit ${victim.name}. The fever came on fast.`); toast(`${victim.name} was exposed. Treat them before the infection worsens.`); }
        else { state.captainHp = Math.max(20, state.captainHp - 22); toast('The infected animal caught you. Your wound is burning.'); }
      } else toast(`Clean game! +${gained} provisions. The crew eat well tonight.`);
      advance('The hunt brings food, but the treeline is never quiet.'); setScene(); return;
    }
    if (key === 'forage') {
      const f = rand(3, 6), w = rand(2, 4); state.food += f; state.water += w;
      toast(`Foraged +${f} provisions and +${w} fresh water.`);
      advance('Berries, roots, and rainwater. No tracks in the mud.'); setScene(); return;
    }
    if (key === 'salvage') {
      const roll = Math.random(); let message;
      if (roll < .42) { const amount = rand(2, 4); state.scrap += amount; state.fuel += rand(0, 2); message = `Found ${amount} useful parts and a little diesel.`; }
      else if (roll < .78) { const amount = rand(2, 4); state.medkits++; state.water += amount; message = `A sealed first-aid tin and ${amount} bottles of water.`; }
      else { state.signal = clamp(state.signal + 15, 0, 100); state.food += 3; message = 'A portable antenna still works. Shortwave signal strengthened.'; }
      toast(message); log(message); advance('The abandoned places give up their last useful things.'); setScene(); return;
    }
    if (key === 'radio') {
      const gain = rand(7, 13); state.signal = clamp(state.signal + gain, 0, 100);
      const messages = ['...anyone on this frequency...','...shoreline is lost... do not come...','...if you can hear us, keep the light...','...this is the last safe water...','...the animals came first... then the fever...'];
      $('radioText').textContent = messages[rand(0, messages.length - 1)];
      toast(`A voice through the static. Signal strength +${gain}%.`);
      advance('The shortwave coughs up a voice, then the familiar hiss.'); setScene(); return;
    }
    if (key === 'rest') {
      state.captainHp = clamp(state.captainHp + 13, 0, 100);
      crew.forEach(c => { if (c.condition === 'steady') c.hp = clamp(c.hp + 4, 0, 100); });
      advance('You sleep in your clothes, one hand on the radio.'); toast('A little rest. You feel steadier.'); setScene(); return;
    }
    if (key === 'treat') {
      const patient = crew.find(c => c.condition === 'sick' || c.condition === 'weak');
      if (!patient || state.medkits < 1) return toast('No medical supplies available.');
      state.medkits--; patient.condition = 'steady'; patient.hp = clamp(patient.hp + 38, 40, 100);
      log(`Ruth treated ${patient.name}. The fever broke, for now.`); toast(`${patient.name} is stable. Medical kits left: ${state.medkits}.`);
      advance('Ruth makes the rounds in the narrow passageways.'); setScene(); return;
    }
    if (key === 'beacon') {
      if (state.signal < 55) return toast('Signal too weak to raise the beacon. Return to the Seawraith and tune the shortwave first.');
      state.signal = clamp(state.signal + 30, 0, 100);
      $('radioText').textContent = '...SEAWRAITH... WE HEAR YOU...';
      advance('The beacon throws your call out over the black water.');
      log('The mast is lit. Someone answered. The world is not entirely empty.');
      finish(true); return;
    }
  }
  function randomCrew() {
    const able = crew.filter(c => c.condition === 'steady');
    return able.length ? able[rand(0, able.length - 1)] : null;
  }
  function advance(flavor) {
    state.turns++; state.day++;
    const living = crew.filter(c => c.condition !== 'dead').length;
    state.food = Math.max(0, state.food - Math.max(1, living));
    state.water = Math.max(0, state.water - Math.max(1, living));
    if (state.food === 0 || state.water === 0) {
      const victim = randomCrew();
      if (victim) { victim.hp -= 18; victim.condition = victim.hp < 40 ? 'sick' : 'weak'; }
      state.captainHp -= 13;
      toast(state.food === 0 && state.water === 0 ? 'No food or water. The crew are fading fast.' : state.food === 0 ? 'The crew are starving. Find food.' : 'The water stores are empty. Find fresh water.');
    }
    for (const c of crew) {
      if (c.condition === 'dead') continue;
      if (c.condition === 'sick') {
        c.hp -= 14;
        if (c.hp <= 0) { c.condition = 'dead'; log(`${c.name} died in the night. Ruth covered them with a blanket.`); toast(`${c.name} is gone.`); }
      } else if (c.condition === 'weak' && Math.random() < .18) c.condition = 'sick';
      if (c.hp <= 0 && c.condition !== 'dead') { c.condition = 'dead'; log(`${c.name} did not wake up.`); }
    }
    if (state.captainHp <= 0) { finish(false); return; }
    if (!crew.some(c => c.condition !== 'dead')) { log('There is no one left below deck. Just you and the sea.'); }
    $('dayNum').textContent = String(state.day).padStart(2, '0'); $('turnNum').textContent = String(state.turns).padStart(2, '0');
    if (state.day === 5 || state.day === 9 || state.day === 13) {
      const sick = randomCrew();
      if (sick && Math.random() < .4) { sick.condition = 'sick'; sick.hp = Math.min(sick.hp, 72); log(`${sick.name} woke with a fever. The virus is in the water, the soil, everywhere.`); }
    }
    if (state.day === 6) log('The mainland went dark on the charts. We are alone out here.');
    if (state.day === 10) log('Tomas says he saw a deer watching from the treeline. Its eyes were milky.');
    if (state.day === 15) log('The radio tower is our last chance. No one has answered in days.');
    render();
  }
  function finish(win) {
    state.active = false;
    $('endingMark').textContent = win ? '◈' : '✕';
    $('endingEyebrow').textContent = win ? 'TRANSMISSION RECEIVED' : 'FINAL ENTRY · DAY ' + String(state.day).padStart(2, '0');
    $('endingTitle').textContent = win ? 'Someone heard you.' : 'The tide takes the last.';
    const survivors = crew.filter(c => c.condition !== 'dead').length;
    $('endingText').textContent = win
      ? `A reply cuts through the static. You made it to Signal Rock on day ${state.day}. The Seawraith's crew ${survivors ? `— ${survivors} still alive —` : 'is gone, but you are still here.'} will not have to face the dark alone.`
      : 'Your log ends here, somewhere beyond the charted coast. The Seawraith will drift on without its captain.';
    $('endingStats').innerHTML = `<span><b>${state.day}</b>DAYS ADRIFT</span><span><b>${survivors}</b>CREW LEFT</span><span><b>${state.visited.length}</b>SHORES FOUND</span>`;
    $('modal').classList.add('open'); $('modal').setAttribute('aria-hidden', 'false');
  }
  function render() {
    $('foodVal').textContent = state.food; $('waterVal').textContent = state.water; $('fuelVal').textContent = state.fuel;
    meter('food', state.food, 42); meter('water', state.water, 38); meter('fuel', state.fuel, 12);
    $('crewCount').textContent = crew.filter(c => c.condition !== 'dead').length;
    $('signalStrength').textContent = state.signal + '%';
    const sick = crew.filter(c => c.condition === 'sick').length;
    $('crewNote').textContent = sick ? `${sick} crew ${sick === 1 ? 'member needs' : 'members need'} medical attention.` : crew.every(c => c.condition === 'dead') ? 'Only you remain.' : 'Everyone is holding on.';
    renderCrew(); renderJournal(); drawActions();
  }
  function meter(name, value, max) {
    const el = $(`${name}Meter`); const pct = clamp(value / max * 100, 0, 100); el.style.width = `${pct}%`; el.classList.toggle('low', pct < 24);
    const hints = { food: value < 6 ? 'CRITICAL · the crew are starving' : `${Math.ceil(value / Math.max(1, crew.filter(c => c.condition !== 'dead').length))} days of rations`, water: value < 6 ? 'CRITICAL · find fresh water' : 'Essential · cannot be skipped', fuel: value < 2 ? 'CRITICAL · stranded without diesel' : `${value} units · use sparingly` };
    $(`${name}Hint`).textContent = hints[name];
  }
  function renderCrew() {
    $('crewList').innerHTML = crew.map(c => {
      const stateName = c.condition === 'steady' ? 'STEADY' : c.condition === 'dead' ? 'LOST' : c.condition.toUpperCase();
      const cls = c.condition === 'sick' || c.condition === 'weak' ? 'warn' : c.condition === 'dead' ? 'sick' : '';
      return `<div class="crew-person" style="${c.condition === 'dead' ? 'opacity:.38' : ''}"><div class="avatar">${c.condition === 'dead' ? '†' : c.icon}</div><div><div class="person-name">${c.name}</div><div class="person-role">${c.role}</div></div><div class="person-state ${cls}">${stateName}</div></div>`;
    }).join('');
  }
  function renderJournal() {
    $('logCount').textContent = String(state.journal.length).padStart(2, '0');
    $('journal').innerHTML = state.journal.map(e => `<div class="journal-entry"><time>DAY ${String(e.day).padStart(2, '0')}</time>${e.text}</div>`).join('');
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawCanvas();
  }
  function drawCanvas() {
    if (!W || !H) return;
    const c = ctx, w = W, h = H, islandMode = state.mode === 'island';
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#38575a'); sky.addColorStop(.52, '#71918a'); sky.addColorStop(1, '#28565a');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    // Cloud banks and a pale, cold sun
    c.fillStyle = '#d7d2b988'; c.beginPath(); c.arc(w * .77, h * .22, Math.min(w, h) * .075, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c1c5b344';
    for (let i = 0; i < 5; i++) { let x = ((i * 181 + tick * (2 + i % 2)) % (w + 180)) - 90; let y = h * (.12 + (i % 3) * .09); c.beginPath(); c.ellipse(x, y, 56 + i * 7, 9 + i % 3 * 3, 0, 0, Math.PI * 2); c.fill(); }
    if (islandMode) drawIsland(c, w, h); else drawSea(c, w, h);
    // film grain flecks, sparse and subtle
    c.fillStyle = '#d9e3ce14'; for (let i = 0; i < 55; i++) { let x = (i * 127 + tick * 4) % w, y = (i * 61) % h; c.fillRect(x, y, 1, 1); }
  }
  function drawSea(c, w, h) {
    c.fillStyle = '#597d77'; c.beginPath(); c.moveTo(0, h * .51); c.quadraticCurveTo(w * .48, h * .46, w, h * .52); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    // distant coast, broken silhouettes
    c.fillStyle = '#395c55'; c.beginPath(); c.moveTo(w * .56, h * .52); c.lineTo(w * .60, h * .43); c.lineTo(w * .63, h * .45); c.lineTo(w * .67, h * .37); c.lineTo(w * .71, h * .44); c.lineTo(w * .76, h * .39); c.lineTo(w * .80, h * .46); c.lineTo(w * .85, h * .43); c.lineTo(w * .90, h * .49); c.lineTo(w, h * .49); c.lineTo(w, h * .56); c.fill();
    c.fillStyle = '#294a48'; for (let i = 0; i < 12; i++) { const x = w * (.62 + i * .028); const y = h * (.43 + Math.sin(i * 2) * .025); c.beginPath(); c.moveTo(x, y + 22); c.lineTo(x + 8, y - 10 - (i % 3) * 5); c.lineTo(x + 17, y + 22); c.fill(); }
    // sea light and animated tide bands
    c.lineWidth = 1; for (let i = 0; i < 19; i++) { const y = h * (.58 + i * .026), span = w * (.12 + ((i * 37) % 70) / 100); const x = (i * 91 + tick * (8 + i % 4)) % (w + span) - span / 2; c.strokeStyle = i % 3 ? '#b1c8b32e' : '#d0d0a633'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + span * .4, y - 2, x + span, y); c.stroke(); }
    // The Seawraith
    const sx = w * .41, sy = h * .64;
    c.fillStyle = '#182d32'; c.beginPath(); c.moveTo(sx - 91, sy); c.quadraticCurveTo(sx - 82, sy + 22, sx - 48, sy + 27); c.lineTo(sx + 68, sy + 27); c.quadraticCurveTo(sx + 90, sy + 17, sx + 96, sy); c.lineTo(sx - 91, sy); c.fill();
    c.fillStyle = '#405b59'; c.beginPath(); c.moveTo(sx - 63, sy - 1); c.lineTo(sx - 44, sy - 15); c.lineTo(sx + 30, sy - 15); c.lineTo(sx + 48, sy - 1); c.fill();
    c.fillStyle = '#7d8f81'; c.fillRect(sx - 9, sy - 26, 4, 12); c.fillRect(sx - 7, sy - 28, 1, 6);
    c.strokeStyle = '#d2d4b8aa'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx - 72, sy + 8); c.lineTo(sx + 65, sy + 8); c.stroke();
    c.fillStyle = '#d6c39b'; c.fillRect(sx + 30, sy + 4, 3, 3);
    // foreground waves
    c.strokeStyle = '#b4c8b424'; for (let i = 0; i < 12; i++) { let x = (i * 123 + tick * 13) % (w + 70) - 35, y = h * (.78 + (i % 4) * .045); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 20, y - 4, x + 47, y); c.stroke(); }
  }
  function drawIsland(c, w, h) {
    const horizon = h * .53;
    c.fillStyle = '#365953'; c.beginPath(); c.moveTo(0, horizon + 16); c.lineTo(0, h * .43); c.quadraticCurveTo(w * .24, h * .35, w * .45, h * .45); c.quadraticCurveTo(w * .74, h * .53, w, h * .4); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    // beach and island rise
    c.fillStyle = '#958f6f'; c.beginPath(); c.moveTo(0, h * .72); c.quadraticCurveTo(w * .25, h * .63, w * .47, h * .69); c.quadraticCurveTo(w * .73, h * .77, w, h * .62); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    c.fillStyle = '#a4a080'; c.beginPath(); c.moveTo(0, h * .81); c.quadraticCurveTo(w * .32, h * .70, w * .59, h * .80); c.quadraticCurveTo(w * .78, h * .88, w, h * .76); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    // dark evergreen silhouettes
    const shift = state.island * 19;
    for (let i = 0; i < 17; i++) {
      const x = ((i * 83 + shift) % (w + 50)) - 25, base = h * (.62 + (i % 4) * .017), height = h * (.13 + (i % 5) * .028);
      c.fillStyle = i % 3 ? '#25483f' : '#304e43'; c.beginPath(); c.moveTo(x, base); c.lineTo(x + 16, base - height * .48); c.lineTo(x + 5, base - height * .44); c.lineTo(x + 22, base - height); c.lineTo(x + 40, base - height * .36); c.lineTo(x + 30, base - height * .40); c.lineTo(x + 47, base); c.fill();
      c.fillStyle = '#413f32'; c.fillRect(x + 21, base - 4, 4, 11);
    }
    // distant ruined chapel / island-specific landmark
    if (state.island === 1 || state.island === 3) {
      const x = w * .71, y = h * .57, scale = state.island === 3 ? 1.15 : 1;
      c.fillStyle = '#58594c'; c.fillRect(x, y - 46 * scale, 41 * scale, 46 * scale);
      c.fillStyle = '#46493f'; c.beginPath(); c.moveTo(x - 5, y - 46 * scale); c.lineTo(x + 20 * scale, y - 66 * scale); c.lineTo(x + 46 * scale, y - 46 * scale); c.fill();
      c.fillStyle = '#d4a875'; c.fillRect(x + 16 * scale, y - 25 * scale, 7 * scale, 11 * scale);
      if (state.island === 3) { c.strokeStyle = '#687870'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 20, y - 65); c.lineTo(x + 20, y - 116); c.moveTo(x + 3, y - 107); c.lineTo(x + 37, y - 107); c.stroke(); c.fillStyle = '#e8b36c'; c.beginPath(); c.arc(x + 20, y - 116, 5, 0, 7); c.fill(); }
    }
    // tide foam lines
    c.strokeStyle = '#d2d7bd77'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const x = (i * 139 + tick * 5) % (w + 80) - 40, y = h * (.75 + (i % 3) * .07); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 25, y - 6, x + 56, y); c.stroke(); }
    // a lone animal silhouette, watching from the treeline
    const ax = w * (.3 + (state.island % 3) * .16), ay = h * .65;
    c.fillStyle = '#39433a'; c.beginPath(); c.ellipse(ax, ay, 12, 6, -.12, 0, Math.PI * 2); c.fill();
    c.fillRect(ax + 7, ay - 8, 3, 9); c.beginPath(); c.arc(ax + 10, ay - 10, 4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#c5a374'; c.lineWidth = 1; c.beginPath(); c.moveTo(ax + 9, ay - 14); c.lineTo(ax + 6, ay - 20); c.moveTo(ax + 12, ay - 14); c.lineTo(ax + 16, ay - 20); c.stroke();
    c.fillStyle = '#d36e58'; c.fillRect(ax + 11, ay - 11, 2, 1);
  }
  function animate() { tick += .3; drawCanvas(); requestAnimationFrame(animate); }
  $('restartBtn').addEventListener('click', () => location.reload());
  $('soundBtn').addEventListener('click', (e) => { state.sound = !state.sound; e.currentTarget.textContent = state.sound ? '♫' : '♪'; e.currentTarget.style.color = state.sound ? '#82989b' : '#d8a56b'; toast(state.sound ? 'Radio monitoring on.' : 'Radio monitoring muted.'); });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '4' && !e.repeat && state.active) {
      const button = $('actionGrid').querySelector(`[data-key="${e.key}"]`); if (button && !button.disabled) button.click();
    }
  });
  $('dayNum').textContent = String(state.day).padStart(2, '0'); $('turnNum').textContent = '00';
  log('The Seawraith surfaced at dawn. The world above is empty.');
  render(); setScene(); resize(); animate();
})();
