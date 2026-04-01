#include <iostream>
#include "httplib.h"
#include "router.h"

#define PORT 8080

int main() {
    httplib::Server svr;

    // Register all routes defined in router.cpp
    setup_routes(svr);

    std::cout << "=================================================\n";
    std::cout << " Xerxes Pi Admin Backend\n";
    std::cout << " Listening on http://0.0.0.0:" << PORT << "\n";
    std::cout << "=================================================\n";

    svr.listen("0.0.0.0", PORT);

    return 0;
}
