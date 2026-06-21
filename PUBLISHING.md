# Publishing to the VS Code Marketplace and Open VSX Registry

This document describes how to publish Jupyter Slide Navigator to the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hoelzl.jupyter-slide-nav)
and the [Open VSX Registry](https://open-vsx.org/extension/hoelzl/jupyter-slide-nav)
(used by VS Codium, Eclipse Theia, Gitpod, and other open-source VS Code alternatives).

## One-Time Setup

### 1. Create a Publisher Account

1. Go to <https://marketplace.visualstudio.com/manage> and sign in with a
   Microsoft account.
2. Create a **publisher** with the ID `hoelzl` (this must match the
   `"publisher"` field in `package.json`).

### 2. Create a Personal Access Token (PAT)

The Marketplace uses Azure DevOps PATs for authentication.

1. Go to <https://dev.azure.com> and sign in with the same Microsoft account.
2. If you don't have an Azure DevOps organization yet, you'll be prompted to
   create one (the name doesn't matter).
3. Click the **User Settings** icon (top-right) > **Personal access tokens**.
4. Click **New Token**.
5. Configure the token:
   - **Name**: something descriptive, e.g. `vsce-publish`
   - **Organization**: select **All accessible organizations**
   - **Expiration**: up to 1 year (you'll need to renew it when it expires)
   - **Scopes**: select **Custom defined**, then find **Marketplace** and check
     **Manage**
6. Click **Create** and **copy the token immediately** — you won't be able to
   see it again.

### 3. Log In with `vsce`

```bash
npx @vscode/vsce login hoelzl
```

Paste your PAT when prompted. The credential is stored locally.

### 4. Set Up Open VSX (Optional)

Open VSX is an open alternative registry used by VS Codium, Gitpod, and other
editors. To publish there as well:

1. Go to <https://open-vsx.org/> and sign in with your **GitHub** account.
2. Go to <https://open-vsx.org/user-settings/tokens> and click
   **Generate New Token**.
3. Copy the token immediately.

#### For CI (GitHub Actions)

Add the token as a repository secret named `OVSX_TOKEN`:

1. Go to your repo's **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**.
3. Name: `OVSX_TOKEN`, Value: paste the token.

The release workflow will automatically publish to Open VSX when this secret is
present.

#### For Local Publishing

```bash
npx ovsx publish *.vsix -p <your-ovsx-token>
```

Or set the token as an environment variable:

```bash
export OVSX_PAT=<your-ovsx-token>
npx ovsx publish *.vsix
```

## Publishing a New Version

### Quick Publish (bump + publish in one step)

```bash
npx @vscode/vsce publish patch   # 0.2.4 → 0.2.5
npx @vscode/vsce publish minor   # 0.2.4 → 0.3.0
npx @vscode/vsce publish major   # 0.2.4 → 1.0.0
```

This bumps the version in `package.json`, runs the `vscode:prepublish` script
(which compiles TypeScript), packages the `.vsix`, and uploads it. The extension
typically appears on the Marketplace within a few minutes.

### Manual Version Bump

If you prefer to control the version yourself:

1. Update the `"version"` field in `package.json`.
2. Update `CHANGELOG.md` with the new version's changes.
3. Run:

```bash
npx @vscode/vsce publish
```

### Publishing to Open VSX (Local)

After publishing to the Marketplace, you can also publish the same `.vsix` to
Open VSX:

```bash
npx ovsx publish *.vsix -p <your-ovsx-token>
```

Or, if you prefer everything automated, just use the tag-based workflow below.

### Creating a GitHub Release Too

If you also want a GitHub release (for the `.vsix` download), tag and push after
publishing:

```bash
git tag -a v0.x.y -m "Release v0.x.y"
git push origin v0.x.y
```

The existing GitHub Actions workflow (`.github/workflows/release.yml`) will
create a release with the `.vsix` attached and publish to Open VSX (if the
`OVSX_TOKEN` secret is configured).

## Renewing an Expired PAT

When your PAT expires, `vsce publish` will fail with an authentication error.

1. Go to <https://dev.azure.com> > **User Settings** > **Personal access tokens**.
2. Create a new token with the same settings as above (or regenerate the
   existing one).
3. Log in again:

```bash
npx @vscode/vsce login hoelzl
```

## Notes

- **Icon**: The Marketplace recommends a 128x128 or 256x256 PNG icon. To add
  one, place the image in the repo (e.g. `images/icon.png`) and add to
  `package.json`:

  ```json
  "icon": "images/icon.png"
  ```

- **Pre-publish checks**: The `vscode:prepublish` script in `package.json` runs
  `npm run compile` automatically before packaging. If the build fails, the
  publish is aborted.
