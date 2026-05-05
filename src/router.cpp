#include "router.h"
#include "system_ops.h"
#include "json.hpp"
#include <iostream>

// Helper: adds CORS headers so the frontend JS can call the API
static void set_cors_headers(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

void setup_routes(httplib::Server& svr) {

    // Serve static frontend files (index.html, styles.css, app.js)
    // Path is relative to where the binary is run from
    svr.set_mount_point("/", "./public");

    // ------------------------------------------------------------------
    // GET /api/status
    // Returns a simple JSON confirming the backend is online.
    // The frontend dashboard will call this on page load.
    // ------------------------------------------------------------------
    svr.Get("/api/status", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        nlohmann::json response = {
            {"status", "online"},
            {"message", "Xerxes Pi Admin Backend is running"}
        };

        res.set_content(response.dump(), "application/json");
    });

    // ------------------------------------------------------------------
    // POST /api/command
    // Accepts a JSON body: { "command": "disk_usage" }
    // Passes the command name to the Command Module (system_ops) for
    // validation and safe execution. Returns stdout/stderr as JSON.
    // ------------------------------------------------------------------
    svr.Post("/api/command", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);

        try {
            nlohmann::json body = nlohmann::json::parse(req.body);
            std::string command_name = body.value("command", "");

            std::cout << "[Command Request] command=" << command_name << "\n";

            std::string output = system_ops::run_command(command_name);

            nlohmann::json response = {
                {"status", "ok"},
                {"command", command_name},
                {"output", output}
            };

            res.set_content(response.dump(), "application/json");

        } catch (const std::exception& e) {
            nlohmann::json error = {
                {"status", "error"},
                {"message", "Invalid request body"}
            };
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
    });

    // ------------------------------------------------------------------
    // GET /api/dashboard
    // Returns the four status card values in a single JSON response.
    // Called by the frontend on page load to populate the dashboard.
    // ------------------------------------------------------------------
    svr.Get("/api/dashboard", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        nlohmann::json response = {
            {"hostname", system_ops::get_hostname()},
            {"uptime",   system_ops::get_uptime()},
            {"disk",     system_ops::get_disk_usage()},
            {"ip",       system_ops::get_ip_address()}
        };

        res.set_content(response.dump(), "application/json");
    });

    // ------------------------------------------------------------------
    // POST /api/hostname
    // Accepts { "hostname": "new-name" } and renames the device.
    // Validation is handled inside system_ops::set_hostname().
    // ------------------------------------------------------------------
    svr.Post("/api/hostname", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);

        try {
            nlohmann::json body = nlohmann::json::parse(req.body);
            std::string new_hostname = body.value("hostname", "");

            std::cout << "[Hostname Request] new=" << new_hostname << "\n";

            std::string result = system_ops::set_hostname(new_hostname);

            nlohmann::json response = {
                {"status", "ok"},
                {"output", result}
            };

            res.set_content(response.dump(), "application/json");

        } catch (const std::exception& e) {
            nlohmann::json error = {
                {"status", "error"},
                {"message", "Invalid request body"}
            };
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
    });

    // ------------------------------------------------------------------
    // GET /api/services
    // Returns active/inactive status of smbd, tailscaled, and ngrok.
    // Called on page load and after service control commands.
    // ------------------------------------------------------------------
    svr.Get("/api/services", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        nlohmann::json response = {
            {"smbd",       system_ops::get_service_status("smbd")},
            {"tailscaled", system_ops::get_service_status("tailscaled")},
            {"ngrok",      system_ops::get_service_status("ngrok")}
        };

        res.set_content(response.dump(), "application/json");
    });

    // ------------------------------------------------------------------
    // OPTIONS /* (preflight handler for CORS)
    // Browsers send an OPTIONS request before POST — this handles that.
    // ------------------------------------------------------------------
    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        res.status = 204;
    });
}
