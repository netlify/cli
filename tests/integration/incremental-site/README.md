# Incremental Deploys

In this example, we upload one directory, then we _append_ (incrementally upload) to the deploy with a new directory.
This can be leveraged for build-time "on-demand ISR"-like capabilities with CI/CD caching the previous deploys file
digest.

1. Upload the `base-deploy` directory to a Netlify site

```
netlify deploy -d ./base-deploy
```

> ```
> ...
> ✔ CDN requesting 4 files
> ...
> ```

2. Confirm file `one` exists:

```
curl -I https://$WEBSITE_DRAFT_URL/one
```

> ```
> HTTP/2 200
> ...
> ```

3. Upload the `new-deploy` directory, but pass the existing file digest JSON

```
netlify deploy -d ./new-deploy --existing-file-digest "$(<./base-deploy.json)"
```

> ```
> ...
> ✔ CDN requesting 1 files
> ...
> ```

4. Confirm file `two` exists

```
curl -I https://$WEBSITE_DRAFT_URL/two
```

> ```
> HTTP/2 200
> ...
> ```

5. Confirm file `one` also _still_ exists

```
curl -I https://$WEBSITE_DRAFT_URL/one
```

> ```
> HTTP/2 200
> ...
> ```

```

```
