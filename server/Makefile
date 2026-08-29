# Simple Makefile for the ascii-empires-server Go project (same shape as journal's).

all: build test

build:
	@echo "Building..."
	@go build -o main cmd/api/main.go

run:
	@go run cmd/api/main.go

migrate:
	@go run cmd/migrate/migrate.go

# Local Postgres for dev
docker-run:
	@if docker compose -f docker-compose.dev.yml up --build 2>/dev/null; then \
		: ; \
	else \
		echo "Falling back to Docker Compose V1"; \
		docker-compose -f docker-compose.dev.yml up --build; \
	fi

docker-down:
	@if docker compose -f docker-compose.dev.yml down 2>/dev/null; then \
		: ; \
	else \
		echo "Falling back to Docker Compose V1"; \
		docker-compose -f docker-compose.dev.yml down; \
	fi

test:
	@echo "Testing..."
	@go test ./... -v

clean:
	@echo "Cleaning..."
	@rm -f main

# Live reload
watch:
	@if command -v air > /dev/null; then \
            air; \
            echo "Watching...";\
        else \
            read -p "Go's 'air' is not installed on your machine. Do you want to install it? [Y/n] " choice; \
            if [ "$$choice" != "n" ] && [ "$$choice" != "N" ]; then \
                go install github.com/air-verse/air@latest; \
                air; \
                echo "Watching...";\
            else \
                echo "You chose not to install air. Exiting..."; \
                exit 1; \
            fi; \
        fi

.PHONY: all build run migrate test clean watch docker-run docker-down
