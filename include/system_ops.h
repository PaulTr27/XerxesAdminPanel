#pragma once
#include <string>
#include "utils.h"

namespace system_ops {

    // Initialize command wrapper (call once at startup)
    void initialize();

    // Executes a predefined command by name, looked up from the hardcoded allowlist.
    // No user input ever reaches the shell — only the allowlist keys are accepted.
    // Returns the command's stdout output, or an error string if the name is unknown.
    std::string run_command(const std::string& command_name);

    // Execute using new CommandWrapper with role-based access control
    // Returns CommandResult with full execution details
    CommandResult execute_command(const std::string& command_name, 
                              const std::string& params = "",
                              user_role::Role role = user_role::GUEST);

    // Returns a trimmed single-line value for dashboard cards.
    // Used by the /api/dashboard endpoint.
    std::string get_hostname();
    std::string get_uptime();
    std::string get_disk_usage();
    std::string get_ip_address();

}
