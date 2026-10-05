/* Progress tracker + notes. Everything is stored in this browser's localStorage.
   NOTE: localStorage is per address, so always open the site at the same
   address (the `study` launcher fixes it to http://127.0.0.1:8000). */
(function () {
  var STORE = "asab-study-v1";
  var script = document.currentScript;
  var root = new URL("../", script.src);            // site root, e.g. http://127.0.0.1:8000/

  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE)); if (s && typeof s === "object") return s; } catch (e) {}
    return { done: {}, notes: {}, last: null };
  }
  function save(state) {
    try { localStorage.setItem(STORE, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function keyFor(pathname) {
    var p = decodeURIComponent(pathname);
    if (p.indexOf(root.pathname) === 0) p = p.slice(root.pathname.length);
    p = p.replace(/index\.html$/, "");
    if (p && p.slice(-1) !== "/") p += "/";
    return p;
  }

  var state = load();
  state.done = state.done || {}; state.notes = state.notes || {};

  /* ---- sidebar check marks ---- */
  function markNav() {
    document.querySelectorAll("a.md-nav__link[href]").forEach(function (a) {
      var u; try { u = new URL(a.href, location.href); } catch (e) { return; }
      if (state.done[keyFor(u.pathname)]) a.classList.add("is-done");
    });
  }

  /* ---- tools at the bottom of week/gate pages ---- */
  function buildTools() {
    var box = document.querySelector(".study-tools");
    if (!box) return;
    var key = keyFor(location.pathname);
    state.last = key; save(state);

    var btn = document.createElement("button");
    function paint() {
      var done = !!state.done[key];
      btn.textContent = done ? "\u2713 Completed (click to undo)" : "Mark as complete";
      btn.className = done ? "is-done" : "";
    }
    btn.addEventListener("click", function () {
      if (state.done[key]) delete state.done[key]; else state.done[key] = Date.now();
      save(state); paint(); markNav();
    });
    paint();

    var label = document.createElement("label");
    label.textContent = "Your notes for this page";
    label.setAttribute("for", "study-notes");
    var ta = document.createElement("textarea");
    ta.id = "study-notes";
    ta.placeholder = "Commands you ran, results, questions to revisit...";
    ta.value = state.notes[key] || "";
    var timer;
    ta.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (ta.value) state.notes[key] = ta.value; else delete state.notes[key];
        save(state);
      }, 400);
    });
    var hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Saved automatically in this browser only. Use the export button on the home page to back up.";

    box.appendChild(btn); box.appendChild(label); box.appendChild(ta); box.appendChild(hint);
  }

  /* ---- home page progress panel ---- */
  function buildHome() {
    var panel = document.getElementById("progress-panel");
    if (!panel) return;
    fetch(new URL("assets/manifest.json", root)).then(function (r) { return r.json(); }).then(function (manifest) {
      var totals = {}, done = {}, all = 0, allDone = 0, titleByKey = {};
      manifest.forEach(function (p) {
        titleByKey[p.key] = p.title;
        totals[p.volume] = (totals[p.volume] || 0) + 1;
        all++;
        if (state.done[p.key]) { done[p.volume] = (done[p.volume] || 0) + 1; allDone++; }
      });
      function bar(label, d, t) {
        var pct = t ? Math.round(100 * d / t) : 0;
        return '<div class="row"><span>' + label + '</span><span>' + d + ' / ' + t + ' (' + pct + '%)</span></div>' +
               '<div class="bar"><span style="width:' + pct + '%"></span></div>';
      }
      var html = "<h2>Your progress</h2>" + bar("Overall (weeks and gates)", allDone, all);
      Object.keys(totals).sort().forEach(function (v) { html += bar("Volume " + v, done[v] || 0, totals[v]); });
      html += '<div class="actions">';
      if (state.last && titleByKey[state.last]) {
        html += '<a class="continue md-button md-button--primary" href="' + new URL(state.last, root).href +
                '">Continue: ' + titleByKey[state.last].replace(/</g, "&lt;") + '</a>';
      }
      html += '<button id="export-progress" type="button">Export progress</button>' +
              '<button id="import-progress" type="button">Import progress</button>' +
              '<input id="import-file" type="file" accept="application/json" hidden></div>';
      panel.innerHTML = html;

      document.getElementById("export-progress").addEventListener("click", function () {
        var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "bootcamp-progress-" + new Date().toISOString().slice(0, 10) + ".json";
        a.click(); URL.revokeObjectURL(a.href);
      });
      var file = document.getElementById("import-file");
      document.getElementById("import-progress").addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function () {
        var f = file.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var incoming = JSON.parse(rd.result);
            if (!incoming || typeof incoming !== "object") throw new Error("bad file");
            if (!confirm("Replace the progress and notes stored in this browser with the contents of this file?")) return;
            state = { done: incoming.done || {}, notes: incoming.notes || {}, last: incoming.last || null };
            save(state); location.reload();
          } catch (e) { alert("That file is not a valid progress export."); }
        };
        rd.readAsText(f);
      });
    }).catch(function () {
      panel.textContent = "Progress tracking needs the site to be served over http (use the study launcher).";
    });
  }

  markNav(); buildTools(); buildHome();
})();
