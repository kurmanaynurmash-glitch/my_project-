/*
 * Lo-fi radio, generated live with the Web Audio API.
 *
 * It is original music made in the browser (soft electric piano chords, bass, a dusty
 * boom-bap beat with swing, vinyl crackle, optional rain). It is not a recording, so there
 * are no licensing problems. Music only starts after the student presses the button.
 */
(function (root) {
  'use strict';

  var BPM = 74;
  var STEP = 60 / BPM / 4; // one 16th note, seconds
  var SWING = 0.16;        // how late the off-beat 8th notes land

  // Two 4-bar progressions, one chord per bar. Voicings are MIDI notes.
  var PROGRESSION = [
    { bass: 41, notes: [53, 57, 60, 64] },     // Fmaj7
    { bass: 40, notes: [52, 55, 59, 62] },     // Em7
    { bass: 38, notes: [50, 53, 57, 60, 64] }, // Dm9
    { bass: 36, notes: [55, 59, 62, 64] },     // Cmaj9
    { bass: 45, notes: [55, 59, 60, 64] },     // Am9
    { bass: 38, notes: [53, 57, 60, 62] },     // Dm7
    { bass: 43, notes: [53, 59, 62, 64] },     // G13
    { bass: 36, notes: [52, 55, 59, 64] }      // Cmaj7
  ];
  var MELODY_SCALE = [72, 74, 76, 79, 81, 84, 79, 76]; // C major pentatonic, a little octave play
  var KICK = { 0: 1, 6: 0.7, 10: 0.85 };
  var SNARE = { 4: 1, 12: 1 };

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function noiseBuffer(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function crackleBuffer(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var tail = 0;
    for (var i = 0; i < len; i++) {
      if (Math.random() < 0.0009) tail = rnd(0.3, 1) * (Math.random() < 0.5 ? -1 : 1);
      d[i] = tail + (Math.random() * 2 - 1) * 0.02; // pops and a faint hiss
      tail *= 0.82;
    }
    return buf;
  }

  function reverbImpulse(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /* Build the whole signal chain on any (real or offline) AudioContext. */
  function createEngine(ctx) {
    var master = ctx.createGain();
    master.gain.value = 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.25;
    comp.connect(master);
    master.connect(ctx.destination);

    // everything melodic goes through a warm low-pass (the "old tape" sound)
    var tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 2400; tone.Q.value = 0.4;
    tone.connect(comp);

    var verb = ctx.createConvolver();
    verb.buffer = reverbImpulse(ctx, 2.4);
    var verbGain = ctx.createGain();
    verbGain.gain.value = 0.34;
    verb.connect(verbGain); verbGain.connect(tone);

    var keysBus = ctx.createGain(); keysBus.gain.value = 0.9;
    keysBus.connect(tone); keysBus.connect(verb);

    var drumBus = ctx.createGain(); drumBus.gain.value = 0.9;
    var drumTone = ctx.createBiquadFilter();
    drumTone.type = 'lowpass'; drumTone.frequency.value = 3600;
    drumBus.connect(drumTone); drumTone.connect(comp);

    // slow tape wobble shared by all oscillators (detune, in cents)
    var wobble = ctx.createOscillator();
    wobble.frequency.value = 0.4;
    var wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 9;
    wobble.connect(wobbleDepth);
    wobble.start();

    var noise = noiseBuffer(ctx, 2);

    // vinyl crackle, always on
    var crack = ctx.createBufferSource();
    crack.buffer = crackleBuffer(ctx, 5); crack.loop = true;
    var crackHp = ctx.createBiquadFilter(); crackHp.type = 'highpass'; crackHp.frequency.value = 900;
    var crackGain = ctx.createGain(); crackGain.gain.value = 0.05;
    crack.connect(crackHp); crackHp.connect(crackGain); crackGain.connect(comp);
    crack.start();

    // rain bed, optional
    var rain = ctx.createBufferSource();
    rain.buffer = noise; rain.loop = true;
    var rainBp = ctx.createBiquadFilter(); rainBp.type = 'bandpass'; rainBp.frequency.value = 2200; rainBp.Q.value = 0.5;
    var rainLp = ctx.createBiquadFilter(); rainLp.type = 'lowpass'; rainLp.frequency.value = 5200;
    var rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rain.connect(rainBp); rainBp.connect(rainLp); rainLp.connect(rainGain); rainGain.connect(comp);
    rain.start();

    function envelope(g, t, peak, attack, decayTo, decay, release, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(Math.max(decayTo, 0.0002), t + attack + decay);
      g.gain.setTargetAtTime(0.0001, t + dur, release);
    }

    // soft electric-piano note: sine body, quiet triangle bell, slow decay
    function key(t, midi, dur, vel, dest) {
      var f = hz(midi);
      var g = ctx.createGain();
      envelope(g, t, vel, 0.012, vel * 0.45, 0.5, 0.35, dur);
      var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f; o1.detune.value = rnd(-6, 6);
      var o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; o2.detune.value = rnd(-4, 4);
      var g2 = ctx.createGain(); g2.gain.value = 0.1;
      wobbleDepth.connect(o1.detune); wobbleDepth.connect(o2.detune);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest || keysBus);
      var end = t + dur + 2.4;
      o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
      o1.onended = function () { try { wobbleDepth.disconnect(o1.detune); wobbleDepth.disconnect(o2.detune); } catch (e) {} };
    }

    function bass(t, midi, dur, vel) {
      var g = ctx.createGain();
      envelope(g, t, vel, 0.02, vel * 0.6, 0.25, 0.12, dur);
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(midi);
      var o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = hz(midi);
      var g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(comp);
      o.start(t); o2.start(t); o.stop(t + dur + 1); o2.stop(t + dur + 1);
    }

    function kick(t, vel) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.85 * vel, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g); g.connect(drumBus);
      o.start(t); o.stop(t + 0.45);
    }

    function noiseHit(t, hpFreq, peak, decay, type, q) {
      var s = ctx.createBufferSource();
      s.buffer = noise;
      var f = ctx.createBiquadFilter();
      f.type = type || 'highpass'; f.frequency.value = hpFreq; if (q) f.Q.value = q;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      s.connect(f); f.connect(g); g.connect(drumBus);
      s.start(t, Math.random() * 1.5, decay + 0.05);
    }

    function snare(t, vel) {
      noiseHit(t, 1700, 0.32 * vel, 0.2, 'bandpass', 0.7);
      var o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.2);
    }

    function hat(t, vel, open) {
      noiseHit(t, 7000, (open ? 0.1 : 0.075) * vel, open ? 0.16 : 0.045, 'highpass');
    }

    // one 16th-note slot of the song
    function scheduleStep(n, t) {
      var s = n % 128, bar = Math.floor(s / 16), st = s % 16;
      var chord = PROGRESSION[bar];
      var swing = st % 4 === 2 ? SWING * STEP * 2 : 0;
      var human = function () { return rnd(-0.006, 0.006); };
      var at = function (x) { return Math.max(0, x); }; // never schedule before time zero

      if (st === 0 || st === 10) {
        var strum = st === 0 ? 0.034 : 0.02;
        var vel = st === 0 ? 0.16 : 0.1;
        var dur = st === 0 ? STEP * 9 : STEP * 5;
        chord.notes.forEach(function (m, i) { key(at(t + swing + i * strum + human()), m, dur, vel * rnd(0.85, 1.05)); });
      }
      if (st === 0) bass(t, chord.bass, STEP * 6, 0.34);
      if (st === 10) bass(t + swing, chord.bass + (bar % 2 ? 7 : 0), STEP * 4, 0.26);

      // a sparse melody, mostly in the second half of each 2-bar phrase
      if (st % 2 === 0 && bar % 2 === 1 && Math.random() < 0.2) {
        var note = MELODY_SCALE[Math.floor(Math.random() * MELODY_SCALE.length)];
        key(t + swing, note, STEP * 5, 0.07, keysBus);
      }

      if (KICK[st]) kick(at(t + human()), KICK[st] * (st === 0 ? 1 : 0.85));
      if (SNARE[st]) snare(at(t + swing + human()), 0.9);
      if (st % 2 === 0) hat(at(t + swing + human()), st % 4 === 0 ? 0.8 : rnd(0.45, 0.7), st === 14 && bar % 2 === 1);
    }

    return {
      master: master, rainGain: rainGain, scheduleStep: scheduleStep,
      stop: function () {
        [wobble, crack, rain].forEach(function (n) { try { n.stop(); } catch (e) {} });
      }
    };
  }

  /* ---------- live player ---------- */

  var player = { ctx: null, engine: null, timer: null, step: 0, next: 0, volume: 0.6, rain: true, playing: false };

  function level() { return 0.55 * player.volume; } // the master chain is already gentle
  function rainLevel() { return player.rain ? 0.05 + 0.1 * player.volume : 0; }

  function applyLevels(fade) {
    if (!player.engine) return;
    var t = player.ctx.currentTime;
    player.engine.master.gain.cancelScheduledValues(t);
    player.engine.master.gain.setTargetAtTime(level(), t, fade || 0.25);
    player.engine.rainGain.gain.setTargetAtTime(rainLevel(), t, 0.6);
  }

  function start() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return Promise.resolve(false);
    if (player.playing) return Promise.resolve(true);
    try {
      player.ctx = new AC();
      player.engine = createEngine(player.ctx);
    } catch (e) { player.ctx = null; player.engine = null; return Promise.resolve(false); }

    var ctx = player.ctx;
    return Promise.resolve(ctx.resume()).then(function () {
      player.playing = true;
      player.step = 0;
      player.next = ctx.currentTime + 0.15;
      applyLevels(1.2); // gentle fade in
      player.timer = setInterval(function () {
        while (player.next < ctx.currentTime + 0.3) {
          player.engine.scheduleStep(player.step, player.next);
          player.next += STEP;
          player.step++;
        }
      }, 60);
      return true;
    }).catch(function () { return false; });
  }

  function stop() {
    if (!player.playing) return;
    player.playing = false;
    clearInterval(player.timer);
    var ctx = player.ctx, engine = player.engine;
    player.ctx = null; player.engine = null;
    try {
      engine.master.gain.cancelScheduledValues(ctx.currentTime);
      engine.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    } catch (e) {}
    setTimeout(function () { try { engine.stop(); ctx.close(); } catch (e) {} }, 1200);
  }

  function toggle() { return player.playing ? (stop(), Promise.resolve(false)) : start(); }
  function setVolume(v) { player.volume = Math.min(1, Math.max(0, v)); applyLevels(0.15); }
  function setRain(on) { player.rain = !!on; applyLevels(0.15); }

  /* ---------- offline render (used by tests to check the sound is not silent or clipping) ---------- */

  function renderOffline(seconds) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    var rate = 22050;
    var ctx = new OAC(2, Math.floor(rate * seconds), rate);
    var engine = createEngine(ctx);
    engine.master.gain.value = 0.55 * 0.6;
    engine.rainGain.gain.value = 0.08;
    var steps = Math.ceil(seconds / STEP);
    for (var n = 0; n < steps; n++) engine.scheduleStep(n, n * STEP);
    return ctx.startRendering();
  }

  root.LofiMusic = {
    start: start, stop: stop, toggle: toggle, setVolume: setVolume, setRain: setRain,
    isPlaying: function () { return player.playing; },
    isSupported: function () { return !!(root.AudioContext || root.webkitAudioContext); },
    _renderOffline: renderOffline
  };
})(typeof self !== 'undefined' ? self : this);
