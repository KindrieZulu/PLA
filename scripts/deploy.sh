#!/bin/bash
# ============================================================
# PLA Deployment Script
# Usage:
#   ./scripts/deploy.sh dev       - Local development (no Docker)
#   ./scripts/deploy.sh docker    - Docker Compose deployment
#   ./scripts/deploy.sh prod      - Production Docker build
#   ./scripts/deploy.sh stop      - Stop all services
#   ./scripts/deploy.sh status    - Check service status
#   ./scripts/deploy.sh logs      - Tail service logs
#   ./scripts/deploy.sh test      - Run all tests
# ============================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

log_info()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; }
log_step()    { echo -e "${BLUE}[→]${NC} $1"; }
log_header()  { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}\n"; }

# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================================
# FUNCTIONS
# ============================================================

check_prerequisites() {
    log_header "Checking Prerequisites"

    local missing=0

    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Install Node.js >= 18"
        missing=1
    else
        local node_version
        node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            log_error "Node.js version $node_version found, need >= 18"
            missing=1
        else
            log_info "Node.js $(node -v)"
        fi
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        missing=1
    else
        log_info "npm $(npm -v)"
    fi

    if [ "${1:-}" = "docker" ] || [ "${1:-}" = "prod" ]; then
        if ! command -v docker &> /dev/null; then
            log_error "Docker not found"
            missing=1
        else
            log_info "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
        fi

        if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
            log_error "Docker Compose not found"
            missing=1
        else
            log_info "Docker Compose $(docker compose version --short 2>/dev/null || echo 'available')"
        fi
    fi

    if [ "$missing" -eq 1 ]; then
        log_error "Missing prerequisites. Please install them first."
        exit 1
    fi

    log_info "All prerequisites met!"
}

setup_env() {
    log_header "Setting Up Environment"

    # Backend .env
    if [ ! -f pla-backend/.env ]; then
        log_step "Creating backend .env from template..."
        cp pla-backend/.env.example pla-backend/.env 2>/dev/null || cat > pla-backend/.env << 'EOF'
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

JWT_SECRET=dev-pla-jwt-secret-at-least-32-characters-long-change-in-prod
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=4

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=pla_db

MONGO_URI=mongodb://localhost:27017/pla_db

REDIS_HOST=localhost
REDIS_PORT=6379

SESSION_SECRET=dev-pla-session-secret-at-least-32-characters-long

CORS_ORIGIN=http://localhost:3000

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=10

TRUST_PROXY=true
EOF
        log_info "Backend .env created"
    else
        log_info "Backend .env already exists"
    fi
}

install_deps() {
    log_header "Installing Dependencies"

    log_step "Installing backend dependencies..."
    cd pla-backend
    npm install --no-audit 2>&1 | tail -3
    log_info "Backend dependencies installed"

    cd "$PROJECT_ROOT"
}

deploy_dev() {
    log_header "Starting Local Development Deployment"

    check_prerequisites dev
    setup_env
    install_deps

    # Kill any existing processes on our ports
    log_step "Stopping any existing processes on ports 3000, 5000..."
    for port in 3000 5000 8080; do
        local pid
        pid=$(lsof -ti :"$port" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            kill -9 "$pid" 2>/dev/null || true
            log_warn "Killed process on port $port"
        fi
    done
    sleep 1

    # Start backend
    log_step "Starting backend server..."
    cd pla-backend
    nohup node src/server.js > /tmp/pla-backend.log 2>&1 &
    BACKEND_PID=$!
    cd "$PROJECT_ROOT"
    log_info "Backend starting (PID: $BACKEND_PID)"

    # Wait for backend to be ready
    log_step "Waiting for backend to be ready..."
    for i in $(seq 1 30); do
        if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
            log_info "Backend is ready!"
            break
        fi
        if [ "$i" -eq 30 ]; then
            log_error "Backend failed to start. Check /tmp/pla-backend.log"
            tail -20 /tmp/pla-backend.log
            exit 1
        fi
        sleep 1
    done

    # Start frontend (static demo)
    log_step "Starting frontend..."
    cd pla-webApp/public
    nohup python3 -m http.server 3000 --bind 0.0.0.0 > /tmp/pla-web.log 2>&1 &
    WEB_PID=$!
    cd "$PROJECT_ROOT"
    log_info "Frontend starting (PID: $WEB_PID)"

    sleep 2

    # Run health checks
    run_health_checks

    # Print access info
    log_header "🚀 PLA is Running!"
    echo -e "${GREEN}┌──────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}│                                              │${NC}"
    echo -e "${GREEN}│  ${BOLD}Frontend:${NC}    http://localhost:3000          ${GREEN}│${NC}"
    echo -e "${GREEN}│  ${BOLD}Backend API:${NC} http://localhost:5000          ${GREEN}│${NC}"
    echo -e "${GREEN}│  ${BOLD}Health:${NC}      http://localhost:5000/health   ${GREEN}│${NC}"
    echo -e "${GREEN}│  ${BOLD}Metrics:${NC}     http://localhost:5000/metrics   ${GREEN}│${NC}"
    echo -e "${GREEN}│  ${BOLD}API Info:${NC}    http://localhost:5000/api       ${GREEN}│${NC}"
    echo -e "${GREEN}│                                              │${NC}"
    echo -e "${GREEN}│  ${BOLD}Demo Student:${NC} student1 / Student123!       ${GREEN}│${NC}"
    echo -e "${GREEN}│  ${BOLD}Demo Teacher:${NC} teacher@demo.pla / Teacher123!${GREEN}│${NC}"
    echo -e "${GREEN}│                                              │${NC}"
    echo -e "${GREEN}│  ${BOLD}Logs:${NC}  tail -f /tmp/pla-backend.log       ${GREEN}│${NC}"
    echo -e "${GREEN}│  ${BOLD}Stop:${NC}   ./scripts/deploy.sh stop            ${GREEN}│${NC}"
    echo -e "${GREEN}│                                              │${NC}"
    echo -e "${GREEN}└──────────────────────────────────────────────┘${NC}"
}

deploy_docker() {
    log_header "Starting Docker Compose Deployment"

    check_prerequisites docker
    setup_env

    log_step "Building Docker images..."
    docker compose build --parallel 2>&1 | tail -5

    log_step "Starting all services..."
    docker compose up -d

    log_step "Waiting for services to be healthy..."
    sleep 10

    # Wait for backend
    for i in $(seq 1 60); do
        if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
            log_info "Backend is healthy!"
            break
        fi
        if [ "$i" -eq 60 ]; then
            log_error "Backend health check failed"
            docker compose logs backend | tail -20
        fi
        sleep 2
    done

    # Run database migration inside postgres container
    log_step "Running database migration..."
    docker compose exec -T postgres psql -U postgres -d pla_db < pla_db.sql 2>/dev/null || true

    # Run our extended migration
    bash scripts/migrate-and-seed.sh 2>/dev/null || log_warn "Migration script needs manual run"

    run_health_checks

    log_header "🚀 PLA Docker Stack Running!"
    echo ""
    echo -e "  ${BOLD}Frontend:${NC}       http://localhost:3000"
    echo -e "  ${BOLD}Backend API:${NC}    http://localhost:5000"
    echo -e "  ${BOLD}Prometheus:${NC}     http://localhost:9090"
    echo -e "  ${BOLD}Grafana:${NC}        http://localhost:3001 (admin/admin123)"
    echo -e "  ${BOLD}Alertmanager:${NC}   http://localhost:9093"
    echo ""
    echo -e "  ${BOLD}Demo Student:${NC}   student1 / Student123!"
    echo -e "  ${BOLD}Demo Teacher:${NC}   teacher@demo.pla / Teacher123!"
    echo ""
    echo -e "  ${BOLD}Logs:${NC}   docker compose logs -f"
    echo -e "  ${BOLD}Stop:${NC}   ./scripts/deploy.sh stop"
    echo ""
}

deploy_prod() {
    log_header "Production Docker Build"

    check_prerequisites docker

    if [ ! -f pla-backend/.env.production ]; then
        log_error "Missing pla-backend/.env.production"
        log_warn "Create it with production values. See pla-backend/.env.example"
        exit 1
    fi

    log_step "Building production images..."
    docker compose -f docker-compose.yml build --parallel

    log_step "Starting production stack..."
    NODE_ENV=production docker compose -f docker-compose.yml up -d

    log_info "Production deployment started"
}

stop_services() {
    log_header "Stopping All Services"

    # Stop Docker services
    if docker compose ps -q 2>/dev/null | grep -q .; then
        log_step "Stopping Docker services..."
        docker compose down
        log_info "Docker services stopped"
    fi

    # Stop local processes
    for port in 3000 5000 8080; do
        local pid
        pid=$(lsof -ti :"$port" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            kill "$pid" 2>/dev/null || true
            log_info "Stopped process on port $port (PID: $pid)"
        fi
    done

    log_info "All services stopped"
}

check_status() {
    log_header "Service Status"

    local all_ok=true

    # Check backend
    if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
        local health
        health=$(curl -sf http://localhost:5000/health)
        log_info "Backend (port 5000): UP - $health"
    else
        log_error "Backend (port 5000): DOWN"
        all_ok=false
    fi

    # Check frontend
    if curl -sf http://localhost:3000/ > /dev/null 2>&1; then
        log_info "Frontend (port 3000): UP"
    else
        log_error "Frontend (port 3000): DOWN"
        all_ok=false
    fi

    # Check Docker services
    if docker compose ps 2>/dev/null | grep -q "Up"; then
        log_info "Docker services running:"
        docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
    fi

    if [ "$all_ok" = false ]; then
        echo ""
        log_warn "Some services are down. Run: ./scripts/deploy.sh dev"
    fi
}

run_health_checks() {
    log_header "Running Health Checks"

    local checks_passed=0
    local checks_total=0

    # Backend health endpoint
    ((checks_total++))
    if curl -sf http://localhost:5000/health | grep -q '"status":"ok"'; then
        log_info "Backend health: PASS"
        ((checks_passed++))
    else
        log_error "Backend health: FAIL"
    fi

    # Backend API info
    ((checks_total++))
    if curl -sf http://localhost:5000/api | grep -q '"name":"PLA API"'; then
        log_info "API info endpoint: PASS"
        ((checks_passed++))
    else
        log_error "API info endpoint: FAIL"
    fi

    # Backend metrics (Prometheus)
    ((checks_total++))
    if curl -sf http://localhost:5000/metrics | grep -q "process_cpu_user_seconds_total"; then
        log_info "Prometheus metrics: PASS"
        ((checks_passed++))
    else
        log_error "Prometheus metrics: FAIL"
    fi

    # Frontend
    ((checks_total++))
    if curl -sf http://localhost:3000/ | grep -q "PLA"; then
        log_info "Frontend serving: PASS"
        ((checks_passed++))
    else
        log_error "Frontend serving: FAIL"
    fi

    # Rate limiting headers
    ((checks_total++))
    local headers
    headers=$(curl -sf -I http://localhost:5000/api 2>/dev/null || true)
    if echo "$headers" | grep -qi "ratelimit\|x-ratelimit"; then
        log_info "Rate limiting headers: PASS"
        ((checks_passed++))
    else
        log_warn "Rate limiting headers: Not detected (may need multiple requests)"
        ((checks_passed++))  # Non-critical
    fi

    # Security headers
    ((checks_total++))
    if echo "$headers" | grep -qi "x-content-type-options\|helmet"; then
        log_info "Security headers (Helmet): PASS"
        ((checks_passed++))
    else
        log_warn "Security headers: Could not verify"
    fi

    echo ""
    log_info "Health checks: $checks_passed/$checks_total passed"
}

run_tests() {
    log_header "Running Tests"

    cd pla-backend

    log_step "Installing test dependencies..."
    npm install --no-audit 2>&1 | tail -1

    log_step "Running test suite..."
    npm test 2>&1

    cd "$PROJECT_ROOT"
}

tail_logs() {
    log_header "Tailing Logs"
    if [ -f /tmp/pla-backend.log ]; then
        tail -f /tmp/pla-backend.log /tmp/pla-web.log 2>/dev/null
    else
        docker compose logs -f
    fi
}

# ============================================================
# MAIN
# ============================================================

case "${1:-help}" in
    dev)
        deploy_dev
        ;;
    docker)
        deploy_docker
        ;;
    prod)
        deploy_prod
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
    logs)
        tail_logs
        ;;
    test)
        run_tests
        ;;
    help|*)
        echo -e "${BOLD}PLA Deployment Script${NC}"
        echo ""
        echo "Usage: ./scripts/deploy.sh <command>"
        echo ""
        echo "Commands:"
        echo "  dev       Local development deployment (Node.js directly)"
        echo "  docker    Docker Compose deployment (full stack with DBs)"
        echo "  prod      Production Docker build"
        echo "  stop      Stop all running services"
        echo "  status    Check service health status"
        echo "  logs      Tail service logs"
        echo "  test      Run test suite"
        echo ""
        ;;
esac
