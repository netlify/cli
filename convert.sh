#!/bin/bash

# The directory where you want to start renaming files
directory="/Users/ericapisani/netlify/cli/src/functions-templates"

# Find all '.mjs' files and rename them to '.ts'
find "$directory" -type f -name "*.mjs" -exec sh -c 'mv "$0" "${0%.mjs}.js"' {} \;
