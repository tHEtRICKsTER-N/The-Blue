# Low-cost hosting for ABYSS

Recommended starting setup: Cloudflare Pages Free + a normal, non-premium domain + a private GitHub repository. The game runs locally in each visitor's browser. This static edition needs no database, server process, or paid dialogue service. The authored dialogue is included in the download.

Hosting is $0/month within the published free limits. The domain is a separate yearly purchase: budget roughly US$10–20/year for an ordinary .com, then check the actual registration AND renewal quote, taxes, and exchange rate before buying. This is a planning estimate, not a registrar quote. Premium names and other extensions can cost much more. Cloudflare Registrar sells supported names at registry/ICANN cost without markup. A free pages.dev address can be used before buying a domain.

## First deployment

1. Put this project's source in a GitHub repository you own. Keep node_modules, dist, dist-static, outputs, .env files, and credentials excluded. Use the existing .gitignore. A private source repository is fine; the deployed website is public unless you separately configure access protection.
2. In Cloudflare, create a **Pages** project and connect that repository through Git integration. Choose production branch `main`, framework preset `None`, build command `npm run build:static`, and output directory `dist-static`. Leave the root directory as the repository root. Set the build environment variable `NODE_VERSION` to `22.16.0` (or a newer supported Node 22/24 release).
3. Deploy and open the generated pages.dev address. Check entering the ocean, changing settings, sound, and fullscreen in a regular browser. This standalone build does not use the private Sites sign-in wrapper.
4. Buy your chosen domain. Add it under the Pages project's **Custom domains** and follow the DNS instructions. For an apex domain such as example.com, add the zone to Cloudflare and point its nameservers to Cloudflare. A subdomain such as play.example.com can instead use the prescribed CNAME at an external DNS provider. Add the domain through Pages before manually creating DNS records. Cloudflare provisions HTTPS; don't buy a separate SSL certificate.

## Keep improving the live game

Edit the same project, test locally, commit, and push to the connected repository. Cloudflare rebuilds and deploys automatically. Your domain stays the same. Use a feature branch for a preview, then merge into main when ready; roll back a deployment if necessary. Players already in a session load the updated code on their next reload, rather than having a running expedition replaced mid-frame.

The normal `npm run dev` and `npm run build` still serve the Sites workflow. The portable website uses `npm run build:static`. To test that exact output locally, run `npx vite preview --config vite.static.config.mjs --host 127.0.0.1` and open the printed URL. Deploy **dist-static**, not the Sites server build in dist. Every asset must remain below the provider's individual-file limit.

## Costs and limits checked September 10, 2026

- Pages Free: 500 builds/month, one build at a time, 20,000 files, 25 MiB per file, and up to 100 custom domains per project. Static requests and bandwidth are included without a metered charge on the advertised Pages plans. Functions have separate Workers limits; this static build has none.
- Domain: annual registration/renewal only for this setup, plus applicable taxes. Check renewal pricing rather than choosing solely by a discounted first year.
- Vercel Hobby is an alternative for personal, non-commercial projects, but its commercial-use restriction makes it a less flexible default if you later monetize this game.
- Multiplayer, cloud saves, user accounts, AI-generated dialogue, or large externally stored media would need a separate cost review. None are required by this build.

Official references:

- [Cloudflare Pages plans](https://www.cloudflare.com/en-gb/developer-platform/products/pages/)
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Automatic Git deployments](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Custom domains and DNS](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Registrar pricing approach](https://www.cloudflare.com/products/registrar/)
- [Vercel Hobby restrictions](https://vercel.com/docs/plans/hobby)
