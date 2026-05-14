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

document.querySelectorAll(".cmd-btn:not(.docker-btn)").forEach(function (btn) {
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
  document.querySelectorAll(".cmd-btn:not(.docker-btn)").forEach(function (b) {
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

/* ── DOCKER ── */
var dockerOutput   = document.getElementById("docker-output-body");
var dockerFeedback = document.getElementById("docker-feedback");

document.querySelectorAll(".docker-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var command   = btn.getAttribute("data-docker-command");
    var needsName = btn.getAttribute("data-needs-name") === "true";
    var needsConfirm = btn.getAttribute("data-confirm") === "true";
    var name      = document.getElementById("container-input").value.trim();

    if (needsName && !name) {
      showFeedback(dockerFeedback, "Please enter a container name.", "error");
      document.getElementById("container-input").focus();
      return;
    }

    if (needsConfirm && !confirm("Remove container \"" + name + "\"? This cannot be undone.")) {
      return;
    }

    showFeedback(dockerFeedback, "", "");
    runDockerCommand(command, needsName ? name : "");
  });
});

function runDockerCommand(command, param) {
  document.querySelectorAll(".docker-btn").forEach(function (b) {
    b.classList.add("running");
    b.disabled = true;
  });

  dockerOutput.textContent = "Running: " + command + (param ? " " + param : "") + "...\n";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", API_BASE + "/api/command", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = (command === "container_restart") ? 65000 : 20000;

  xhr.onload = function () {
    try {
      var data = JSON.parse(xhr.responseText);
      dockerOutput.textContent = data.output || data.message || xhr.responseText;
    } catch (e) {
      dockerOutput.textContent = xhr.responseText;
    }
    resetDockerButtons();
  };

  xhr.onerror   = function () { dockerOutput.textContent = "Error: Could not reach the backend."; resetDockerButtons(); };
  xhr.ontimeout = function () { dockerOutput.textContent = "Error: Request timed out."; resetDockerButtons(); };

  var payload = { command: command };
  if (param) payload.param = param;
  xhr.send(JSON.stringify(payload));
}

function resetDockerButtons() {
  document.querySelectorAll(".docker-btn").forEach(function (b) {
    b.classList.remove("running");
    b.disabled = false;
  });
}

document.getElementById("clear-docker-output").addEventListener("click", function () {
  dockerOutput.textContent = "Docker output will appear here...";
});

/* ── RUN CONTAINER FORM ── */
var runFeedback = document.getElementById("run-feedback");

// ── Dynamic row builders ──────────────────────────────────────────────────────

function makeDynamicRow(list, innerHtml) {
  var row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = innerHtml;
  row.querySelector(".remove-btn").addEventListener("click", function () {
    list.removeChild(row);
  });
  list.appendChild(row);
  return row;
}

document.getElementById("add-port-btn").addEventListener("click", function () {
  var list = document.getElementById("port-list");
  makeDynamicRow(list,
    '<input class="text-input" type="text" placeholder="8080" maxlength="5" />' +
    '<span class="row-sep">:</span>' +
    '<input class="text-input" type="text" placeholder="80" maxlength="5" />' +
    '<button class="remove-btn" type="button" aria-label="Remove">&times;</button>'
  );
});

document.getElementById("add-volume-btn").addEventListener("click", function () {
  var list = document.getElementById("volume-list");
  makeDynamicRow(list,
    '<input class="text-input" type="text" placeholder="/host/path" />' +
    '<span class="row-sep">:</span>' +
    '<input class="text-input" type="text" placeholder="/container/path" />' +
    '<select class="select-input select-input--narrow">' +
      '<option value="">rw</option>' +
      '<option value="ro">ro</option>' +
    '</select>' +
    '<button class="remove-btn" type="button" aria-label="Remove">&times;</button>'
  );
});

document.getElementById("add-env-btn").addEventListener("click", function () {
  var list = document.getElementById("env-list");
  makeDynamicRow(list,
    '<input class="text-input" type="text" placeholder="KEY" />' +
    '<span class="row-sep">=</span>' +
    '<input class="text-input" type="text" placeholder="value" />' +
    '<button class="remove-btn" type="button" aria-label="Remove">&times;</button>'
  );
});

// ── Form collection + submission ─────────────────────────────────────────────

document.getElementById("run-container-btn").addEventListener("click", function () {
  var image = document.getElementById("run-image").value.trim();
  if (!image) {
    showFeedback(runFeedback, "Image name is required.", "error");
    document.getElementById("run-image").focus();
    return;
  }

  var payload = {
    image:   image,
    name:    document.getElementById("run-name").value.trim(),
    restart: document.getElementById("run-restart").value,
    detach:  true,
    ports:   [],
    volumes: [],
    env:     []
  };

  // Collect port rows — skip incomplete rows silently
  document.querySelectorAll("#port-list .dynamic-row").forEach(function (row) {
    var inputs = row.querySelectorAll("input");
    var host = inputs[0].value.trim();
    var ctr  = inputs[1].value.trim();
    if (host && ctr) payload.ports.push(host + ":" + ctr);
  });

  // Collect volume rows
  document.querySelectorAll("#volume-list .dynamic-row").forEach(function (row) {
    var inputs = row.querySelectorAll("input");
    var sel    = row.querySelector("select");
    var host = inputs[0].value.trim();
    var ctr  = inputs[1].value.trim();
    if (host && ctr) {
      payload.volumes.push(host + ":" + ctr + (sel.value ? ":" + sel.value : ""));
    }
  });

  // Collect env rows
  document.querySelectorAll("#env-list .dynamic-row").forEach(function (row) {
    var inputs = row.querySelectorAll("input");
    var key = inputs[0].value.trim();
    var val = inputs[1].value.trim();
    if (key) payload.env.push(key + "=" + val);
  });

  submitRunContainer(payload);
});

function submitRunContainer(payload) {
  var btn = document.getElementById("run-container-btn");
  btn.disabled    = true;
  btn.textContent = "Pulling & starting...";
  showFeedback(runFeedback, "", "");
  dockerOutput.textContent = "Running: docker run " + payload.image + "...\n" +
                             "This may take a while if the image needs to be pulled.\n";

  var xhr = new XMLHttpRequest();
  xhr.open("POST", API_BASE + "/api/docker/run", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 300000; // 5 minutes — image pulls can be slow

  xhr.onload = function () {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.status === "ok") {
        dockerOutput.textContent = data.output || "[ok] Container started.";
        showFeedback(runFeedback, "Container started successfully.", "success");
      } else {
        dockerOutput.textContent = data.error || data.output || xhr.responseText;
        showFeedback(runFeedback, data.error || "Failed to start container.", "error");
      }
    } catch (e) {
      dockerOutput.textContent = xhr.responseText;
      showFeedback(runFeedback, "Unexpected response from backend.", "error");
    }
    btn.disabled    = false;
    btn.textContent = "Run Container";
  };

  xhr.onerror = function () {
    dockerOutput.textContent = "Error: Could not reach the backend.";
    showFeedback(runFeedback, "Could not reach the backend.", "error");
    btn.disabled    = false;
    btn.textContent = "Run Container";
  };

  xhr.ontimeout = function () {
    dockerOutput.textContent = "Request timed out — the image may still be pulling in the background.\n" +
                               "Use List Containers to check if it started.";
    showFeedback(runFeedback, "Request timed out.", "error");
    btn.disabled    = false;
    btn.textContent = "Run Container";
  };

  xhr.send(JSON.stringify(payload));
}

/* ── INIT ── */
loadLang();
loadDashboard();
loadServices();
