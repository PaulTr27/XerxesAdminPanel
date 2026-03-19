#include <iostream>
#include <string>
#include <cstring>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

// In the next step, we will include our modular headers here
// #include "router.h"
// #include "utils.h"

#define PORT 8080
#define BUFFER_SIZE 2048

int main() {
    int server_fd, new_socket;
    struct sockaddr_in address;
    int opt = 1;
    int addrlen = sizeof(address);
    char buffer[BUFFER_SIZE] = {0};

    // 1. Create the raw socket file descriptor
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        std::cerr << "Socket creation failed\n";
        return 1;
    }

    // 2. Set socket options to prevent "Address already in use" errors during rapid testing
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
        std::cerr << "setsockopt failed\n";
        return 1;
    }

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    // 3. Bind the socket to port 8080
    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        std::cerr << "Bind failed\n";
        return 1;
    }

    // 4. Start listening
    if (listen(server_fd, 3) < 0) {
        std::cerr << "Listen failed\n";
        return 1;
    }

    std::cout << "=================================================\n";
    std::cout << " Xerxes Pi Admin Backend\n";
    std::cout << " Listening on http://0.0.0.0:" << PORT << "\n";
    std::cout << "=================================================\n";

    // 5. The Main Server Loop
    while (true) {
        if ((new_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) < 0) {
            std::cerr << "Accept failed\n";
            continue;
        }

        read(new_socket, buffer, BUFFER_SIZE);
        
        // Print the incoming request to the VM terminal
        std::cout << "\n--- Incoming Request ---\n" << buffer << std::endl;

        // 6. Hardcoded JSON response to prove the pipeline works
        std::string json_payload = "{\"status\": \"online\", \"message\": \"The C++ build system is working perfectly!\"}";
        
        std::string http_response = 
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: " + std::to_string(json_payload.length()) + "\r\n"
            "Connection: close\r\n\r\n" + 
            json_payload;

        // Send the response back to the client and close the connection
        send(new_socket, http_response.c_str(), http_response.length(), 0);
        close(new_socket);
        memset(buffer, 0, BUFFER_SIZE);
    }

    return 0;
}