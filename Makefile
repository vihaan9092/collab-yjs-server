# Makefile for Realtime YJS Server Docker Management
# Usage: make [target]

# Variables
IMAGE_NAME := realtime-yjs-server
CONTAINER_NAME := realtime-yjs-server-dev
PORT := 3000
DEV_COMPOSE := docker-compose -f docker-compose.dev.yml
DEBUG_COMPOSE := docker-compose -f docker-compose.dev.yml -f docker-compose.debug.yml
PROD_COMPOSE := docker-compose

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

# Help target
.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)Realtime YJS Server - Docker Management$(NC)"
	@echo ""
	@echo "$(GREEN)Development Commands (Default - with hot reloading):$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "(build|build-fresh|fresh|run|run-detached|logs|stop|shell|shell-client|health|clean|reset-deps)"
	@echo ""
	@echo "$(GREEN)Debug Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "vscodedebug"
	@echo ""
	@echo "$(GREEN)Production Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "prod-"
	@echo ""
	@echo "$(GREEN)Utility Commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST) | grep -E "(armageddon|help)"

# Build the Docker image using Docker Compose (Development)
.PHONY: build
build: ## Build the development Docker services with hot reloading
	@echo "$(BLUE)[BUILD]$(NC) Building development Docker services with hot reloading"
	$(DEV_COMPOSE) build
	@echo "$(GREEN)[SUCCESS]$(NC) Development Docker services built successfully"
	@echo "$(BLUE)[INFO]$(NC) Services built:"
	@echo "  - Backend API: http://localhost:3000"
	@echo "  - React Client: http://localhost:3001"
	@echo "  - Redis: localhost:6379"

# Fresh build with automatic node_modules cleanup (for package updates)
.PHONY: build-fresh
build-fresh: ## Fresh build: auto-removes frontend & backend node_modules, builds with no cache
	@echo "$(BLUE)[BUILD-FRESH]$(NC) Starting fresh build process..."
	@echo "$(YELLOW)[STEP 1/4]$(NC) Stopping services..."
	$(DEV_COMPOSE) down
	@echo "$(YELLOW)[STEP 2/4]$(NC) Removing node_modules volumes (frontend & backend)..."
	-docker volume rm realtime_yjs_server_client_node_modules 2>/dev/null || true
	-docker volume rm realtime_yjs_server_server_node_modules 2>/dev/null || true
	@echo "$(YELLOW)[STEP 3/4]$(NC) Building services with no cache..."
	$(DEV_COMPOSE) build --no-cache
	@echo "$(YELLOW)[STEP 4/4]$(NC) Fresh build completed!"
	@echo "$(GREEN)[SUCCESS]$(NC) Fresh build completed successfully"
	@echo "$(BLUE)[INFO]$(NC) All node_modules volumes recreated, packages will be reinstalled"
	@echo "$(BLUE)[NEXT]$(NC) Run 'make run' to start the services"

# Fresh build and run (one command for convenience)
.PHONY: fresh
fresh: build-fresh run ## Fresh build and run: auto-cleanup + build + start services
	@echo "$(GREEN)[FRESH]$(NC) Fresh build and run completed!"

# Run the Docker services with real-time logs using Docker Compose (Development)
.PHONY: run
run: ## Run the development services with hot reloading and real-time logs
	@echo "$(BLUE)[RUN]$(NC) Starting development services with hot reloading"
	@echo "$(GREEN)[INFO]$(NC) Starting services with real-time logs (Press Ctrl+C to stop)"
	@echo "$(BLUE)[INFO]$(NC) Backend API: http://localhost:3000"
	@echo "$(BLUE)[INFO]$(NC) React Client: http://localhost:3001"
	@echo "$(YELLOW)[INFO]$(NC) Code changes will automatically restart both services"
	@echo "$(YELLOW)[LOGS]$(NC) Service logs:"
	$(DEV_COMPOSE) up

# Run the Docker services in background (detached) using Docker Compose (Development)
.PHONY: run-detached
run-detached: ## Run the development services with hot reloading in background
	@echo "$(BLUE)[RUN]$(NC) Starting development services in background with hot reloading"
	$(DEV_COMPOSE) up -d
	@echo "$(GREEN)[SUCCESS]$(NC) Development services started in background!"
	@echo "$(BLUE)[INFO]$(NC) Backend API: http://localhost:3000"
	@echo "$(BLUE)[INFO]$(NC) React Client: http://localhost:3001"
	@echo "$(YELLOW)[INFO]$(NC) Code changes will automatically restart both services"
	@echo "$(BLUE)[INFO]$(NC) Use 'make logs' to view logs or 'make shell' to access containers"

# VSCode debug mode
.PHONY: vscodedebug
vscodedebug: stop ## VSCode debug mode - starts server with Node.js inspector for debugging
	@echo "$(BLUE)[DEBUG]$(NC) Starting VSCode debug mode"
	@echo "$(YELLOW)[INFO]$(NC) Node.js inspector will be available on localhost:9229"
	@echo "$(YELLOW)[INFO]$(NC) Hot reloading enabled with debug support"
	@echo "$(BLUE)[INFO]$(NC) Backend API: http://localhost:3000"
	@echo "$(BLUE)[INFO]$(NC) React Client: http://localhost:3001"
	@echo "$(GREEN)[SETUP]$(NC) To attach VS Code debugger:"
	@echo "  1. Open VS Code"
	@echo "  2. Go to Run and Debug (Ctrl+Shift+D)"
	@echo "  3. Select 'Attach to Node.js (Docker)'"
	@echo "  4. Press F5 or click the green play button"
	@echo "$(BLUE)[STARTING]$(NC) Starting debug services..."
	ENABLE_NODE_DEBUG=1 $(DEBUG_COMPOSE) up --remove-orphans

# Production Commands
.PHONY: prod-build
prod-build: ## Build the production Docker services with PM2
	@echo "$(BLUE)[PROD-BUILD]$(NC) Building production Docker services with PM2"
	$(PROD_COMPOSE) build
	@echo "$(GREEN)[SUCCESS]$(NC) Production Docker services built successfully"

.PHONY: prod-run
prod-run: ## Run the production services with PM2 cluster mode
	@echo "$(BLUE)[PROD-RUN]$(NC) Starting production services with PM2 cluster mode"
	@echo "$(GREEN)[INFO]$(NC) Starting services with real-time logs (Press Ctrl+C to stop)"
	@echo "$(BLUE)[INFO]$(NC) Access the application at: http://localhost:$(PORT)"
	@echo "$(YELLOW)[LOGS]$(NC) Service logs:"
	$(PROD_COMPOSE) up

.PHONY: prod-run-detached
prod-run-detached: ## Run the production services with PM2 in background
	@echo "$(BLUE)[PROD-RUN]$(NC) Starting production services in background with PM2"
	$(PROD_COMPOSE) up -d
	@echo "$(GREEN)[SUCCESS]$(NC) Production services started in background!"
	@echo "$(BLUE)[INFO]$(NC) Access the application at: http://localhost:$(PORT)"
	@echo "$(BLUE)[INFO]$(NC) Use 'make prod-logs' to view logs"

.PHONY: prod-logs
prod-logs: ## View production service logs (real-time)
	@echo "$(BLUE)[PROD-LOGS]$(NC) Following production service logs (Press Ctrl+C to stop):"
	$(PROD_COMPOSE) logs -f

.PHONY: prod-stop
prod-stop: ## Stop the production services
	@echo "$(BLUE)[PROD-STOP]$(NC) Stopping production services"
	$(PROD_COMPOSE) down
	@echo "$(GREEN)[SUCCESS]$(NC) Production services stopped"

# Clean up Docker cache and unused resources
.PHONY: clean
clean: ## Clean Docker cache and unused resources (both dev and prod)
	@echo "$(BLUE)[CLEAN]$(NC) Cleaning Docker cache and unused resources"
	$(DEV_COMPOSE) down --remove-orphans
	$(PROD_COMPOSE) down --remove-orphans
	docker system prune -f
	docker builder prune -f
	@echo "$(GREEN)[SUCCESS]$(NC) Docker cache cleaned"

# Reset node_modules volumes (use after package changes)
.PHONY: reset-deps
reset-deps: ## Reset frontend & backend node_modules volumes
	@echo "$(BLUE)[RESET-DEPS]$(NC) Resetting node_modules volumes (frontend & backend)"
	@echo "$(YELLOW)[WARNING]$(NC) This will remove all installed packages in containers"
	$(DEV_COMPOSE) down
	-docker volume rm realtime_yjs_server_client_node_modules 2>/dev/null || true
	-docker volume rm realtime_yjs_server_server_node_modules 2>/dev/null || true
	@echo "$(GREEN)[SUCCESS]$(NC) All node_modules volumes reset"
	@echo "$(BLUE)[INFO]$(NC) Run 'make build && make run' to reinstall packages"

# Nuclear option - remove everything related to this project
.PHONY: armageddon
armageddon: ## Remove ALL project-related Docker resources (containers, images, volumes)
	@echo "$(RED)[ARMAGEDDON]$(NC) This will remove ALL resources for this project!"
	@echo "$(YELLOW)[WARNING]$(NC) Press Ctrl+C within 5 seconds to cancel..."
	@sleep 5
	@echo "$(RED)[ARMAGEDDON]$(NC) Stopping and removing all project services..."
	-$(DEV_COMPOSE) down -v --rmi all 2>/dev/null
	-$(PROD_COMPOSE) down -v --rmi all 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing any remaining project containers..."
	-docker stop $(CONTAINER_NAME) realtime-yjs-redis realtime-yjs-redis-dev realtime-yjs-server 2>/dev/null
	-docker rm $(CONTAINER_NAME) realtime-yjs-redis realtime-yjs-redis-dev realtime-yjs-server 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing project images..."
	-docker rmi $(IMAGE_NAME) redis:7.4-alpine 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing project volumes..."
	-docker volume rm realtime_yjs_server_redis_data realtime_yjs_server_redis_data_dev 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing dangling images and build cache..."
	-docker image prune -f 2>/dev/null
	-docker builder prune -f 2>/dev/null
	@echo "$(GREEN)[SUCCESS]$(NC) Project armageddon completed - all project resources removed!"



# View development service logs
.PHONY: logs
logs: ## View development service logs (real-time)
	@echo "$(BLUE)[LOGS]$(NC) Following development service logs (Press Ctrl+C to stop):"
	$(DEV_COMPOSE) logs -f

# Stop the running development services
.PHONY: stop
stop: ## Stop the running development services
	@echo "$(BLUE)[STOP]$(NC) Stopping development services"
	$(DEV_COMPOSE) down
	@echo "$(GREEN)[SUCCESS]$(NC) Development services stopped"

# Access development container shell
.PHONY: shell
shell: ## Access the running development container shell
	@echo "$(BLUE)[SHELL]$(NC) Accessing development container shell"
	$(DEV_COMPOSE) exec app /bin/sh

# Access client container shell
.PHONY: shell-client
shell-client: ## Access the running client container shell
	@echo "$(BLUE)[SHELL]$(NC) Accessing client container shell"
	$(DEV_COMPOSE) exec client /bin/sh

# Check development service health
.PHONY: health
health: ## Check the health of running development services
	@echo "$(BLUE)[HEALTH]$(NC) Checking development service health"
	@echo "App service status:"
	@$(DEV_COMPOSE) ps app
	@echo "Client service status:"
	@$(DEV_COMPOSE) ps client
	@echo "Redis service status:"
	@$(DEV_COMPOSE) ps redis
	@echo "Testing connectivity:"
	@curl -f http://localhost:3000/health >/dev/null 2>&1 && echo "$(GREEN)[OK]$(NC) Backend API is responding" || echo "$(RED)[ERROR]$(NC) Backend API is not responding"
	@curl -f http://localhost:3001 >/dev/null 2>&1 && echo "$(GREEN)[OK]$(NC) React Client is responding" || echo "$(RED)[ERROR]$(NC) React Client is not responding"
