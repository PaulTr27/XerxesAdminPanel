/* ============================================================
   XERXES PI ADMIN — app.js
   Handles: localisation, theme toggle, status check,
            command execution, hostname rename, service
            status badges, reboot/shutdown controls.
   ============================================================ */

const API_BASE = "";  // same origin — served by the C++ backend

/* ── LOCALISATION ── */
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

/* ── BACKEND STATUS CHECK ── */
var statusDot   = document.getElementById("status-dot");
var statusLabel = document.getElementById("status-label");

function checkStatus() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", API_BASE + "/api/status", true);
  xhr.timeout = 4000;
  xhr.onload = function () {
    if (xhr.status === 200) {
      statusDot.className     = "status-dot online";
      statusLabel.textContent = "Backend Online";
    } else { setOffline(); }
  };
  xhr.onerror   = setOffline;
  xhr.ontimeout = setOffline;
  xhr.send();
}

function setOffline() {
  statusDot.className     = "status-dot offline";
  statusLabel.textContent = "Backend Offline";
}

checkStatus();
setInterval(checkStatus, 15000);

/* ── DASHBOARD CARDS ── */
function loadDashboard() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", API_BASE + "/api/dashboard", true);
  xhr.timeout = 6000;
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.hostname) {
          document.getElementById("val-hostname").textContent = data.hostname;
          // Also update the hostname badge in the Network section
          var badge = document.getElementById("badge-hostname");
          if (badge) badge.textContent = data.hostname;
        }
        if (data.uptime) document.getElementById("val-uptime").textContent = data.uptime;
        if (data.disk)   document.getElementById("val-disk").textContent   = data.disk;
        if (data.ip)     document.getElementById("val-ip").textContent     = data.ip;
      } catch (e) { console.warn("Dashboard parse error:", e); }
    }
  };
  xhr.onerror   = function () { console.warn("Dashboard fetch failed."); };
  xhr.ontimeout = function () { console.warn("Dashboard fetch timed out."); };
  xhr.send();
}

/* ── SERVICE STATUS BADGES ── */
function loadServices() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", API_BASE + "/api/services", true);
  xhr.timeout = 6000;
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        updateBadge("badge-samba",     data.smbd);
        updateBadge("badge-tailscale", data.tailscaled);
        updateBadge("badge-ngrok",     data.ngrok);
      } catch (e) { console.warn("Services parse error:", e); }
    }
  };
  xhr.send();
}

function updateBadge(id, status) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = status || "unknown";
  el.className   = "service-badge";
  if (status === "active")   el.classList.add("badge-active");
  else if (status === "failed") el.classList.add("badge-failed");
  else                          el.classList.add("badge-inactive");
}

/* ── COMMAND EXECUTION ── */
var outputBody = document.getElementById("output-body");
var clearBtn   = document.getElementById("clear-output");

document.querySelectorAll(".cmd-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    runCommand(btn.getAttribute("data-command"));
  });
});

function runCommand(command) {
  document.querySelectorAll(".cmd-btn").forEach(function (b) {
    b.classList.add("running");
    b.disabled = true;
  });

  outputBody.textContent = "Running: " + command + "...\n";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", API_BASE + "/api/command", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  // tailscale up blocks for auth — give it 20 s; other commands get 15 s
  xhr.timeout = (command === "tailscale_up") ? 20000 : 15000;

  xhr.onload = function () {
    try {
      var data = JSON.parse(xhr.responseText);
      outputBody.textContent = data.output || data.message || xhr.responseText;
    } catch (e) {
      outputBody.textContent = xhr.responseText;
    }
    resetButtons();
    // Refresh service badges after any service-related command
    var serviceCommands = ["samba_start","samba_stop","samba_status",
                           "tailscale_up","tailscale_down","tailscale_status",
                           "ngrok_start","ngrok_stop","ngrok_status"];
    if (serviceCommands.indexOf(command) !== -1) loadServices();
  };

  xhr.onerror   = function () { outputBody.textContent = "Error: Could not reach the backend."; resetButtons(); };
  xhr.ontimeout = function () { outputBody.textContent = "Error: Request timed out."; resetButtons(); };
  xhr.send(JSON.stringify({ command: command }));
}

function resetButtons() {
  document.querySelectorAll(".cmd-btn").forEach(function (b) {
    b.classList.remove("running");
    b.disabled = false;
  });
}

clearBtn.addEventListener("click", function () {
  outputBody.textContent = "Command output will appear here...";
});

/* ── HOSTNAME RENAME ── */
var hostnameBtn      = document.getElementById("hostname-btn");
var hostnameInput    = document.getElementById("hostname-input");
var hostnameReset    = document.getElementById("hostname-reset");
var hostnameFeedback = document.getElementById("hostname-feedback");

// Fills the input with the current hostname shown on the dashboard card.
// Acts as an "undo" for the rename — the user still has to click Rename to confirm.
hostnameReset.addEventListener("click", function () {
  var currentHostname = document.getElementById("val-hostname").textContent;
  if (currentHostname && currentHostname !== "—") {
    hostnameInput.value = currentHostname;
    hostnameInput.focus();
    showFeedback(hostnameFeedback, "Current hostname pre-filled — click Rename to apply.", "");
  } else {
    showFeedback(hostnameFeedback, "Could not read current hostname — try refreshing the page.", "error");
  }
});

hostnameBtn.addEventListener("click", function () {
  var newName = hostnameInput.value.trim();
  if (!newName) {
    showFeedback(hostnameFeedback, "Please enter a hostname.", "error");
    return;
  }

  hostnameBtn.disabled = true;
  hostnameBtn.textContent = "Renaming...";
  showFeedback(hostnameFeedback, "", "");

  var xhr = new XMLHttpRequest();
  xhr.open("POST", API_BASE + "/api/hostname", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 8000;

  xhr.onload = function () {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.output && data.output.indexOf("[error]") !== -1) {
        showFeedback(hostnameFeedback, data.output, "error");
      } else {
        showFeedback(hostnameFeedback, "Hostname updated successfully. Reboot to apply fully.", "success");
        hostnameInput.value = "";
        loadDashboard(); // refresh the hostname card
      }
    } catch (e) {
      showFeedback(hostnameFeedback, "Unexpected response from backend.", "error");
    }
    hostnameBtn.disabled    = false;
    hostnameBtn.textContent = "Rename";
  };

  xhr.onerror   = function () { showFeedback(hostnameFeedback, "Error: Could not reach backend.", "error"); hostnameBtn.disabled = false; hostnameBtn.textContent = "Rename"; };
  xhr.ontimeout = function () { showFeedback(hostnameFeedback, "Error: Request timed out.", "error"); hostnameBtn.disabled = false; hostnameBtn.textContent = "Rename"; };
  xhr.send(JSON.stringify({ hostname: newName }));
});

function showFeedback(el, msg, type) {
  el.textContent = msg;
  el.className   = "control-feedback" + (type ? " " + type : "");
}

/* ── REBOOT / SHUTDOWN ── */
document.getElementById("btn-reboot").addEventListener("click", function () {
  if (confirm("Are you sure you want to reboot the device?")) {
    runCommand("reboot");
  }
});

document.getElementById("btn-shutdown").addEventListener("click", function () {
  if (confirm("Are you sure you want to shut down the device? You will need physical access to turn it back on.")) {
    runCommand("shutdown");
  }
});

/* ── INIT ── */
loadLang();
loadDashboard();
loadServices();
