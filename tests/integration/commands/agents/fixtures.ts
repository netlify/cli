// Test fixtures for agents integration tests

export const mockSiteInfo = {
  admin_url: 'https://app.netlify.com/projects/site-name/overview',
  ssl_url: 'https://site-name.netlify.app/',
  id: 'site_id',
  name: 'site-name',
  build_settings: {
    repo_branch: 'main',
    repo_url: 'https://github.com/owner/repo',
  },
}

export const mockSiteInfoNoRepo = {
  admin_url: 'https://app.netlify.com/projects/zip-site/overview',
  ssl_url: 'https://zip-site.netlify.app/',
  id: 'zip_site_id',
  name: 'zip-site',
  // No build_settings
}

export const mockUser = {
  id: 'user_id',
  full_name: 'Test User',
  email: 'test@example.com',
}

export const mockAccount = {
  id: 'account_id',
  slug: 'test-account',
}

export const mockAgentRunner = {
  id: 'agent_runner_id',
  site_id: 'site_id',
  state: 'new',
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2024-01-15T10:30:00.000Z',
  title: 'Create a login form',
  branch: 'main',
  user: {
    id: 'user_id',
    full_name: 'Test User',
  },
}

export const mockAgentRunnerNoRepo = {
  id: 'agent_runner_no_repo_id',
  site_id: 'zip_site_id',
  state: 'new',
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2024-01-15T10:30:00.000Z',
  title: 'Add a contact form',
  // No branch field for non-git sites
  user: {
    id: 'user_id',
    full_name: 'Test User',
  },
}

export const mockAgentSession = {
  id: 'session_id',
  agent_runner_id: 'agent_runner_id',
  state: 'done',
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2024-01-15T10:45:00.000Z',
  done_at: '2024-01-15T10:45:00.000Z',
  title: 'Create a login form',
  prompt: 'Create a login form with email and password fields',
  agent_config: {
    agent: 'claude',
    model: 'claude-3-sonnet',
  },
  result: 'Successfully created login form component with validation',
  duration: 900,
}
