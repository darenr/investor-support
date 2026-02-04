.PHONY: install run build clean

install:
	npm install

run:
	@if [ -z "$$OPENAI_API_KEY" ] && [ -z "$$GEMINI_API_KEY" ]; then \
		echo "Warning: Neither OPENAI_API_KEY nor GEMINI_API_KEY is set."; \
	fi
	npm start

build:
	npm run build

clean:
	rm -rf dist
	rm -rf release
