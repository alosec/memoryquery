#!/bin/bash
set -euo pipefail

# MemoryQuery Installation Script
# Installs MCP server for Claude Code conversation memory access

readonly REPO_URL="https://github.com/alosec/memoryquery.git"
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
    if [ "$node_version" -lt 16 ]; then
        log_warning "Node.js version may be too old. Recommended: v16 or higher"
    fi
    
    log_success "All dependencies found"
}

setup_directories() {
    log_info "Setting up directories..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$(dirname "$DB_PATH")"
    
    log_success "Directories created"
}

clone_repository() {
    log_info "Cloning repository..."
    
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Repository already exists, updating..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        # Remove directory if it exists but isn't a git repo
        if [ -d "$INSTALL_DIR" ]; then
            rm -rf "$INSTALL_DIR"
        fi
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi
    
    cd "$INSTALL_DIR"
    log_success "Repository cloned/updated"
}

install_dependencies() {
    log_info "Installing npm dependencies..."
    cd "$INSTALL_DIR"
    
    npm install
    log_success "Dependencies installed"
}

build_project() {
    log_info "Building TypeScript project..."
    cd "$INSTALL_DIR"
    
    npm run build
    log_success "Project built successfully"
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
    cat > "$HOME/.local/bin/memoryquery" << 'EOF'
#!/bin/bash
# MemoryQuery CLI wrapper
cd "$HOME/.local/share/memoryquery"
exec npm run cli -- "$@"
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
    
    # Initialize database schema (if the CLI supports it)
    if npm run cli -- init 2>/dev/null || true; then
        log_success "Database initialized"
    else
        log_info "Database will be initialized on first sync"
    fi
}

start_services() {
    log_info "Starting MemoryQuery services..."
    cd "$INSTALL_DIR"
    
    # Set environment variable
    export MEMQ_DB_PATH="$DB_PATH"
    
    # Start sync daemon
    if npm run start -- --daemon 2>/dev/null; then
        log_success "Sync daemon started"
    else
        log_warning "Could not start sync daemon automatically"
        echo "You can start it manually with: memoryquery start"
    fi
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
    echo -e "${BLUE}Usage:${NC}"
    echo "  • In Claude Code: Use memory tools automatically via MCP"
    echo "  • CLI management: memoryquery start|stop|status"
    echo "  • Database location: $DB_PATH"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Start a new Claude Code conversation"
    echo "  2. Ask Claude to query its conversation history"
    echo "  3. Watch the powerful memory capabilities in action!"
    echo
    echo -e "${YELLOW}Note:${NC} If ~/.local/bin is not in your PATH, add this to your shell profile:"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo
}

cleanup_on_error() {
    log_error "Installation failed, cleaning up..."
    
    # Remove MCP registration if it was added
    claude mcp remove "$SERVICE_NAME" 2>/dev/null || true
    
    # Remove installation directory
    rm -rf "$INSTALL_DIR"
    
    # Remove CLI command
    rm -f "$HOME/.local/bin/memoryquery"
    
    echo "Cleanup complete. You can try running the installer again."
    exit 1
}

main() {
    echo -e "${BLUE}MemoryQuery Installer${NC}"
    echo "Installing Claude Code conversation memory system..."
    echo
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Run installation steps
    check_dependencies
    setup_directories
    clone_repository
    install_dependencies
    build_project
    setup_environment
    register_mcp_server
    setup_cli_commands
    initialize_database
    start_services
    
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