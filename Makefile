# Makefile for Realtime YJS Server Docker Management
# Usage: make [target]

# Variables
IMAGE_NAME := realtime-yjs-server
CONTAINER_NAME := realtime-yjs-server
PORT := 3000

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
	@echo "$(GREEN)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Build the Docker image using Docker Compose
.PHONY: build
build: ## Build the Docker image using Docker Compose
	@echo "$(BLUE)[BUILD]$(NC) Building Docker services with Docker Compose"
	docker-compose build
	@echo "$(GREEN)[SUCCESS]$(NC) Docker services built successfully"

# Run the Docker services with real-time logs using Docker Compose
.PHONY: run
run: ## Run the Docker services with real-time logs using Docker Compose
	@echo "$(BLUE)[RUN]$(NC) Starting services with Docker Compose"
	@echo "$(GREEN)[INFO]$(NC) Starting services with real-time logs (Press Ctrl+C to stop)"
	@echo "$(BLUE)[INFO]$(NC) Access the application at: http://localhost:$(PORT)"
	@echo "$(YELLOW)[LOGS]$(NC) Service logs:"
	docker-compose up

# Run the Docker services in background (detached) using Docker Compose
.PHONY: run-detached
run-detached: ## Run the Docker services in background using Docker Compose
	@echo "$(BLUE)[RUN]$(NC) Starting services in background with Docker Compose"
	docker-compose up -d
	@echo "$(GREEN)[SUCCESS]$(NC) Services started in background!"
	@echo "$(BLUE)[INFO]$(NC) Access the application at: http://localhost:$(PORT)"
	@echo "$(BLUE)[INFO]$(NC) Use 'make logs' to view logs or 'make shell' to access container"

# Clean up Docker cache and unused resources
.PHONY: clean
clean: ## Clean Docker cache and unused resources (scoped to project)
	@echo "$(BLUE)[CLEAN]$(NC) Cleaning Docker cache and unused resources"
	docker-compose down --remove-orphans
	docker system prune -f
	docker builder prune -f
	@echo "$(GREEN)[SUCCESS]$(NC) Docker cache cleaned"

# Nuclear option - remove everything related to this project
.PHONY: armageddon
armageddon: ## Remove ALL project-related Docker resources (containers, images, volumes)
	@echo "$(RED)[ARMAGEDDON]$(NC) This will remove ALL resources for this project!"
	@echo "$(YELLOW)[WARNING]$(NC) Press Ctrl+C within 5 seconds to cancel..."
	@sleep 5
	@echo "$(RED)[ARMAGEDDON]$(NC) Stopping and removing all project services..."
	-docker-compose down -v --rmi all 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing any remaining project containers..."
	-docker stop $(CONTAINER_NAME) realtime-yjs-redis 2>/dev/null
	-docker rm $(CONTAINER_NAME) realtime-yjs-redis 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing project images..."
	-docker rmi $(IMAGE_NAME) redis:7.4-alpine 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing project volumes..."
	-docker volume rm realtime_y_socket_yjs_servert_redis_data 2>/dev/null
	@echo "$(RED)[ARMAGEDDON]$(NC) Removing dangling images and build cache..."
	-docker image prune -f 2>/dev/null
	-docker builder prune -f 2>/dev/null
	@echo "$(GREEN)[SUCCESS]$(NC) Project armageddon completed - all project resources removed!"



# View service logs
.PHONY: logs
logs: ## View service logs (real-time) using Docker Compose
	@echo "$(BLUE)[LOGS]$(NC) Following service logs (Press Ctrl+C to stop):"
	docker-compose logs -f

# Stop the running services
.PHONY: stop
stop: ## Stop the running services using Docker Compose
	@echo "$(BLUE)[STOP]$(NC) Stopping services with Docker Compose"
	docker-compose down
	@echo "$(GREEN)[SUCCESS]$(NC) Services stopped"

# Access container shell
.PHONY: shell
shell: ## Access the running container shell using Docker Compose
	@echo "$(BLUE)[SHELL]$(NC) Accessing container shell"
	docker-compose exec app /bin/sh

# Check service health
.PHONY: health
health: ## Check the health of running services
	@echo "$(BLUE)[HEALTH]$(NC) Checking service health"
	@echo "App service status:"
	@docker-compose ps app
	@echo "Redis service status:"
	@docker-compose ps redis
	@echo "Testing app connectivity:"
	@curl -f http://localhost:3000 >/dev/null 2>&1 && echo "$(GREEN)[OK]$(NC) App is responding" || echo "$(RED)[ERROR]$(NC) App is not responding"
