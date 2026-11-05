#!/usr/bin/env bash
set -eu
# Bun module mocks persist between files; a fresh process prevents cross-suite pollution.
for file in src/lib/*.test.ts; do
  bun test "$file"
done