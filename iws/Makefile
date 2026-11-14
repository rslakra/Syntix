.PHONY: help setup install start test status show-config clean init-env \
	setup-infra check-infra-status check-infra-logs stack-up stack-down check-models

# =============================================================================
# iws — Syntix meeting-intelligence API (customize PROJECT_TITLE and APP_MODULE)
# =============================================================================

# Root of the project = the folder that contains this Makefile, no matter where make is
# started from (`make -C path/to/iws`, `make -f path/to/iws/Makefile`, a subfolder, ...).
# Every path below is built from it instead of relying on the current directory.
ROOT_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
ENV_FILE := $(ROOT_DIR)/.env
REQUIREMENTS := $(ROOT_DIR)/requirements.txt
TESTS_DIR := $(ROOT_DIR)/tests

PROJECT_TITLE ?= Syntix - IWS Service
COMPOSE ?= docker compose --project-directory "$(ROOT_DIR)" --env-file "$(ENV_FILE)" -f "$(ROOT_DIR)/docker-compose.yml"
APP_MODULE ?= app.main
VENV_DIR ?= $(ROOT_DIR)/.venv
PYTHON ?= $(VENV_DIR)/bin/python
PIP ?= $(VENV_DIR)/bin/pip
PYTEST ?= $(VENV_DIR)/bin/pytest

API_HOST ?= 0.0.0.0
API_PORT ?= 8080
PYTHONPATH ?= $(ROOT_DIR)

.DEFAULT_GOAL := help

define venv_ok
{ [ -f "$(PYTHON)" ] && "$(PYTHON)" --version >/dev/null 2>&1 && "$(PIP)" --version >/dev/null 2>&1; }
endef

help:
	@echo ""
	@echo "$(PROJECT_TITLE) (iws layout)"
	@echo "=============================="
	@echo "Project root: $(ROOT_DIR)"
	@echo ""
	@echo "  make init-env     Copy .env.sample from the template root to .env"
	@echo "  make setup        Create Python virtualenv (.venv)"
	@echo "  make install      Install dependencies from requirements.txt"
	@echo "  make start        Start the API ($(APP_MODULE))"
	@echo "  make test         Run pytest (optional: FILE=tests/test_foo.py, relative to the project root)"
	@echo "  make status       Show venv and .env status"
	@echo "  make show-config  Print Makefile variables"
	@echo "  make clean        Remove venv and pytest cache"
	@echo ""
	@echo "AI models (Ollama + speech-to-text) come from the shared ZeroCloud stack, not from this project:"
	@echo "  make check-models        Check that ZeroCloud answers and has the models from .env"
	@echo ""
	@echo "Docker (Postgres+pgvector):"
	@echo "  make setup-infra         Start Postgres; the API runs locally via make start"
	@echo "  make stack-up            Start Postgres AND the API in a container (needs ZeroCloud running)"
	@echo "  make check-infra-status  Show container status"
	@echo "  make check-infra-logs    Follow container logs"
	@echo "  make stack-down          Stop all containers (data in DATA_DIR is kept)"
	@echo ""
	@echo "First time: (in ZeroCloud) make setup && make start && make setup-models"
	@echo "            make init-env && make setup-infra && make check-models"
	@echo "            make setup && make install && make start"
	@echo ""

init-env:
	@if [ -f "$(ENV_FILE)" ]; then echo "$(ENV_FILE) already exists"; exit 1; fi
	@if [ -f "$(ROOT_DIR)/.env.sample" ]; then \
		cp "$(ROOT_DIR)/.env.sample" "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE) from $(ROOT_DIR)/.env.sample"; \
	elif [ -f "$(ROOT_DIR)/../.env.sample" ]; then \
		cp "$(ROOT_DIR)/../.env.sample" "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE) from $(ROOT_DIR)/../.env.sample"; \
	elif [ -f "$(ROOT_DIR)/../../.env.sample" ]; then \
		cp "$(ROOT_DIR)/../../.env.sample" "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE) from $(ROOT_DIR)/../../.env.sample"; \
	else \
		echo "Error: .env.sample not found in $(ROOT_DIR), its parent or grandparent" >&2; exit 1; \
	fi

show-config:
	@echo "ROOT_DIR=$(ROOT_DIR)"
	@echo "ENV_FILE=$(ENV_FILE)"
	@echo "PROJECT_TITLE=$(PROJECT_TITLE)"
	@echo "APP_MODULE=$(APP_MODULE)"
	@echo "API_HOST=$(API_HOST)"
	@echo "API_PORT=$(API_PORT)"
	@echo "PYTHONPATH=$(PYTHONPATH)"
	@echo "VENV_DIR=$(VENV_DIR)"

status:
	@echo "Setup Status"
	@echo "============"
	@echo "Project root: $(ROOT_DIR)"
	@if [ -f "$(VENV_DIR)/pyvenv.cfg" ]; then \
		if $(venv_ok); then echo "Python venv: ok ($(VENV_DIR))"; \
		else echo "Python venv: stale — run: make clean && make setup"; fi; \
	else echo "Python venv: not found (run: make setup)"; fi
	@if [ -f "$(ENV_FILE)" ]; then echo "Environment: .env found"; \
	else echo "Environment: .env missing (run: make init-env)"; fi
	@if $(venv_ok); then "$(PYTHON)" --version; fi

setup:
	@if ! command -v python3 >/dev/null 2>&1; then echo "Python 3 not found."; exit 1; fi
	@if $(venv_ok); then echo "Virtualenv ok: $(VENV_DIR)"; \
	elif [ -d "$(VENV_DIR)" ]; then rm -rf "$(VENV_DIR)"; python3 -m venv "$(VENV_DIR)"; \
	else python3 -m venv "$(VENV_DIR)"; fi
	@echo "Done. Next: make install"

install:
	@if ! $(venv_ok); then rm -rf "$(VENV_DIR)"; python3 -m venv "$(VENV_DIR)"; fi
	@if [ ! -f "$(REQUIREMENTS)" ]; then \
		echo "Warning: $(REQUIREMENTS) missing — create it before install" >&2; \
	fi
	"$(PIP)" install --upgrade pip
	@if [ -f "$(REQUIREMENTS)" ]; then "$(PIP)" install -r "$(REQUIREMENTS)"; fi
	@echo "Done. Next: make start"

start: install
	@if [ ! -f "$(ENV_FILE)" ]; then echo "Error: $(ENV_FILE) not found. Run: make init-env" >&2; exit 1; fi
	@port="$(API_PORT)"; \
	if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Error: port $$port is in use." >&2; exit 1; \
	fi; \
	display_host="$(API_HOST)"; \
	if [ "$$display_host" = "0.0.0.0" ]; then display_host=localhost; fi; \
	echo "API: http://$$display_host:$(API_PORT)"; \
	cd "$(ROOT_DIR)" && PYTHONPATH="$(PYTHONPATH)" "$(PYTHON)" -m $(APP_MODULE)

test: install
	@if [ ! -f "$(ENV_FILE)" ]; then echo "Error: $(ENV_FILE) not found. Run: make init-env" >&2; exit 1; fi
	@if [ ! -d "$(TESTS_DIR)" ]; then echo "Error: $(TESTS_DIR) missing — add pytest tests first" >&2; exit 1; fi
	@cd "$(ROOT_DIR)" && PYTHONPATH="$(PYTHONPATH)" "$(PYTEST)" $(if $(FILE),$(FILE),tests/)

clean:
	rm -rf "$(VENV_DIR)" "$(ROOT_DIR)/.pytest_cache"

# --- Docker stack ------------------------------------------------------------

define require_docker
@if ! command -v docker >/dev/null 2>&1; then echo "Error: docker not found." >&2; exit 1; fi
@if [ ! -f "$(ENV_FILE)" ]; then echo "Error: $(ENV_FILE) not found. Run: make init-env" >&2; exit 1; fi
endef

# Loads .env, requires DATA_DIR and makes it absolute ("~" expanded) so docker compose gets
# a real path. Every data folder (postgres, recordings) lives under it. The AI models are not
# stored here: ZeroCloud keeps them in its own DATA_DIR.
# COMPOSE passes --project-directory, so the relative mounts in docker-compose.yml
# (./.env, ./infra/...) and the build context also resolve against ROOT_DIR.
LOAD_ENV = set -a; . "$(ENV_FILE)"; set +a; \
	: "$${DATA_DIR:?DATA_DIR is not set in $(ENV_FILE)}"; \
	case "$$DATA_DIR" in "~"|"~/"*) DATA_DIR="$$HOME$${DATA_DIR\#"~"}";; esac; \
	export DATA_DIR

DATA_SUBDIRS = recordings

# Starts Postgres without the API. The AI models run in ZeroCloud (see check-models).
setup-infra:
	$(require_docker)
	@$(LOAD_ENV); \
	for d in $(DATA_SUBDIRS) "postgres/pg$${POSTGRES_VERSION:-18}"; do mkdir -p "$$DATA_DIR/$$d"; done; \
	echo "Data folder: $$DATA_DIR"; \
	$(COMPOSE) up -d postgres
	@echo "Next: make check-models   (the models come from ZeroCloud)"

# Shows the status of the infrastructure containers.
check-infra-status:
	$(require_docker)
	@$(LOAD_ENV); $(COMPOSE) --profile app ps

# Shows the logs of the infrastructure containers.
check-infra-logs:
	$(require_docker)
	@$(LOAD_ENV); $(COMPOSE) --profile app logs -f --tail=100

# Checks that the endpoints in .env (ZeroCloud's) answer and have the models this project uses
# (LLM_MODEL, EMBEDDING_MODEL, STT_MODEL). A missing model must be added to the model lists in
# ZeroCloud/.env and downloaded there with `make setup-models`.
check-models:
	@if [ ! -f "$(ENV_FILE)" ]; then echo "Error: $(ENV_FILE) not found. Run: make init-env" >&2; exit 1; fi
	@set -a; . "$(ENV_FILE)"; set +a; status=0; \
	check() { \
		if curl -fsS "$$2/models/$$3" >/dev/null 2>&1; then \
			echo "$$1: ok ($$3 at $$2)"; \
		else \
			echo "$$1: NOT available ($$3 at $$2)" >&2; status=1; \
		fi; \
	}; \
	check "Chat          " "$$LLM_BASE_URL" "$$LLM_MODEL"; \
	check "Embeddings    " "$${EMBEDDING_BASE_URL:-$$LLM_BASE_URL}" "$$EMBEDDING_MODEL"; \
	check "Speech-to-text" "$$STT_BASE_URL" "$$STT_MODEL"; \
	if [ $$status -ne 0 ]; then \
		echo "" >&2; \
		echo "Start ZeroCloud (make start) and make sure the models above are in its .env lists" >&2; \
		echo "(LLM_MODELS, EMBEDDING_MODELS, STT_MODELS), then run make setup-models there." >&2; \
	fi; \
	exit $$status

# Starts Postgres and the API. The API reaches the AI models through ZeroCloud's Docker network.
stack-up:
	$(require_docker)
	@if ! docker network inspect zerocloud >/dev/null 2>&1; then \
		echo "Error: the Docker network 'zerocloud' does not exist. Start ZeroCloud first (make start there)." >&2; exit 1; \
	fi
	@$(LOAD_ENV); \
	for d in $(DATA_SUBDIRS) "postgres/pg$${POSTGRES_VERSION:-18}"; do mkdir -p "$$DATA_DIR/$$d"; done; \
	echo "Data folder: $$DATA_DIR"; \
	$(COMPOSE) --profile app up -d --build

# Stops all containers while preserving data in DATA_DIR.
stack-down:
	$(require_docker)
	@$(LOAD_ENV); $(COMPOSE) --profile app down
