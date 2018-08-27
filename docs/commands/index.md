---
title: Netlify CLI Commands List
description: All netlify CLI command
---

List of all commands


<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_LIST) -->
### [Addons](/commands/command)

#### addons:create

Add an addon extension to your site
...
Addons are a way to extend the functionality of your Netlify site




#### addons:delete

Remove an addon extension to your site
...
Addons are a way to extend the functionality of your Netlify site




#### commands:addons

Handle addon operations
The addons command will help you manage all your netlify addons


```
$ netlify addons:create addon-xyz --value foo
$ netlify addons:update addon-xyz --value bar
$ netlify addons:delete addon-xyz
$ netlify addons:list
```

#### addons:list

list current site addons
...
Addons are a way to extend the functionality of your Netlify site




#### addons:update

Update an addon extension
...
Addons are a way to extend the functionality of your Netlify site




    
### [Deploy](/commands/command)

#### commands:deploy

Create a new deploy from the contents of a folder.



    
### [Functions](/commands/command)


    
### [Link](/commands/command)

#### commands:link

Link a local repo or project folder to an existing site on Netlify

```
$ netlify init --id 123-123-123-123
$ netlify init --name my-site-name
```

    
### [Login](/commands/command)

#### commands:login

Login to account



    
### [Logout](/commands/command)

#### commands:logout

Logout of account



    
### [Open](/commands/command)


    
### [Sites](/commands/command)

#### sites:create

create a site
...
Create an empty site




#### sites:delete

delete a site
...
Extra documentation goes here


```
$ netlify site:delete 123-432621211
```

#### commands:sites

Handle site operations
The sites command will help you manage all your sites


```
$ netlify sites:create --name my-new-site
$ netlify sites:update --name my-new-site
$ netlify sites:delete --name my-new-site
$ netlify sites:list
```

#### sites:list

list sites
...
Extra documentation goes here




#### sites:update

update a site
...
Extra documentation goes here




    
### [Status](/commands/command)

#### commands:status

Print currently logged in user



    
### [Unlink](/commands/command)

#### commands:unlink

Unlink a local repo from a Netlify site



    

<!-- AUTO-GENERATED-CONTENT:END -->
