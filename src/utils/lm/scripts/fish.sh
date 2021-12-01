#!/usr/bin/env fish

# Only append to PATH if it isn't already part of the list
# `fish_add_path` - https://fishshell.com/docs/current/cmds/fish_add_path.html?highlight=fish_add_path would be a more
# suited alternative but it's only supported in fish 3.3.x
if not contains (dirname (status --current-filename))/bin $fish_user_paths
  set -U fish_user_paths (dirname (status --current-filename))/bin $fish_user_paths
end
