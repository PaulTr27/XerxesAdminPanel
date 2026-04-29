#include "system_ops.h"
#include <cstdio>
#include <map>
#include <string>
#include <algorithm>

namespace system_ops {

    // ----------------------------------------------------------------
    // capture()
    // Runs a hardcoded shell command and returns its stdout as a string.
    // IMPORTANT: This function must only ever be called with hardcoded
    // string literals — never with user-supplied input.
    // ----------------------------------------------------------------
    static std::string capture(const char* shell_command) {
        FILE* pipe = popen(shell_command, "r");
        if (!pipe) return "[error] Failed to open process.";

        char buffer[256];
        std::string result;
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            result += buffer;
        }
        pclose(pipe);

        if (result.empty()) return "[no output]";
        return result;
    }

    // Trims trailing whitespace and newlines from a string (for card values)
    static std::string trim(std::string s) {
        s.erase(std::find_if(s.rbegin(), s.rend(), [](unsigned char c) {
            return !std::isspace(c);
        }).base(), s.end());
        return s;
    }

    // ----------------------------------------------------------------
    // ALLOWLIST
    // Maps the command name sent from the frontend to a fixed,
    // hardcoded shell command string. The user can only trigger
    // keys in this map — they cannot influence the command string.
    // ----------------------------------------------------------------
    static const std::map<std::string, const char*> ALLOWLIST = {
        { "disk_usage",   "df -h" },
        { "uptime",       "uptime" },
        { "network_info", "ip addr show" },
        { "memory",       "free -h" },
        { "processes",    "ps aux --sort=-%cpu | head -15" },
        { "port_scan",    "ss -tlnp" }
    };

    std::string run_command(const std::string& command_name) {
        auto it = ALLOWLIST.find(command_name);
        if (it == ALLOWLIST.end()) {
            return "[error] Unknown or disallowed command: " + command_name;
        }
        // Only the hardcoded string from the allowlist reaches the shell
        return capture(it->second);
    }

    // ----------------------------------------------------------------
    // Dashboard card helpers
    // Each calls a specific, hardcoded command and trims the output
    // to a short value suitable for displaying in a card.
    // ----------------------------------------------------------------

    std::string get_hostname() {
        return trim(capture("hostname"));
    }

    std::string get_uptime() {
        // uptime -p gives a clean human-readable string e.g. "up 2 hours, 5 minutes"
        return trim(capture("uptime -p"));
    }

    std::string get_disk_usage() {
        // Returns just the usage percentage of the root partition e.g. "42%"
        return trim(capture("df -h / | tail -1 | awk '{print $3 \"/\" $2}'"));
    }

    std::string get_ip_address() {
        // Returns the first assigned IP address
        return trim(capture("hostname -I | awk '{print $1}'"));
    }

}
