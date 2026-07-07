#!/bin/bash
set -e

REPO="eth3nZ/News_Agent_v2"
TAG="v0.1.0"

# Get GitHub token from git credential store
TOKEN=$(git credential fill <<< $'protocol=https\nhost=github.com\n' 2>/dev/null | grep password | cut -d= -f2)
echo "Token obtained: ${TOKEN:0:8}..."

# Create the GitHub Release
echo "Creating GitHub Release for tag $TAG..."
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\",\"body\":\"Production build with .deb/.rpm/.AppImage installers\",\"draft\":false,\"prerelease\":false}")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id','ERROR'))")
echo "Release ID: $RELEASE_ID"

if [ "$RELEASE_ID" = "ERROR" ]; then
  echo "Failed to create release!"
  echo "$RELEASE_RESPONSE"
  exit 1
fi

# Upload assets
cd "/home/tssh/Documents/Project&demo/News_Agent_Tauri"
for file in dist_installers/*; do
  filename=$(basename "$file")
  echo "Uploading $filename..."
  
  content_type="application/octet-stream"
  case "$filename" in
    *.deb) content_type="application/vnd.debian.binary-package" ;;
    *.rpm) content_type="application/x-rpm" ;;
    *.AppImage) content_type="application/x-appimage" ;;
  esac
  
  curl -s -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: $content_type" \
    --data-binary @"$file" \
    "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=$filename"
  
  echo " - done"
done

echo ""
echo "=== Upload complete! ==="
echo "Visit: https://github.com/$REPO/releases/tag/$TAG"