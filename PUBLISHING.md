# Publishing to the VS Code Marketplace

This document describes how to publish Jupyter Slide Navigator to the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hoelzl.jupyter-slide-nav).

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

### Creating a GitHub Release Too

If you also want a GitHub release (for the `.vsix` download), tag and push after
publishing:

```bash
git tag -a v0.x.y -m "Release v0.x.y"
git push origin v0.x.y
```

The existing GitHub Actions workflow (`.github/workflows/release.yml`) will
create a release with the `.vsix` attached.

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
