#!/bin/bash
set -euo pipefail

# MemoryQuery Installation Script
# Clean installation that builds in /tmp and installs only dist to user directory

readonly REPO_URL="https://github.com/alosec/memoryquery.git"
readonly BUILD_DIR="/tmp/memoryquery"
readonly INSTALL_DIR="$HOME/.local/share/memoryquery"
readonly DB_PATH="$HOME/.local/share/memoryquery/mcp.db"
readonly SERVICE_NAME="memoryquery"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check for required commands
    local missing_deps=()
    
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        echo "Please install Node.js via your package manager:"
        echo "  - Ubuntu/Debian: sudo apt install nodejs npm"
        echo "  - macOS: brew install node"
        echo "  - Fedora: sudo dnf install nodejs npm"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        echo "Please install npm via your package manager"
        exit 1
    fi
    
    if ! command -v claude &> /dev/null; then
        log_error "Claude Code CLI is required but not installed"
        echo "Please install Claude Code first: https://docs.anthropic.com/claude/docs/claude-code"
        exit 1
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and try again"
        exit 1
    fi
    
    # Check Node.js version (basic check)
    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js version too old. Required: v18 or higher, found: v$node_version"
        echo "Please upgrade Node.js via your package manager"
        exit 1
    elif [ "$node_version" -lt 20 ]; then
        log_warning "Node.js v$node_version detected. Some features may require v20+, but proceeding..."
    fi
    
    log_success "All dependencies found"
}

cleanup_build_dir() {
    log_info "Cleaning up build directory..."
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
    fi
}

setup_directories() {
    log_info "Setting up directories..."
    
    # Clean up any previous build
    cleanup_build_dir
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$(dirname "$DB_PATH")"
    
    log_success "Directories created"
}

clone_and_build() {
    log_info "Cloning repository to build directory..."
    
    # Clone to temporary build directory
    git clone "$REPO_URL" "$BUILD_DIR"
    cd "$BUILD_DIR"
    
    log_success "Repository cloned"
    
    log_info "Installing build dependencies..."
    npm install
    log_success "Dependencies installed"
    
    log_info "Building TypeScript project..."
    npm run build
    log_success "Project built successfully"
}

install_built_files() {
    log_info "Installing built files to user directory..."
    
    # Remove existing installation 
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
    fi
    mkdir -p "$INSTALL_DIR"
    
    # Copy only the built dist directory and essential files
    cp -r "$BUILD_DIR/dist" "$INSTALL_DIR/"
    cp "$BUILD_DIR/package.json" "$INSTALL_DIR/"
    cp "$BUILD_DIR/example.mcp.json" "$INSTALL_DIR/"
    
    # Copy package-lock.json if it exists (for npm ci)
    if [ -f "$BUILD_DIR/package-lock.json" ]; then
        cp "$BUILD_DIR/package-lock.json" "$INSTALL_DIR/"
    fi
    
    log_success "Built files installed"
}

install_runtime_dependencies() {
    log_info "Installing runtime dependencies..."
    cd "$INSTALL_DIR"
    
    # Install only production dependencies
    npm ci --omit=dev
    log_success "Runtime dependencies installed"
}

setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Create environment file
    cat > "$INSTALL_DIR/.env" << EOF
# MemoryQuery Environment Configuration
MEMQ_DB_PATH=$DB_PATH
EOF
    
    log_success "Environment configured"
}

register_mcp_server() {
    log_info "Registering MCP server with Claude Code..."
    
    # Create MCP server configuration JSON
    local mcp_config='{
  "command": "node",
  "args": ["'$INSTALL_DIR'/dist/mcp-server/index.js"],
  "env": {
    "MEMQ_DB_PATH": "'$DB_PATH'"
  }
}'
    
    # Register with Claude Code using user scope
    if claude mcp add-json --scope user "$SERVICE_NAME" "$mcp_config"; then
        log_success "MCP server registered successfully"
    else
        log_error "Failed to register MCP server with Claude Code"
        echo "You may need to register manually using:"
        echo "claude mcp add-json --scope user $SERVICE_NAME '$mcp_config'"
        exit 1
    fi
}

setup_cli_commands() {
    log_info "Setting up CLI commands..."
    
    # Create bin directory if it doesn't exist
    mkdir -p "$HOME/.local/bin"
    
    # Create memoryquery command wrapper
    cat > "$HOME/.local/bin/memoryquery" << EOF
#!/bin/bash
# MemoryQuery CLI wrapper
cd "$INSTALL_DIR"
exec node dist/cli/index.js "\$@"
EOF
    
    chmod +x "$HOME/.local/bin/memoryquery"
    
    # Check if ~/.local/bin is in PATH
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        log_warning "~/.local/bin is not in your PATH"
        echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
    
    log_success "CLI commands set up"
}

initialize_database() {
    log_info "Initializing database..."
    cd "$INSTALL_DIR"
    
    # Set environment variable for this session
    export MEMQ_DB_PATH="$DB_PATH"
    
    # Database will be initialized automatically on first use
    log_success "Database configuration ready"
}

start_services() {
    log_info "Starting MemoryQuery services..."
    cd "$INSTALL_DIR"
    
    # Set environment variable
    export MEMQ_DB_PATH="$DB_PATH"
    
    # Services will be started on demand - MCP server starts automatically when Claude Code connects
    log_success "Services configured for automatic startup"
}

verify_installation() {
    log_info "Verifying installation..."
    
    local errors=0
    
    # Check if MCP server binary exists
    if [ ! -f "$INSTALL_DIR/dist/mcp-server/index.js" ]; then
        log_error "MCP server binary not found"
        errors=$((errors + 1))
    fi
    
    # Check if database directory exists
    if [ ! -d "$(dirname "$DB_PATH")" ]; then
        log_error "Database directory not created"
        errors=$((errors + 1))
    fi
    
    # Check if Claude Code recognizes the server
    if claude mcp list | grep -q "$SERVICE_NAME"; then
        log_success "MCP server registered with Claude Code"
    else
        log_error "MCP server not found in Claude Code configuration"
        errors=$((errors + 1))
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "Installation verified successfully"
        return 0
    else
        log_error "Installation verification failed with $errors errors"
        return 1
    fi
}

print_completion_message() {
    echo
    echo -e "${GREEN}🎉 MemoryQuery Installation Complete!${NC}"
    echo
    echo "Your Claude Code conversations now have persistent memory!"
    echo
    echo -e "${BLUE}What's Available:${NC}"
    echo "  • query_memory tool - Direct SQL access to all conversation history"
    echo "  • Automatic sync of new conversations to searchable database"
    echo "  • Cross-session memory and pattern analysis"
    echo
    echo -e "${BLUE}Installation Details:${NC}"
    echo "  • Installed to: $INSTALL_DIR"
    echo "  • Database location: $DB_PATH"
    echo "  • CLI command: memoryquery"
    echo
    echo -e "${BLUE}Usage:${NC}"
    echo "  • In Claude Code: Use memory tools automatically via MCP"
    echo "  • CLI management: memoryquery start|stop|status"
    echo "  • Check status: memoryquery status"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Start a new Claude Code conversation"
    echo "  2. Ask Claude to query its conversation history"
    echo "  3. Watch the powerful memory capabilities in action!"
    echo
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        echo -e "${YELLOW}Note:${NC} Add ~/.local/bin to your PATH for CLI access:"
        echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo
    fi
}

cleanup_on_error() {
    log_error "Installation failed, cleaning up..."
    
    # Remove MCP registration if it was added
    claude mcp remove "$SERVICE_NAME" 2>/dev/null || true
    
    # Remove installation directory
    rm -rf "$INSTALL_DIR"
    
    # Remove CLI command
    rm -f "$HOME/.local/bin/memoryquery"
    
    # Clean up build directory
    cleanup_build_dir
    
    echo "Cleanup complete. You can try running the installer again."
    exit 1
}

main() {
    echo -e "${BLUE}MemoryQuery Installer${NC}"
    echo "Clean installation for Claude Code conversation memory system..."
    echo
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Run installation steps
    check_dependencies
    setup_directories
    clone_and_build
    install_built_files
    install_runtime_dependencies
    setup_environment
    register_mcp_server
    setup_cli_commands
    initialize_database
    start_services
    
    # Clean up build directory
    cleanup_build_dir
    
    # Verify everything worked
    if verify_installation; then
        print_completion_message
    else
        log_error "Installation completed but verification failed"
        echo "You may need to troubleshoot the issues above"
        exit 1
    fi
}

# Run main function
main "$@"