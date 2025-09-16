# Setup Guide

This guide explains how to set up the bleeding edge build system for tscircuit.

## Required GitHub Secrets

The following secrets must be configured in your GitHub repository settings to enable automated uploads to Cloudflare R2:

### Cloudflare R2 Configuration

1. **CLOUDFLARE_ACCOUNT_ID**
   - Your Cloudflare account ID
   - Found in the right sidebar of your Cloudflare dashboard

2. **CLOUDFLARE_R2_ACCESS_KEY_ID** 
   - R2 API token access key ID
   - Create in Cloudflare dashboard → R2 → Manage R2 API tokens

3. **CLOUDFLARE_R2_SECRET_ACCESS_KEY**
   - R2 API token secret access key  
   - Generated along with the access key ID

4. **CLOUDFLARE_R2_BUCKET_NAME**
   - Name of your R2 bucket (e.g., "tarballs")
   - Create in Cloudflare dashboard → R2 → Create bucket

## Setting up Cloudflare R2

1. **Create an R2 bucket:**
   ```bash
   # Via Cloudflare dashboard or CLI
   # Make sure it's publicly accessible for tarball downloads
   ```

2. **Configure public access:**
   - Set up a custom domain (e.g., `tarballs.tscircuit.com`)
   - Configure CORS settings if needed
   - Ensure public read access for the tarballs

3. **Create API tokens:**
   - Go to Cloudflare dashboard → R2 → Manage R2 API tokens
   - Create token with "Object Read and Write" permissions
   - Save the Access Key ID and Secret Access Key

## Adding Secrets to GitHub

1. Go to your repository settings
2. Navigate to "Secrets and variables" → "Actions"  
3. Click "New repository secret"
4. Add each of the four required secrets listed above

## Testing the Setup

1. Go to Actions tab in your repository
2. Select "Build Bleeding Edge TSCircuit" workflow
3. Click "Run workflow"
4. Monitor the build process and check for successful upload

## Troubleshooting

### Common Issues

**Authentication errors:**
- Verify all secrets are correctly set
- Check that R2 API token has proper permissions
- Ensure account ID matches your Cloudflare account

**Upload failures:**
- Verify bucket name is correct
- Check bucket permissions allow writes
- Ensure R2 service is enabled on your account

**Build failures:**
- Some repositories may fail to clone (this is handled gracefully)
- Individual package builds may fail (fallback mechanisms in place)
- Check GitHub Actions logs for specific error details

### Manual Testing

You can test the build process locally:

```bash
# Clone this repository
git clone https://github.com/tscircuit/tscircuit-bleeding
cd tscircuit-bleeding

# Install dependencies
npm install

# Run test build (limited repositories)
npm run test-build

# Run full build (requires significant time/resources)
# npm run build
```

## Customization

### Modifying Repository List

Edit `scripts/build.js` and update the `TSCIRCUIT_REPOS` array to add/remove repositories:

```javascript
const TSCIRCUIT_REPOS = [
  'tscircuit/core',
  'tscircuit/soup',
  // Add your repositories here
];
```

### Changing Upload Destination

Modify the upload step in `.github/workflows/build-bleeding.yml` to change the S3 path or endpoint.

### Build Frequency

The workflow is triggered manually via `workflow_dispatch`. To add automatic triggers:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  push:
    branches: [main]      # On pushes to main
```