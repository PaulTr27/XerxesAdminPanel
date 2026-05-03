# Compiler and Flags
CXX = g++
CXXFLAGS = -std=c++11 -Wall -O2 -Iinclude -pthread

# Output binary name
TARGET = xerxes_backend

# Automatically find all .cpp files in the src/ directory
SRCS = $(wildcard src/*.cpp)

# Generate object file names from source files
OBJS = $(SRCS:.cpp=.o)

# Default rule to build the target
all: $(TARGET)

# Rule to link the object files into the final executable
$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJS)

# Rule to compile individual .cpp files into .o files
%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Clean up build artifacts
clean:
	rm -f $(OBJS) $(TARGET)
