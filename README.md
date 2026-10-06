# armen-sulejmani.com

Personal website of **Armen Sulejmani** — Research & Software Engineer at the Luxembourg Institute of Science and Technology.

Plain static HTML/CSS/JS deployed to GitHub Pages — no framework, no build step.

The site is built around one metaphor: a **model** (UML class diagram, blue) is read by an **agent** (trace, green) that
generates the page as **blocks** (amber). See [How this site was built](https://armen-sulejmani.com/log/how-this-site-was-built/).

## Structure

```
index.html                          homepage
log/index.html                      log (blog) index
log/<slug>/index.html               one folder per post
assets/css/site.css                 shared tokens, nav, footer, log/post styles
assets/css/home.css                 homepage-only styles
assets/js/site.js                   theme, nav, mail obfuscation, reveal, secrets
assets/js/home.js                   hero sequence, block name, pixelated covers, terminal
404.html                            meta-redirect to /
CNAME                               custom domain (armen-sulejmani.com)
images/  files/                     photos, logos, icons, CV
```

### Adding a log entry

1. Copy `log/how-this-site-was-built/` to `log/<new-slug>/` and edit it.
2. Add an entry to `log/index.html` and to the Log section in `index.html` (and bump `Entry[n]`).
3. Add the URL to `sitemap.xml`.

## Local preview

The pages use directory URLs (`log/`), so serve the folder rather than opening files directly:

```bash
python -m http.server 8000
```

then visit http://localhost:8000.

## License

[MIT](LICENSE.md)
