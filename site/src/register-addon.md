---
title: Register a new Netlify Addon
description: Netlify Command line interface (CLI) documentation
hidden: true
hidePagination: true
---

# Netlify addons

A Netlify addon is a way for Netlify users to extend their sites.

For example a user can provision additional functionality on their site by running:

```bash
netlify addons:create your-addon-namespace
```

This would create a new instance of `your-addon-namespace` for that Netlify Site.

**Some example of Netlify addons:**

- Automatically inject error tracking into your app
- Provision a new database
- Setup `env` variables in Netlify's build context for users Automatically
- ...sky is the limit

## Register Addon

Do you have an addon idea that you'd like to create? Let us know

<form name="register-addon" action="/register-addon-thanks" method="post" data-netlify="true">
  <input type="hidden" name="form-name" value="register-addon" />
  <p>
    <div>
      <label>Your Name:</label>
    </div>
    <input
      type="text"
      name="name"
      placeholder='Name'
      style={{
        width: 300,
        padding: 10,
        border: '2px solid',
        fontSize: '16px',
        marginTop: '5px'
      }}
    />
  </p>
  <p>
    <div>
      <label>Your Email:</label>
    </div>
    <input
      type="email"
      name="email"
      placeholder='Email'
      style={{
        width: 300,
        padding: 10,
        border: '2px solid',
        fontSize: '16px',
        marginTop: '5px'
      }}
    />
  </p>
  <p>
    <div>
      <label>Addon description:</label>
    </div>
    <textarea name="addon-description"
      style={{
        width: 400,
        height: 120,
        padding: 10,
        marginTop: 5,
        border: '2px solid',
        fontSize: '16px',
      }}
      placeholder='Tell us a little bit more about your addon'
    />
  </p>
  <p>
    <button type="submit" style={{
        padding: '11px 20px',
        background: 'white',
        border: '2px solid black',
        fontSize: '20px',
        cursor: 'pointer'
      }}>
      Request Addon Registration
    </button>
  </p>
</form>
