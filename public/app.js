/* ============================================================
   XERXES PI ADMIN — app.js
   Handles: localisation, theme toggle, status check,
            command execution, output display.
   ============================================================ */

const API_BASE = "";  // same origin — served by the C++ backend

/* ── LOCALISATION ── */
// Load lang.json and apply text to all [data-i18n] elements
function loadLang() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/lang.json", true);
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var strings = JSON.parse(xhr.responseText);
        document.querySelectorAll("[data-i18n]").forEach(function (el) {
          var key = el.getAttribute("data-i18n");
          if (strings[key]) el.textContent = strings[key];
        });
      } catch (e) {
        console.warn("lang.json parse error:", e);
      }
    }
  };
  xhr.send();
}

/* ── THEME TOGGLE ── */
var themeToggle = document.getElementById("theme-toggle");
var themeLabel  = document.getElementById("theme-label");
var html        = document.documentElement;

// Apply saved preference on load
var savedTheme = localStorage.getItem("xerxes-theme") || "light";
html.setAttribute("data-theme", savedTheme);
themeLabel.textContent = savedTheme === "dark" ? "Light" : "Dark";

themeToggle.addEventListener("click", function () {
  var current = html.getAttribute("data-theme");
  var next    = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("xerxes-theme", next);
  themeLabel.textContent = next === "dark" ? "Light" : "Dark";
});

/* ── STATUS CHECK ── */
var statusDot   = document.getElementById("status-dot");
var statusLabel = document.getElementById("status-label");

function checkStatus() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", API_BASE + "/api/status", true);
  xhr.timeout = 4000;

  xhr.onload = function () {
    if (xhr.status === 200) {
      statusDot.className   = "status-dot online";
      statusLabel.textContent = "Backend Online";
    } else {
      setOffline();
    }
  };

  xhr.onerror   = setOffline;
  xhr.ontimeout = setOffline;
  xhr.send();
}

function setOffline() {
  statusDot.className     = "status-dot offline";
  statusLabel.textContent = "Backend Offline";
}

// Check on load, then every 15 seconds
checkStatus();
setInterval(checkStatus, 15000);

/* ── COMMAND EXECUTION ── */
var outputBody = document.getElementById("output-body");
var clearBtn   = document.getElementById("clear-output");

// Attach click handlers to all command buttons
document.querySelectorAll(".cmd-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var command = btn.getAttribute("data-command");
    runCommand(command, btn);
  });
});

function runCommand(command, btn) {
  // Mark button as running
  document.querySelectorAll(".cmd-btn").forEach(function (b) {
    b.classList.add("running");
    b.disabled = true;
  });

  outputBody.textContent = "Running command: " + command + "...\n";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", API_BASE + "/api/command", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 10000;

  xhr.onload = function () {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.output) {
        outputBody.textContent = data.output;
      } else if (data.message) {
        outputBody.textContent = "[" + (data.status || "info") + "] " + data.message;
      } else {
        outputBody.textContent = xhr.responseText;
      }
    } catch (e) {
      outputBody.textContent = "Response: " + xhr.responseText;
    }
    resetButtons();
  };

  xhr.onerror = function () {
    outputBody.textContent = "Error: Could not reach the backend.";
    resetButtons();
  };

  xhr.ontimeout = function () {
    outputBody.textContent = "Error: Request timed out.";
    resetButtons();
  };

  xhr.send(JSON.stringify({ command: command }));
}

function resetButtons() {
  document.querySelectorAll(".cmd-btn").forEach(function (b) {
    b.classList.remove("running");
    b.disabled = false;
  });
}

/* ── CLEAR OUTPUT ── */
clearBtn.addEventListener("click", function () {
  outputBody.textContent = "Command output will appear here...";
});

/* ── INIT ── */
loadLang();