/*
 * The cozy night scene in the header: rain on a window, a city, a desk with a lamp,
 * a laptop that shows a plan, a mug with steam, books and a plant.
 * It is drawn here as SVG with deterministic "random" numbers, so it looks the same every time.
 */
(function (root) {
  'use strict';

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svg() {
    var r = rng(7);
    var out = [];
    var i, x, h, w;

    out.push('<svg class="scene" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">');
    out.push('<defs>' +
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150e35"/><stop offset=".55" stop-color="#3a2a7c"/><stop offset=".85" stop-color="#9b5aa6"/><stop offset="1" stop-color="#f0a29b"/></linearGradient>' +
      '<radialGradient id="moonGlow"><stop offset="0" stop-color="#fff3d6" stop-opacity=".55"/><stop offset="1" stop-color="#fff3d6" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="lampLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="screenGlow"><stop offset="0" stop-color="#9d8cff" stop-opacity=".45"/><stop offset="1" stop-color="#9d8cff" stop-opacity="0"/></radialGradient>' +
      '</defs>');

    // sky, stars, moon
    out.push('<rect width="800" height="300" fill="url(#sky)"/>');
    for (i = 0; i < 46; i++) {
      out.push('<circle class="star" cx="' + (r() * 800).toFixed(1) + '" cy="' + (r() * 140).toFixed(1) + '" r="' + (0.6 + r() * 1.2).toFixed(1) + '" fill="#fff" style="animation-delay:' + (-r() * 4).toFixed(2) + 's"/>');
    }
    out.push('<circle cx="650" cy="72" r="96" fill="url(#moonGlow)"/>');
    out.push('<circle cx="650" cy="72" r="27" fill="#fff3d6"/>');
    out.push('<circle cx="641" cy="64" r="5" fill="#f0dfb8"/><circle cx="660" cy="80" r="3.4" fill="#f0dfb8"/><circle cx="657" cy="60" r="2.4" fill="#f0dfb8"/>');

    // two layers of skyline
    function skyline(color, minH, maxH, minW, maxW, windows) {
      var cx = -10;
      while (cx < 810) {
        w = minW + r() * (maxW - minW);
        h = minH + r() * (maxH - minH);
        out.push('<rect x="' + cx.toFixed(1) + '" y="' + (244 - h).toFixed(1) + '" width="' + (w + 1).toFixed(1) + '" height="' + (h + 2).toFixed(1) + '" fill="' + color + '"/>');
        if (windows) {
          for (var wy = 244 - h + 8; wy < 236; wy += 11) {
            for (var wx = cx + 5; wx < cx + w - 5; wx += 9) {
              if (r() < 0.3) out.push('<rect class="win' + (r() < 0.25 ? ' blink' : '') + '" x="' + wx.toFixed(1) + '" y="' + wy.toFixed(1) + '" width="3.4" height="4.6" fill="#ffd98a" style="animation-delay:' + (-r() * 6).toFixed(2) + 's"/>');
            }
          }
        }
        cx += w + 2 + r() * 4;
      }
    }
    skyline('#3a2a73', 30, 96, 26, 52, false);
    skyline('#22164b', 20, 70, 32, 60, true);

    // rain
    out.push('<g class="rain" stroke="#cfd8ff" stroke-width="1.1" stroke-linecap="round" opacity=".55">');
    for (i = 0; i < 44; i++) {
      x = r() * 820;
      out.push('<line class="drop" x1="' + x.toFixed(1) + '" y1="-20" x2="' + (x - 3).toFixed(1) + '" y2="-8" style="animation-duration:' + (0.8 + r() * 0.9).toFixed(2) + 's;animation-delay:' + (-r() * 2).toFixed(2) + 's"/>');
    }
    out.push('</g>');

    // window frame
    out.push('<g fill="none" stroke="#0f0a26" stroke-linecap="square">' +
      '<rect x="12" y="8" width="776" height="236" rx="10" stroke-width="14"/>' +
      '<line x1="400" y1="8" x2="400" y2="244" stroke-width="8"/>' +
      '<line x1="12" y1="128" x2="788" y2="128" stroke-width="6"/></g>');

    // fairy lights along the top of the window
    var pts = [];
    for (x = 36; x <= 764; x += 52) pts.push([x, 26 + 13 * Math.sin((x / 800) * Math.PI * 5)]);
    out.push('<path d="M' + pts.map(function (p) { return p[0] + ' ' + p[1].toFixed(1); }).join(' L') + '" fill="none" stroke="#0f0a26" stroke-width="1.4"/>');
    var bulb = ['#ffd166', '#f4a6c0', '#7fd1c7', '#b8a9ff'];
    pts.forEach(function (p, k) {
      out.push('<circle class="bulb" cx="' + p[0] + '" cy="' + (p[1] + 4).toFixed(1) + '" r="3.4" fill="' + bulb[k % 4] + '" style="animation-delay:' + (-r() * 3).toFixed(2) + 's"/>');
    });

    // desk
    out.push('<rect x="0" y="244" width="800" height="56" fill="#35275a"/>');
    out.push('<rect x="0" y="244" width="800" height="3" fill="#6a529c"/>');
    out.push('<rect x="0" y="262" width="800" height="38" fill="#2a1f49"/>');

    // lamp (left of centre so it stays visible on phones)
    out.push('<g class="lamp">' +
      '<polygon class="lampcone" points="256,172 300,164 345,246 206,246" fill="url(#lampLight)"/>' +
      '<ellipse cx="230" cy="243" rx="26" ry="5" fill="#241a45"/>' +
      '<path d="M230 240 L230 192 L262 154" fill="none" stroke="#9a86d6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="230" cy="192" r="4.5" fill="#b9a8f2"/>' +
      '<path d="M246 148 L286 138 L295 168 L254 177 Z" fill="#ffb86b"/>' +
      '<path d="M246 148 L286 138 L288 146 L248 156 Z" fill="#ffd9a0"/></g>');

    // notebook and pencil in the lamp light
    out.push('<rect x="150" y="238" width="62" height="6" rx="1.5" fill="#f2e4c9"/><rect x="156" y="236" width="50" height="3" rx="1" fill="#e6d3b0"/>');
    out.push('<rect x="176" y="232" width="36" height="3" rx="1.5" fill="#ffd166" transform="rotate(-8 176 233)"/>');

    // mug with steam
    out.push('<g><rect x="296" y="222" width="25" height="22" rx="4" fill="#f2c8a8"/>' +
      '<path d="M321 227 q10 0 10 8 q0 8 -10 8" fill="none" stroke="#f2c8a8" stroke-width="4"/>' +
      '<g class="steam" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6">' +
      '<path class="s1" d="M304 216 q-5 -8 0 -15 q5 -7 0 -14"/><path class="s2" d="M314 216 q-5 -8 0 -15 q5 -7 0 -14"/></g></g>');

    // laptop showing a plan
    out.push('<ellipse cx="402" cy="212" rx="120" ry="64" fill="url(#screenGlow)"/>');
    out.push('<g><path d="M338 244 L466 244 L458 236 L346 236 Z" fill="#5b4a8f"/>' +
      '<rect x="347" y="158" width="110" height="78" rx="6" fill="#201848" stroke="#7d68c0" stroke-width="2"/>' +
      '<rect x="355" y="166" width="94" height="62" rx="3" fill="#2d2566"/>' +
      '<rect class="plan p1" x="361" y="174" width="52" height="7" rx="3.5" fill="#7fd1c7"/>' +
      '<rect class="plan p2" x="361" y="187" width="70" height="7" rx="3.5" fill="#ffb4a2"/>' +
      '<rect class="plan p3" x="361" y="200" width="38" height="7" rx="3.5" fill="#b8a9ff"/>' +
      '<rect class="plan p4" x="361" y="213" width="60" height="7" rx="3.5" fill="#ffd166"/>' +
      '<circle cx="437" cy="177.5" r="4" fill="none" stroke="#7fd1c7" stroke-width="1.6"/><path d="M435 177.5 l1.6 1.8 l3 -3.4" fill="none" stroke="#7fd1c7" stroke-width="1.4"/></g>');

    // books
    out.push('<rect x="486" y="232" width="62" height="12" rx="2" fill="#7fd1c7"/>' +
      '<rect x="492" y="221" width="52" height="11" rx="2" fill="#f4a6c0"/>' +
      '<rect x="488" y="211" width="58" height="10" rx="2" fill="#ffd166"/>' +
      '<rect x="496" y="224" width="36" height="2" fill="#ffffff" opacity=".35"/>');

    // plant
    out.push('<g class="plant"><path d="M562 244 L598 244 L592 218 L568 218 Z" fill="#c97b63"/>' +
      '<rect x="565" y="214" width="30" height="6" rx="2" fill="#d98e75"/>' +
      [-52, -26, 0, 26, 52].map(function (a, k) {
        return '<ellipse cx="580" cy="192" rx="7" ry="24" fill="' + (k % 2 ? '#6fd1a8' : '#4fae8b') + '" transform="rotate(' + a + ' 580 214)"/>';
      }).join('') + '</g>');

    out.push('</svg>');
    return out.join('');
  }

  root.StudyScene = { svg: svg };
})(typeof self !== 'undefined' ? self : this);
