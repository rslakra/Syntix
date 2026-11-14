.PHONY: help setup start web check status clean

# =============================================================================
# ews — Syntix client: a React Native (Expo) app for the iws API
# =============================================================================

PROJECT_TITLE ?= Syntix app (React Native)

.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "$(PROJECT_TITLE) (ews)"
	@echo "=============================="
	@echo ""
	@echo "  make setup     Install the npm dependencies"
	@echo "  make web       Start Expo in the browser (http://localhost:8081)"
	@echo "  make start     Start Expo (press w for browser, i for iOS simulator, a for Android)"
	@echo "  make check     Type-check the app"
	@echo "  make status    Show whether the dependencies are installed"
	@echo "  make clean     Remove node_modules and the Expo cache"
	@echo ""
	@echo "The app talks to the iws API (AiSuite/Syntix/iws): start that first."
	@echo ""

setup:
	@command -v npm >/dev/null 2>&1 || (echo "Error: Node.js and npm are required for the app." >&2; exit 1)
	npm install

start:
	@test -d node_modules || (echo "Run: make setup" >&2; exit 1)
	npx expo start

web:
	@test -d node_modules || (echo "Run: make setup" >&2; exit 1)
	npx expo start --web

check:
	@test -d node_modules || (echo "Run: make setup" >&2; exit 1)
	npx tsc --noEmit

status:
	@if [ -d "node_modules" ]; then echo "node_modules: ok"; else echo "node_modules: run make setup"; fi
	@command -v node >/dev/null 2>&1 && echo "node: $$(node --version)" || echo "node: not found"

clean:
	rm -rf node_modules .expo
