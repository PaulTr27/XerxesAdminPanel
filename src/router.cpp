#include <cstdlib>
#include <iostream>
#include "router.h"
#include "system_ops.h"
#include "json.hpp"

static void set_cors_headers(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

static int run_docker_command(const std::string& command) {
    std::cout << "[Docker Command] " << command << "\n";
    return std::system(command.c_str());
}

void setup_routes(httplib::Server& svr) {

svr.set_mount_point("/static", "./public");

    svr.Get("/api/status", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        nlohmann::json response = {
            {"status", "online"},
            {"message", "Xerxes Pi Admin Backend is running"}
        };

        res.set_content(response.dump(), "application/json");
    });

    svr.Get("/api/dashboard", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        nlohmann::json response = {
            {"hostname", system_ops::get_hostname()},
            {"uptime", system_ops::get_uptime()},
            {"disk", system_ops::get_disk_usage()},
            {"ip", system_ops::get_ip_address()}
        };

        res.set_content(response.dump(), "application/json");
    });

    svr.Post("/api/command", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);

        try {
            nlohmann::json body = nlohmann::json::parse(req.body);
            std::string command_name = body.value("command", "");

            std::string output = system_ops::run_command(command_name);

            nlohmann::json response = {
                {"status", "ok"},
                {"command", command_name},
                {"output", output}
            };

            res.set_content(response.dump(), "application/json");

        } catch (const std::exception&) {
            res.status = 400;

            nlohmann::json error = {
                {"status", "error"},
                {"message", "Invalid request body"}
            };

            res.set_content(error.dump(), "application/json");
        }
    });

    svr.Get("/api/docker/start-nginx", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        std::string command =
            "docker rm -f xerxes-nginx 2>/dev/null; "
            "docker run -d "
            "--name xerxes-nginx "
            "--label project=xerxes-pi "
            "--label managed-by=xerxes-admin "
            "--label app=nginx "
            "-p 8080:80 "
            "-v $(pwd)/public/docker/html:/usr/share/nginx/html:ro "
            "--memory 256m "
            "--cpus 0.50 "
            "--restart unless-stopped "
            "nginx:latest";

        int result = run_docker_command(command);

        nlohmann::json response = {
            {"status", result == 0 ? "ok" : "error"},
            {"message", result == 0 ? "Nginx container started" : "Failed to start Nginx container"},
            {"url", "http://localhost:8080"}
        };

        res.set_content(response.dump(), "application/json");
    });

    svr.Get("/api/docker/remove-nginx", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        int result = run_docker_command("docker rm -f xerxes-nginx 2>/dev/null");

        nlohmann::json response = {
            {"status", result == 0 ? "ok" : "error"},
            {"message", result == 0 ? "Nginx container removed" : "Failed to remove Nginx container"}
        };

        res.set_content(response.dump(), "application/json");
    });

    svr.Get("/api/docker/status", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);

        int result = run_docker_command(
            "docker ps -a --filter label=project=xerxes-pi "
            "--format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'"
        );

        nlohmann::json response = {
            {"status", result == 0 ? "ok" : "error"},
            {"message", "Docker status command executed. Check backend terminal output."}
        };

        res.set_content(response.dump(), "application/json");
    });

    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        res.status = 204;
    });
}
