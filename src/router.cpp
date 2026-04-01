#include "router.h"
#include "json.hpp"
#include <iostream>

using json = nlohmann::json;

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

        json response = {
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
    // Placeholder response until system_ops.cpp is implemented.
    // ------------------------------------------------------------------
    svr.Post("/api/command", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);

        try {
            json body = json::parse(req.body);
            std::string command_name = body.value("command", "");

            std::cout << "[Command Request] command=" << command_name << "\n";

            // TODO: pass command_name to system_ops::run_command() once implemented
            json response = {
                {"status", "pending"},
                {"command", command_name},
                {"message", "Command module not yet implemented"}
            };

            res.set_content(response.dump(), "application/json");

        } catch (const std::exception& e) {
            json error = {
                {"status", "error"},
                {"message", "Invalid request body"}
            };
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
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
